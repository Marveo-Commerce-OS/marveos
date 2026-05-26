import {
  readAdminStore,
  updateAdminStore,
  type LiveChatPresenceRecord,
  type LiveChatSession,
  type LiveChatSessionMessage,
  type LiveChatSessionStatus,
  type TicketAttachment,
  type TicketCategory,
} from '@/lib/adminStore';
import { addTicketMessage, createTicket, getTicketWithMessages, patchTicket, sanitizeCategory } from '@/lib/tickets/service';
import { sanitizeAndExtractRichText } from '@/lib/tickets/richText';

const OPEN_STATUSES = new Set<LiveChatSessionStatus>(['queued', 'active', 'awaiting_client']);

function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeEmail(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeSubject(value: unknown): string {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function normalizeSubjectKey(value: unknown): string {
  return normalizeSubject(value).toLowerCase();
}

function sanitizeAttachments(input: unknown): TicketAttachment[] {
  if (!Array.isArray(input)) return [];

  const output: TicketAttachment[] = [];
  for (const item of input) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const name = String(row.name || '').trim();
    const url = String(row.url || '').trim();
    if (!name || !url) continue;

    const size = Number(row.size);
    output.push({
      id: String(row.id || createId('att')).trim(),
      name,
      url,
      size: Number.isFinite(size) && size > 0 ? size : undefined,
      contentType: String(row.contentType || '').trim() || undefined,
      uploadedAt: String(row.uploadedAt || new Date().toISOString()).trim(),
    });
  }

  return output;
}

function formatSessionNumber(sequence: number, atIso: string): string {
  const year = new Date(atIso).getUTCFullYear();
  return `LCS-${year}-${String(sequence).padStart(6, '0')}`;
}

export function normalizeMessageToHtml(message: string): string {
  const escaped = message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>');
  return `<p>${escaped}</p>`;
}

export async function findLatestOpenLiveSession(input: {
  workspaceId: string;
  clientEmail: string;
  category: TicketCategory;
  subject: string;
}): Promise<LiveChatSession | null> {
  const store = await readAdminStore();
  const email = normalizeEmail(input.clientEmail);
  const subjectKey = normalizeSubjectKey(input.subject);
  if (!email || !subjectKey) return null;

  const matches = Object.values(store.cloud.ticketing.liveSessions)
    .filter((session) => session.workspaceId === input.workspaceId)
    .filter((session) => normalizeEmail(session.clientEmail) === email)
    .filter((session) => session.category === input.category)
    .filter((session) => normalizeSubjectKey(session.subject) === subjectKey)
    .filter((session) => OPEN_STATUSES.has(session.status))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return matches[0] || null;
}

export async function createLiveSession(input: {
  workspaceId: string;
  clientEmail: string;
  clientName: string;
  category: TicketCategory;
  subject: string;
  initialMessageHtml: string;
  attachments?: unknown;
}): Promise<{ session: LiveChatSession; message: LiveChatSessionMessage }> {
  const clientEmail = normalizeEmail(input.clientEmail);
  if (!isValidEmail(clientEmail)) {
    throw new Error('A valid client email is required.');
  }

  const workspaceId = String(input.workspaceId || '').trim();
  if (!workspaceId) throw new Error('workspaceId is required.');

  const subject = normalizeSubject(input.subject);
  if (!subject) throw new Error('subject is required.');

  let createdSession: LiveChatSession | null = null;
  let createdMessage: LiveChatSessionMessage | null = null;

  await updateAdminStore((current) => {
    if (!current.cloud.workspaces[workspaceId]) {
      throw new Error('Workspace not found for live chat session.');
    }

    const now = new Date().toISOString();
    const sessionId = createId('lcs');
    const messageId = createId('lmsg');
    const sequence = current.cloud.ticketing.counters.nextLiveSessionSequence;
    const rich = sanitizeAndExtractRichText(input.initialMessageHtml);
    const attachments = sanitizeAttachments(input.attachments);

    const session: LiveChatSession = {
      id: sessionId,
      sessionNumber: formatSessionNumber(sequence, now),
      workspaceId,
      clientEmail,
      clientName: String(input.clientName || '').trim() || 'Client',
      category: sanitizeCategory(input.category),
      subject,
      status: 'queued',
      assignedResponderId: null,
      assignedResponderName: undefined,
      lastClientAt: now,
      lastSupportAt: null,
      lastPresenceAt: now,
      linkedTicketId: null,
      linkedTicketNumber: null,
      convertedAt: null,
      endedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    const message: LiveChatSessionMessage = {
      id: messageId,
      sessionId,
      authorType: 'client',
      authorId: `public_chat:${clientEmail}`,
      authorName: session.clientName,
      messageHtml: rich.html,
      messageText: rich.text,
      attachments,
      createdAt: now,
    };

    createdSession = session;
    createdMessage = message;

    return {
      ...current,
      cloud: {
        ...current.cloud,
        ticketing: {
          ...current.cloud.ticketing,
          liveSessions: {
            ...current.cloud.ticketing.liveSessions,
            [sessionId]: session,
          },
          liveMessages: {
            ...current.cloud.ticketing.liveMessages,
            [sessionId]: [message],
          },
          livePresence: {
            ...current.cloud.ticketing.livePresence,
            [sessionId]: {
              sessionId,
              clientOnline: true,
              supportOnline: false,
              lastClientSeenAt: now,
              lastSupportSeenAt: null,
              updatedAt: now,
            },
          },
          counters: {
            ...current.cloud.ticketing.counters,
            nextLiveSessionSequence: sequence + 1,
          },
        },
      },
    };
  });

  if (!createdSession || !createdMessage) {
    throw new Error('Unable to create live chat session.');
  }

  return { session: createdSession, message: createdMessage };
}

export async function listLiveSessions(input: {
  status?: LiveChatSessionStatus | '';
  category?: TicketCategory | '';
  search?: string;
  includeConverted?: boolean;
}): Promise<LiveChatSession[]> {
  const store = await readAdminStore();
  const search = String(input.search || '').trim().toLowerCase();

  return Object.values(store.cloud.ticketing.liveSessions)
    .filter((session) => {
      if (input.status && session.status !== input.status) return false;
      if (input.category && session.category !== input.category) return false;
      if (!input.includeConverted && (session.status === 'converted' || session.status === 'ended')) return false;
      if (!search) return true;
      const blob = `${session.sessionNumber} ${session.subject} ${session.clientName} ${session.clientEmail}`.toLowerCase();
      return blob.includes(search);
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getLiveSessionWithMessages(sessionId: string): Promise<{
  session: LiveChatSession;
  messages: LiveChatSessionMessage[];
} | null> {
  const store = await readAdminStore();
  const session = store.cloud.ticketing.liveSessions[sessionId];
  if (!session) return null;

  const messages = [...(store.cloud.ticketing.liveMessages[sessionId] || [])]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return { session, messages };
}

export async function addLiveSessionMessage(input: {
  sessionId: string;
  authorType: LiveChatSessionMessage['authorType'];
  authorId: string;
  authorName: string;
  messageHtml: string;
  attachments?: unknown;
}): Promise<{ session: LiveChatSession; message: LiveChatSessionMessage }> {
  const now = new Date().toISOString();
  let nextSession: LiveChatSession | null = null;
  let createdMessage: LiveChatSessionMessage | null = null;

  await updateAdminStore((current) => {
    const session = current.cloud.ticketing.liveSessions[input.sessionId];
    if (!session) return current;

    const rich = sanitizeAndExtractRichText(input.messageHtml);
    const message: LiveChatSessionMessage = {
      id: createId('lmsg'),
      sessionId: session.id,
      authorType: input.authorType,
      authorId: String(input.authorId || '').trim(),
      authorName: String(input.authorName || '').trim() || 'Support',
      messageHtml: rich.html,
      messageText: rich.text,
      attachments: sanitizeAttachments(input.attachments),
      createdAt: now,
    };

    const status: LiveChatSessionStatus = (() => {
      if (session.status === 'converted') return session.status;
      if (input.authorType === 'support') return 'awaiting_client';
      if (input.authorType === 'client') return 'active';
      return session.status;
    })();

    const updated: LiveChatSession = {
      ...session,
      status,
      lastClientAt: input.authorType === 'client' ? now : session.lastClientAt,
      lastSupportAt: input.authorType === 'support' ? now : session.lastSupportAt,
      updatedAt: now,
    };

    nextSession = updated;
    createdMessage = message;

    return {
      ...current,
      cloud: {
        ...current.cloud,
        ticketing: {
          ...current.cloud.ticketing,
          liveSessions: {
            ...current.cloud.ticketing.liveSessions,
            [session.id]: updated,
          },
          liveMessages: {
            ...current.cloud.ticketing.liveMessages,
            [session.id]: [...(current.cloud.ticketing.liveMessages[session.id] || []), message],
          },
        },
      },
    };
  });

  if (!nextSession || !createdMessage) {
    throw new Error('Live session message could not be added.');
  }

  return { session: nextSession, message: createdMessage };
}

export async function assignLiveSessionResponder(input: {
  sessionId: string;
  responderId: string;
  responderName: string;
}): Promise<LiveChatSession | null> {
  let nextSession: LiveChatSession | null = null;

  await updateAdminStore((current) => {
    const session = current.cloud.ticketing.liveSessions[input.sessionId];
    if (!session) return current;

    const now = new Date().toISOString();
    const updated: LiveChatSession = {
      ...session,
      assignedResponderId: String(input.responderId || '').trim() || null,
      assignedResponderName: String(input.responderName || '').trim() || undefined,
      status: session.status === 'queued' ? 'active' : session.status,
      updatedAt: now,
    };

    nextSession = updated;

    return {
      ...current,
      cloud: {
        ...current.cloud,
        ticketing: {
          ...current.cloud.ticketing,
          liveSessions: {
            ...current.cloud.ticketing.liveSessions,
            [session.id]: updated,
          },
        },
      },
    };
  });

  return nextSession;
}

export async function updateLiveSessionPresence(input: {
  sessionId: string;
  actor: 'client' | 'support';
  online: boolean;
}): Promise<LiveChatPresenceRecord | null> {
  let nextPresence: LiveChatPresenceRecord | null = null;

  await updateAdminStore((current) => {
    const session = current.cloud.ticketing.liveSessions[input.sessionId];
    if (!session) return current;

    const now = new Date().toISOString();
    const existing = current.cloud.ticketing.livePresence[input.sessionId] || {
      sessionId: input.sessionId,
      clientOnline: false,
      supportOnline: false,
      lastClientSeenAt: null,
      lastSupportSeenAt: null,
      updatedAt: now,
    };

    const updated: LiveChatPresenceRecord = {
      ...existing,
      clientOnline: input.actor === 'client' ? input.online : existing.clientOnline,
      supportOnline: input.actor === 'support' ? input.online : existing.supportOnline,
      lastClientSeenAt: input.actor === 'client' && input.online ? now : existing.lastClientSeenAt,
      lastSupportSeenAt: input.actor === 'support' && input.online ? now : existing.lastSupportSeenAt,
      updatedAt: now,
    };

    nextPresence = updated;

    return {
      ...current,
      cloud: {
        ...current.cloud,
        ticketing: {
          ...current.cloud.ticketing,
          livePresence: {
            ...current.cloud.ticketing.livePresence,
            [input.sessionId]: updated,
          },
          liveSessions: {
            ...current.cloud.ticketing.liveSessions,
            [input.sessionId]: {
              ...session,
              lastPresenceAt: now,
              updatedAt: now,
            },
          },
        },
      },
    };
  });

  return nextPresence;
}

export async function endLiveSession(input: {
  sessionId: string;
}): Promise<LiveChatSession | null> {
  let nextSession: LiveChatSession | null = null;

  await updateAdminStore((current) => {
    const session = current.cloud.ticketing.liveSessions[input.sessionId];
    if (!session) return current;

    const now = new Date().toISOString();
    const updated: LiveChatSession = {
      ...session,
      status: session.status === 'converted' ? 'converted' : 'ended',
      endedAt: now,
      updatedAt: now,
    };

    nextSession = updated;

    return {
      ...current,
      cloud: {
        ...current.cloud,
        ticketing: {
          ...current.cloud.ticketing,
          liveSessions: {
            ...current.cloud.ticketing.liveSessions,
            [session.id]: updated,
          },
          livePresence: {
            ...current.cloud.ticketing.livePresence,
            [session.id]: {
              ...(current.cloud.ticketing.livePresence[session.id] || {
                sessionId: session.id,
                lastClientSeenAt: null,
                lastSupportSeenAt: null,
              }),
              clientOnline: false,
              supportOnline: false,
              updatedAt: now,
            },
          },
        },
      },
    };
  });

  return nextSession;
}

export async function convertLiveSessionToTicket(input: {
  sessionId: string;
  actorEmail: string;
  closeTicket?: boolean;
}): Promise<{ session: LiveChatSession; ticketId: string; ticketNumber: string } | null> {
  const row = await getLiveSessionWithMessages(input.sessionId);
  if (!row) return null;

  if (row.session.linkedTicketId) {
    const linked = await getTicketWithMessages(row.session.linkedTicketId);
    if (linked) {
      return {
        session: row.session,
        ticketId: linked.ticket.id,
        ticketNumber: linked.ticket.ticketNumber,
      };
    }
  }

  const sorted = [...row.messages].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const firstClientMessage = sorted.find((message) => message.authorType === 'client');

  const created = await createTicket({
    workspaceId: row.session.workspaceId,
    clientUserId: `public_chat:${row.session.clientEmail}`,
    clientEmail: row.session.clientEmail,
    clientName: row.session.clientName,
    category: row.session.category,
    priority: row.session.category === 'technical_support' ? 'high' : 'normal',
    subject: row.session.subject,
    descriptionHtml: firstClientMessage?.messageHtml || normalizeMessageToHtml('Live chat session converted to ticket.'),
    attachments: firstClientMessage?.attachments || [],
    source: 'api',
    relatedModule: 'website_live_chat',
    actorEmail: input.actorEmail,
  });

  for (const message of sorted) {
    if (message.id === firstClientMessage?.id) continue;

    await addTicketMessage({
      ticketId: created.ticket.id,
      authorType: message.authorType,
      authorId: message.authorId,
      authorName: message.authorName,
      messageHtml: message.messageHtml,
      attachments: message.attachments,
      isInternalNote: false,
      actorEmail: input.actorEmail,
    });
  }

  if (input.closeTicket) {
    await patchTicket({
      ticketId: created.ticket.id,
      status: 'closed',
      actorEmail: input.actorEmail,
    });
  }

  let nextSession: LiveChatSession | null = null;
  await updateAdminStore((current) => {
    const existing = current.cloud.ticketing.liveSessions[input.sessionId];
    if (!existing) return current;

    const now = new Date().toISOString();
    const updated: LiveChatSession = {
      ...existing,
      status: 'converted',
      linkedTicketId: created.ticket.id,
      linkedTicketNumber: created.ticket.ticketNumber,
      convertedAt: now,
      endedAt: existing.endedAt || now,
      updatedAt: now,
    };

    nextSession = updated;

    return {
      ...current,
      cloud: {
        ...current.cloud,
        ticketing: {
          ...current.cloud.ticketing,
          liveSessions: {
            ...current.cloud.ticketing.liveSessions,
            [existing.id]: updated,
          },
        },
      },
    };
  });

  if (!nextSession) return null;

  return {
    session: nextSession,
    ticketId: created.ticket.id,
    ticketNumber: created.ticket.ticketNumber,
  };
}

export async function validatePublicLiveSessionAccess(input: {
  sessionId: string;
  email: string;
}): Promise<{ session: LiveChatSession; messages: LiveChatSessionMessage[] } | null> {
  const row = await getLiveSessionWithMessages(input.sessionId);
  if (!row) return null;
  if (normalizeEmail(row.session.clientEmail) !== normalizeEmail(input.email)) return null;
  return row;
}
