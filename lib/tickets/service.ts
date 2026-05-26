import {
  readAdminStore,
  updateAdminStore,
  type SupportTicket,
  type SupportTicketMessage,
  type TicketAttachment,
  type TicketCategory,
  type TicketPriority,
  type TicketStatus,
} from '@/lib/adminStore';
import { normalizeMarveoRoles, type MarveoRole } from '@/lib/auth';
import { sendPlatformEmailNotification } from '@/lib/emailNotifications';
import { notifyTicketEvent, type TicketNotificationEvent } from './notifications';
import { sanitizeAndExtractRichText, sanitizeTicketSubject } from './richText';
import { appendSignatureToHtml, resolveTicketSignature } from './signature';

export const TICKET_CATEGORIES: TicketCategory[] = [
  'complaint',
  'billing',
  'technical_support',
  'website_support',
  'whatsapp_integration',
  'general_enquiry',
];

export const TICKET_PRIORITIES: TicketPriority[] = ['low', 'normal', 'high', 'urgent'];

export const TICKET_STATUSES: TicketStatus[] = [
  'open',
  'awaiting_support',
  'awaiting_client',
  'in_progress',
  'resolved',
  'closed',
];

export const LIVE_CHAT_REMINDER_AFTER_HOURS = 24;
export const LIVE_CHAT_AUTO_CLOSE_AFTER_HOURS = 72;

function normalizeEmail(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function normalizeSubjectKey(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function isLiveChatModule(value: unknown): boolean {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'live_chat'
    || normalized === 'website_live_chat'
    || normalized === 'portal_chat_widget'
    || normalized === 'website_chat_widget'
    || normalized === 'login_chat_widget';
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function formatTicketNumber(sequence: number, atIso: string): string {
  const year = new Date(atIso).getUTCFullYear();
  return `MRV-${year}-${String(sequence).padStart(6, '0')}`;
}

function sanitizeAttachments(input: unknown): TicketAttachment[] {
  if (!Array.isArray(input)) return [];

  const output: TicketAttachment[] = [];
  for (const item of input) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const id = String(row.id || createId('att')).trim();
    const name = String(row.name || '').trim();
    const url = String(row.url || '').trim();
    const uploadedAt = String(row.uploadedAt || new Date().toISOString()).trim();
    if (!name || !url) continue;

    const size = Number(row.size);
    output.push({
      id,
      name,
      url,
      size: Number.isFinite(size) && size > 0 ? size : undefined,
      contentType: String(row.contentType || '').trim() || undefined,
      uploadedAt,
    });
  }

  return output;
}

export function sanitizeCategory(input: unknown): TicketCategory {
  const normalized = String(input || '').trim().toLowerCase() as TicketCategory;
  return TICKET_CATEGORIES.includes(normalized) ? normalized : 'general_enquiry';
}

export function sanitizePriority(input: unknown): TicketPriority {
  const normalized = String(input || '').trim().toLowerCase() as TicketPriority;
  return TICKET_PRIORITIES.includes(normalized) ? normalized : 'normal';
}

export function sanitizeStatus(input: unknown): TicketStatus {
  const normalized = String(input || '').trim().toLowerCase() as TicketStatus;
  return TICKET_STATUSES.includes(normalized) ? normalized : 'open';
}

export function hasGlobalTicketDeskAccess(roles: string[]): boolean {
  const marveoRoles = normalizeMarveoRoles(roles);
  return marveoRoles.includes('SUPER_ADMIN') || marveoRoles.includes('ADMIN');
}

export function resolvePrimaryInternalRole(roles: string[]): MarveoRole | null {
  const priority: MarveoRole[] = [
    'SUPER_ADMIN',
    'ADMIN',
    'TECHNICAL_SUPPORT',
    'CUSTOMER_SUPPORT',
    'DEPLOYMENT_MANAGER',
    'BILLING_MANAGER',
  ];

  const marveoRoles = normalizeMarveoRoles(roles);
  for (const role of priority) {
    if (marveoRoles.includes(role)) return role;
  }

  return null;
}

export async function hasSupportQueueAccess(roles: string[]): Promise<boolean> {
  if (hasGlobalTicketDeskAccess(roles)) return true;

  const role = resolvePrimaryInternalRole(roles);
  if (!role) return false;

  const store = await readAdminStore();
  return Boolean(store.controlCenterRoleVisibility[role]?.supportQueue);
}

export async function hasTicketDeskAccess(roles: string[]): Promise<boolean> {
  if (hasGlobalTicketDeskAccess(roles)) return true;

  const role = resolvePrimaryInternalRole(roles);
  if (!role) return false;

  const store = await readAdminStore();
  return Boolean(store.controlCenterRoleVisibility[role]?.tickets);
}

export async function hasDefinedRepliesAccess(roles: string[]): Promise<boolean> {
  if (hasGlobalTicketDeskAccess(roles)) return true;

  const role = resolvePrimaryInternalRole(roles);
  if (!role) return false;

  const store = await readAdminStore();
  return Boolean(store.controlCenterRoleVisibility[role]?.definedReplies);
}

export async function resolveClientWorkspaceScope(input: {
  sessionUserId: string;
  roles: string[];
}): Promise<string[]> {
  const store = await readAdminStore();

  if (hasGlobalTicketDeskAccess(input.roles)) {
    return Object.keys(store.cloud.workspaces);
  }

  const state = store.users[input.sessionUserId];
  if (state?.assignedWorkspaceId && store.cloud.workspaces[state.assignedWorkspaceId]) {
    return [state.assignedWorkspaceId];
  }

  return [];
}

export async function createTicket(input: {
  workspaceId: string;
  clientUserId: string;
  clientEmail: string;
  clientName: string;
  category: TicketCategory;
  priority: TicketPriority;
  subject: string;
  descriptionHtml: string;
  attachments?: unknown;
  source?: SupportTicket['source'];
  relatedModule?: string;
  actorEmail: string;
}): Promise<{ ticket: SupportTicket; initialMessage: SupportTicketMessage }> {
  const normalizedClientEmail = normalizeEmail(input.clientEmail);
  if (!isValidEmail(normalizedClientEmail)) {
    throw new Error('Client email is required for ticket notifications.');
  }

  let createdTicket: SupportTicket | null = null;
  let createdMessage: SupportTicketMessage | null = null;

  const queueLinkedCategories: TicketCategory[] = ['website_support', 'technical_support', 'whatsapp_integration'];

  const mapPriorityToQueue = (priority: TicketPriority): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' => {
    if (priority === 'low') return 'LOW';
    if (priority === 'high') return 'HIGH';
    if (priority === 'urgent') return 'CRITICAL';
    return 'MEDIUM';
  };

  await updateAdminStore((current) => {
    const now = new Date().toISOString();
    const ticketId = createId('tkt');
    const messageId = createId('tmsg');
    const subject = sanitizeTicketSubject(input.subject);
    const richText = sanitizeAndExtractRichText(input.descriptionHtml);
    const sequence = current.cloud.ticketing.counters.nextTicketSequence;

    const ticket: SupportTicket = {
      id: ticketId,
      ticketNumber: formatTicketNumber(sequence, now),
      workspaceId: input.workspaceId,
      clientUserId: String(input.clientUserId || '').trim(),
      clientEmail: normalizedClientEmail,
      clientName: String(input.clientName || '').trim() || 'Client',
      category: sanitizeCategory(input.category),
      priority: sanitizePriority(input.priority),
      status: 'open',
      subject,
      descriptionHtml: richText.html,
      descriptionText: richText.text,
      attachments: sanitizeAttachments(input.attachments),
      assignedTo: null,
      source: input.source || 'os',
      relatedModule: String(input.relatedModule || '').trim(),
      createdAt: now,
      updatedAt: now,
      closedAt: null,
      lastReplyAt: now,
    };

    const firstMessage: SupportTicketMessage = {
      id: messageId,
      ticketId,
      authorType: 'client',
      authorId: ticket.clientUserId,
      authorName: ticket.clientName,
      messageHtml: richText.html,
      messageText: richText.text,
      attachments: sanitizeAttachments(input.attachments),
      isInternalNote: false,
      createdAt: now,
    };

    createdTicket = ticket;
    createdMessage = firstMessage;

    const shouldLinkQueue = queueLinkedCategories.includes(ticket.category);
    const workspace = current.cloud.workspaces[ticket.workspaceId];

    const nextWorkspaces = (() => {
      if (!shouldLinkQueue || !workspace) {
        return current.cloud.workspaces;
      }

      const existing = workspace.supportAssignment;
      const defaultReason = `Auto-linked from ticket ${ticket.ticketNumber} (${ticket.category})`;
      const defaultSkills = ticket.category === 'whatsapp_integration'
        ? ['WhatsApp', 'Integrations']
        : ticket.category === 'website_support'
          ? ['Website Setup', 'Onboarding']
          : ['Technical Support'];

      const nextAssignment = existing
        ? {
            ...existing,
            ticketId: existing.ticketId || ticket.id,
            reason: existing.reason || defaultReason,
            priority: existing.priority || mapPriorityToQueue(ticket.priority),
          }
        : {
            status: 'UNASSIGNED' as const,
            assignedAt: now,
            assignedBy: 'ticket_automation',
            ticketId: ticket.id,
            priority: mapPriorityToQueue(ticket.priority),
            reason: defaultReason,
            setupType: workspace.websiteType || 'NEW_WEBSITE',
            requiredSkills: defaultSkills,
            initialNotes: `Created automatically from ticket ${ticket.ticketNumber}`,
            escalationStatus: 'NONE' as const,
          };

      return {
        ...current.cloud.workspaces,
        [workspace.id]: {
          ...workspace,
          supportRequired: true,
          supportAssignment: nextAssignment,
          updatedAt: now,
        },
      };
    })();

    return {
      ...current,
      cloud: {
        ...current.cloud,
        workspaces: nextWorkspaces,
        ticketing: {
          ...current.cloud.ticketing,
          tickets: {
            ...current.cloud.ticketing.tickets,
            [ticketId]: ticket,
          },
          messages: {
            ...current.cloud.ticketing.messages,
            [ticketId]: [firstMessage],
          },
          counters: {
            ...current.cloud.ticketing.counters,
            nextTicketSequence: sequence + 1,
          },
        },
      },
    };
  });

  const maybeTicket = createdTicket as SupportTicket | null;
  const maybeMessage = createdMessage as SupportTicketMessage | null;

  if (!maybeTicket || !maybeMessage) {
    throw new Error('Ticket creation failed');
  }

  const finalTicket = maybeTicket;
  const finalMessage = maybeMessage;
  const clientRecipient = normalizeEmail(finalTicket.clientEmail);

  await notifyTicketEvent({
    event: 'ticket.created',
    actorEmail: input.actorEmail,
    ticketId: finalTicket.id,
    ticketNumber: finalTicket.ticketNumber,
    workspaceId: finalTicket.workspaceId,
    recipientEmail: clientRecipient,
  });

  const store = await readAdminStore();
  const workspaceName = store.cloud.workspaces[finalTicket.workspaceId]?.name || finalTicket.workspaceId;

  await sendPlatformEmailNotification({
    templateKey: 'TICKET_ASSIGNED',
    to: clientRecipient,
    variables: {
      clientName: finalTicket.clientName,
      ticketNumber: finalTicket.ticketNumber,
      workspaceName,
      ticketStatus: finalTicket.status,
    },
  });

  const supportRecipients = Array.from(new Set([
    normalizeEmail(store.platformSettings.email.supportEmail),
    normalizeEmail(store.platformSettings.email.fromEmail),
    normalizeEmail(store.platformSettings.email.replyToEmail),
    ...(Array.isArray(store.platformSettings.email.failureAlertRecipients)
      ? store.platformSettings.email.failureAlertRecipients.map((email) => normalizeEmail(email))
      : []),
    ...Object.values(store.nativeAuth.identities)
      .filter((identity) => identity.userType === 'INTERNAL_USER' && identity.status === 'ACTIVE')
      .filter((identity) => {
        const userState = store.users[identity.id];
        if (userState?.active === false || userState?.status === 'DISABLED') return false;

        const roles = new Set<string>([
          ...identity.roles,
          ...(userState?.masterRole ? [userState.masterRole] : []),
        ]);
        const normalized = Array.from(roles).map((role) => String(role).trim().toUpperCase());

        return normalized.includes('CUSTOMER_SUPPORT')
          || normalized.includes('TECHNICAL_SUPPORT')
          || normalized.includes('ADMIN')
          || normalized.includes('SUPER_ADMIN');
      })
        .map((identity) => normalizeEmail(identity.email)),
      ])).filter((email) => isValidEmail(email));

  if (supportRecipients.length > 0) {
    await sendPlatformEmailNotification({
      templateKey: 'TICKET_ASSIGNED_SUPPORT',
      to: supportRecipients,
      variables: {
        supportOfficerName: 'Support Team',
        ticketNumber: finalTicket.ticketNumber,
        workspaceName,
        ticketSubject: finalTicket.subject,
        clientEmail: finalTicket.clientEmail,
      },
    });
  }

  return { ticket: finalTicket, initialMessage: finalMessage };
}

export async function listTickets(input: {
  workspaceIds?: string[];
  assignedTo?: string;
  status?: TicketStatus | '';
  category?: TicketCategory | '';
  priority?: TicketPriority | '';
  search?: string;
  includeClosed?: boolean;
  relatedModules?: string[];
}): Promise<SupportTicket[]> {
  const store = await readAdminStore();
  const tickets = Object.values(store.cloud.ticketing.tickets);

  const workspaceIdSet = new Set((input.workspaceIds || []).filter(Boolean));
  const relatedModuleSet = new Set((input.relatedModules || []).map((value) => String(value || '').trim().toLowerCase()).filter(Boolean));
  const search = String(input.search || '').trim().toLowerCase();

  return tickets
    .filter((ticket) => {
      if (workspaceIdSet.size > 0 && !workspaceIdSet.has(ticket.workspaceId)) return false;
      if (input.assignedTo && ticket.assignedTo !== input.assignedTo) return false;
      if (input.status && ticket.status !== input.status) return false;
      if (input.category && ticket.category !== input.category) return false;
      if (input.priority && ticket.priority !== input.priority) return false;
      if (relatedModuleSet.size > 0) {
        const moduleKey = String(ticket.relatedModule || '').trim().toLowerCase();
        if (!relatedModuleSet.has(moduleKey)) return false;
      }
      if (!input.includeClosed && (ticket.status === 'closed' || ticket.status === 'resolved')) return false;
      if (search) {
        const blob = `${ticket.ticketNumber} ${ticket.subject} ${ticket.clientEmail} ${ticket.clientName} ${ticket.relatedModule}`.toLowerCase();
        return blob.includes(search);
      }
      return true;
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getTicketWithMessages(ticketId: string): Promise<{ ticket: SupportTicket; messages: SupportTicketMessage[] } | null> {
  const store = await readAdminStore();
  const ticket = store.cloud.ticketing.tickets[ticketId];
  if (!ticket) return null;

  const messages = [...(store.cloud.ticketing.messages[ticketId] || [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return { ticket, messages };
}

export async function findLatestUnclosedClientTicket(input: {
  workspaceId: string;
  clientEmail: string;
  category: TicketCategory;
  subject: string;
}): Promise<SupportTicket | null> {
  const store = await readAdminStore();
  const email = normalizeEmail(input.clientEmail);
  const subjectKey = normalizeSubjectKey(input.subject);
  if (!email || !subjectKey) return null;

  const openStatuses = new Set<TicketStatus>(['open', 'awaiting_support', 'awaiting_client', 'in_progress']);

  const matches = Object.values(store.cloud.ticketing.tickets)
    .filter((ticket) => ticket.workspaceId === input.workspaceId)
    .filter((ticket) => normalizeEmail(ticket.clientEmail) === email)
    .filter((ticket) => ticket.category === input.category)
    .filter((ticket) => openStatuses.has(ticket.status))
    .filter((ticket) => normalizeSubjectKey(ticket.subject) === subjectKey)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return matches[0] || null;
}

async function appendSystemTicketNote(input: {
  ticketId: string;
  marker: string;
  messageHtml: string;
}): Promise<boolean> {
  let created = false;

  await updateAdminStore((current) => {
    const ticket = current.cloud.ticketing.tickets[input.ticketId];
    if (!ticket) return current;

    const existingMessages = current.cloud.ticketing.messages[input.ticketId] || [];
    const markerExists = existingMessages.some((row) =>
      row.authorType === 'system' && row.messageText.includes(input.marker),
    );
    if (markerExists) return current;

    const now = new Date().toISOString();
    const richText = sanitizeAndExtractRichText(input.messageHtml);
    const message: SupportTicketMessage = {
      id: createId('tmsg'),
      ticketId: ticket.id,
      authorType: 'system',
      authorId: 'system',
      authorName: 'Marveo Automation',
      messageHtml: richText.html,
      messageText: richText.text,
      attachments: [],
      isInternalNote: false,
      createdAt: now,
    };

    created = true;

    return {
      ...current,
      cloud: {
        ...current.cloud,
        ticketing: {
          ...current.cloud.ticketing,
          tickets: {
            ...current.cloud.ticketing.tickets,
            [ticket.id]: {
              ...ticket,
              updatedAt: now,
            },
          },
          messages: {
            ...current.cloud.ticketing.messages,
            [ticket.id]: [...existingMessages, message],
          },
        },
      },
    };
  });

  return created;
}

export async function applyLiveChatLifecycleRules(input?: { actorEmail?: string }): Promise<{ reminded: number; autoClosed: number }> {
  const actorEmail = normalizeEmail(input?.actorEmail || 'system@marveo.local') || 'system@marveo.local';
  const store = await readAdminStore();
  const now = Date.now();
  const reminderMs = LIVE_CHAT_REMINDER_AFTER_HOURS * 60 * 60 * 1000;
  const autoCloseMs = LIVE_CHAT_AUTO_CLOSE_AFTER_HOURS * 60 * 60 * 1000;
  const reminderMarker = '[AUTO_CLOSE_REMINDER_24H]';
  const closedMarker = '[AUTO_CLOSED_72H]';

  let reminded = 0;
  let autoClosed = 0;

  const candidates = Object.values(store.cloud.ticketing.tickets)
    .filter((ticket) => isLiveChatModule(ticket.relatedModule))
    .filter((ticket) => ticket.status === 'awaiting_client');

  for (const ticket of candidates) {
    const lastReplyAt = new Date(ticket.lastReplyAt || ticket.updatedAt || ticket.createdAt).getTime();
    if (!Number.isFinite(lastReplyAt)) continue;
    const ageMs = now - lastReplyAt;

    if (ageMs >= autoCloseMs) {
      const noted = await appendSystemTicketNote({
        ticketId: ticket.id,
        marker: closedMarker,
        messageHtml: `<p>${closedMarker} Ticket automatically closed after ${LIVE_CHAT_AUTO_CLOSE_AFTER_HOURS} hours without client response.</p>`,
      });
      const closed = await patchTicket({
        ticketId: ticket.id,
        status: 'closed',
        actorEmail,
      });
      if (closed) {
        autoClosed += 1;
      } else if (noted) {
        // Keep counts stable when patch failed but marker was added.
        autoClosed += 1;
      }
      continue;
    }

    if (ageMs >= reminderMs) {
      const noted = await appendSystemTicketNote({
        ticketId: ticket.id,
        marker: reminderMarker,
        messageHtml: `<p>${reminderMarker} Reminder sent: this live chat ticket will auto-close in ${LIVE_CHAT_AUTO_CLOSE_AFTER_HOURS - LIVE_CHAT_REMINDER_AFTER_HOURS} hours if there is no client response.</p>`,
      });
      if (noted) reminded += 1;
    }
  }

  return { reminded, autoClosed };
}

export async function addTicketMessage(input: {
  ticketId: string;
  authorType: SupportTicketMessage['authorType'];
  authorId: string;
  authorName: string;
  messageHtml: string;
  attachments?: unknown;
  isInternalNote?: boolean;
  actorEmail: string;
}): Promise<{ ticket: SupportTicket; message: SupportTicketMessage }> {
  const store = await readAdminStore();
  const authorId = String(input.authorId || '').trim();
  const identity = authorId ? store.nativeAuth.identities[authorId] : undefined;
  const authorRole = String(
    store.users[authorId]?.masterRole
      || identity?.roles?.[0]
      || (input.authorType === 'client' ? 'CLIENT_OWNER' : 'CUSTOMER_SUPPORT'),
  ).trim().toUpperCase();
  const signature = resolveTicketSignature({
    storedSignature: store.users[authorId]?.ticketSignature || '',
    displayName: input.authorName || identity?.name || input.actorEmail,
    role: authorRole,
  });

  const shouldAppendSignature = !Boolean(input.isInternalNote);
  const messageHtmlWithSignature = shouldAppendSignature
    ? appendSignatureToHtml(input.messageHtml, signature)
    : input.messageHtml;

  let updatedTicket: SupportTicket | null = null;
  let createdMessage: SupportTicketMessage | null = null;

  await updateAdminStore((current) => {
    const existing = current.cloud.ticketing.tickets[input.ticketId];
    if (!existing) return current;

    const now = new Date().toISOString();
    const richText = sanitizeAndExtractRichText(messageHtmlWithSignature);
    const nextStatus: TicketStatus = (() => {
      if (Boolean(input.isInternalNote)) return existing.status;
      if (input.authorType === 'client') return existing.status === 'closed' ? 'closed' : 'awaiting_support';
      if (input.authorType === 'support') return existing.status === 'closed' ? 'closed' : 'awaiting_client';
      return existing.status;
    })();

    const message: SupportTicketMessage = {
      id: createId('tmsg'),
      ticketId: existing.id,
      authorType: input.authorType,
      authorId: String(input.authorId || '').trim(),
      authorName: String(input.authorName || '').trim() || 'Support',
      messageHtml: richText.html,
      messageText: richText.text,
      attachments: sanitizeAttachments(input.attachments),
      isInternalNote: Boolean(input.isInternalNote),
      createdAt: now,
    };

    const nextTicket: SupportTicket = {
      ...existing,
      status: nextStatus,
      updatedAt: now,
      lastReplyAt: now,
      closedAt: nextStatus === 'closed' ? (existing.closedAt || now) : existing.closedAt,
    };

    updatedTicket = nextTicket;
    createdMessage = message;

    return {
      ...current,
      cloud: {
        ...current.cloud,
        ticketing: {
          ...current.cloud.ticketing,
          tickets: {
            ...current.cloud.ticketing.tickets,
            [existing.id]: nextTicket,
          },
          messages: {
            ...current.cloud.ticketing.messages,
            [existing.id]: [...(current.cloud.ticketing.messages[existing.id] || []), message],
          },
        },
      },
    };
  });

  const maybeTicket = updatedTicket as SupportTicket | null;
  const maybeMessage = createdMessage as SupportTicketMessage | null;

  if (!maybeTicket || !maybeMessage) {
    throw new Error('Ticket message could not be added');
  }

  const finalTicket = maybeTicket;
  const finalMessage = maybeMessage;

  const event: TicketNotificationEvent = input.isInternalNote
    ? 'ticket.status_changed'
    : input.authorType === 'client'
      ? 'ticket.client_replied'
      : 'ticket.support_replied';

  await notifyTicketEvent({
    event,
    actorEmail: input.actorEmail,
    ticketId: finalTicket.id,
    ticketNumber: finalTicket.ticketNumber,
    workspaceId: finalTicket.workspaceId,
    recipientEmail: finalTicket.clientEmail,
  });

  if (!input.isInternalNote) {
    const workspaceName = store.cloud.workspaces[finalTicket.workspaceId]?.name || finalTicket.workspaceId;
    const brandName = store.platformSettings.branding.brandName || 'Marveo';

    if (input.authorType === 'support') {
      const identity = store.nativeAuth.identities[String(input.authorId || '').trim()];
      const supportRoleRaw = String(store.users[String(input.authorId || '').trim()]?.masterRole || identity?.roles?.[0] || 'SUPPORT').trim().toUpperCase();
      const supportRole = supportRoleRaw.replace(/_/g, ' ');

      await sendPlatformEmailNotification({
        templateKey: 'TICKET_REPLY_CLIENT',
        to: finalTicket.clientEmail,
        variables: {
          clientName: finalTicket.clientName,
          ticketNumber: finalTicket.ticketNumber,
          supportOfficerName: input.authorName,
          supportOfficerRole: supportRole,
          messageBody: finalMessage.messageHtml,
          messageText: finalMessage.messageText,
          brandName,
          workspaceName,
        },
      });
    }

    if (input.authorType === 'client') {
      const supportRecipients = Array.from(new Set([
        String(store.platformSettings.email.supportEmail || '').trim().toLowerCase(),
        finalTicket.assignedTo ? String(store.nativeAuth.identities[finalTicket.assignedTo]?.email || '').trim().toLowerCase() : '',
      ])).filter(Boolean);

      if (supportRecipients.length > 0) {
        await sendPlatformEmailNotification({
          templateKey: 'TICKET_REPLY_SUPPORT',
          to: supportRecipients,
          variables: {
            supportOfficerName: 'Support Team',
            ticketNumber: finalTicket.ticketNumber,
            workspaceName,
            clientEmail: finalTicket.clientEmail,
            messageBody: finalMessage.messageHtml,
            messageText: finalMessage.messageText,
          },
        });
      }
    }
  }

  return { ticket: finalTicket, message: finalMessage };
}

export async function patchTicket(input: {
  ticketId: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  assignedTo?: string | null;
  actorEmail: string;
}): Promise<SupportTicket | null> {
  let patched: SupportTicket | null = null;
  let changedStatus = false;

  await updateAdminStore((current) => {
    const ticket = current.cloud.ticketing.tickets[input.ticketId];
    if (!ticket) return current;

    const now = new Date().toISOString();
    const nextStatus = input.status ? sanitizeStatus(input.status) : ticket.status;
    const nextPriority = input.priority ? sanitizePriority(input.priority) : ticket.priority;

    const next: SupportTicket = {
      ...ticket,
      status: nextStatus,
      priority: nextPriority,
      assignedTo: input.assignedTo === undefined ? ticket.assignedTo : (input.assignedTo || null),
      updatedAt: now,
      closedAt: nextStatus === 'closed' || nextStatus === 'resolved'
        ? (ticket.closedAt || now)
        : null,
    };

    changedStatus = next.status !== ticket.status;
    patched = next;

    return {
      ...current,
      cloud: {
        ...current.cloud,
        ticketing: {
          ...current.cloud.ticketing,
          tickets: {
            ...current.cloud.ticketing.tickets,
            [ticket.id]: next,
          },
        },
      },
    };
  });

  const maybePatched = patched as SupportTicket | null;
  if (!maybePatched) return null;

  const finalTicket = maybePatched;

  if (changedStatus) {
    await notifyTicketEvent({
      event: finalTicket.status === 'resolved' ? 'ticket.resolved' : 'ticket.status_changed',
      actorEmail: input.actorEmail,
      ticketId: finalTicket.id,
      ticketNumber: finalTicket.ticketNumber,
      workspaceId: finalTicket.workspaceId,
      recipientEmail: finalTicket.clientEmail,
    });
  }

  return finalTicket;
}

export async function assignTicket(input: {
  ticketId: string;
  assignedTo: string | null;
  actorEmail: string;
}): Promise<SupportTicket | null> {
  const patched = await patchTicket({
    ticketId: input.ticketId,
    assignedTo: input.assignedTo,
    actorEmail: input.actorEmail,
  });

  if (!patched) return null;

  await notifyTicketEvent({
    event: 'ticket.assigned',
    actorEmail: input.actorEmail,
    ticketId: patched.id,
    ticketNumber: patched.ticketNumber,
    workspaceId: patched.workspaceId,
    recipientEmail: patched.clientEmail,
  });

  return patched;
}

export async function resetTicket(input: {
  ticketId: string;
}): Promise<SupportTicket | null> {
  let reset: SupportTicket | null = null;

  await updateAdminStore((current) => {
    const ticket = current.cloud.ticketing.tickets[input.ticketId];
    if (!ticket) return current;

    const now = new Date().toISOString();
    const next: SupportTicket = {
      ...ticket,
      status: 'open',
      priority: 'normal',
      assignedTo: null,
      updatedAt: now,
      closedAt: null,
    };

    reset = next;

    return {
      ...current,
      cloud: {
        ...current.cloud,
        ticketing: {
          ...current.cloud.ticketing,
          tickets: {
            ...current.cloud.ticketing.tickets,
            [ticket.id]: next,
          },
        },
      },
    };
  });

  return reset;
}

export async function purgeTicket(input: {
  ticketId: string;
}): Promise<SupportTicket | null> {
  let removed: SupportTicket | null = null;

  await updateAdminStore((current) => {
    const ticket = current.cloud.ticketing.tickets[input.ticketId];
    if (!ticket) return current;

    removed = ticket;

    const nextTickets = { ...current.cloud.ticketing.tickets };
    const nextMessages = { ...current.cloud.ticketing.messages };
    delete nextTickets[input.ticketId];
    delete nextMessages[input.ticketId];

    return {
      ...current,
      cloud: {
        ...current.cloud,
        ticketing: {
          ...current.cloud.ticketing,
          tickets: nextTickets,
          messages: nextMessages,
        },
      },
    };
  });

  return removed;
}

export async function resetAllTickets(): Promise<{ clearedTickets: number; clearedMessageThreads: number }> {
  let clearedTickets = 0;
  let clearedMessageThreads = 0;

  await updateAdminStore((current) => {
    clearedTickets = Object.keys(current.cloud.ticketing.tickets).length;
    clearedMessageThreads = Object.keys(current.cloud.ticketing.messages).length;

    return {
      ...current,
      cloud: {
        ...current.cloud,
        ticketing: {
          ...current.cloud.ticketing,
          tickets: {},
          messages: {},
        },
      },
    };
  });

  return { clearedTickets, clearedMessageThreads };
}

export function filterClientVisibleMessages(messages: SupportTicketMessage[]): SupportTicketMessage[] {
  return messages.filter((message) => !message.isInternalNote);
}

export function buildTicketDeskSummary(tickets: SupportTicket[]) {
  const openStatuses: TicketStatus[] = ['open', 'awaiting_support', 'awaiting_client', 'in_progress'];
  return {
    openTickets: tickets.filter((ticket) => openStatuses.includes(ticket.status)).length,
    urgentTickets: tickets.filter((ticket) => ticket.priority === 'urgent' && openStatuses.includes(ticket.status)).length,
    awaitingClient: tickets.filter((ticket) => ticket.status === 'awaiting_client').length,
    awaitingSupport: tickets.filter((ticket) => ticket.status === 'awaiting_support').length,
  };
}
