import { NextRequest, NextResponse } from 'next/server';
import { readAdminStore } from '@/lib/adminStore';
import { normalizeMarveoRoles } from '@/lib/auth';
import { requireMasterAccess } from '@/lib/permissions/access';
import {
  buildTicketDeskSummary,
  createTicket,
  hasGlobalTicketDeskAccess,
  hasTicketDeskAccess,
  listTickets,
  sanitizeCategory,
  sanitizePriority,
  sanitizeStatus,
} from '@/lib/tickets/service';
import { requireActionPermission } from '@/lib/master/permissions/guards';

type SessionLike = {
  user?: {
    id?: string | number;
    ID?: string | number;
  } | null;
};

function getSessionUserId(session: SessionLike): string {
  return String(session.user?.id ?? session.user?.ID ?? '').trim();
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function supportsTicketAssignment(identity: {
  roles: string[];
  status: string;
  userType: string;
}, userState: { masterRole?: string; active?: boolean; status?: string } | undefined): boolean {
  if (identity.userType !== 'INTERNAL_USER' || identity.status !== 'ACTIVE') return false;
  if (userState?.active === false || userState?.status === 'DISABLED') return false;

  const mergedRoles = new Set<string>([
    ...identity.roles,
    ...(userState?.masterRole ? [userState.masterRole] : []),
  ]);

  const normalizedRoles = Array.from(mergedRoles).map((role) => String(role).trim().toUpperCase());
  return normalizedRoles.includes('CUSTOMER_SUPPORT')
    || normalizedRoles.includes('TECHNICAL_SUPPORT')
    || normalizedRoles.includes('ADMIN')
    || normalizedRoles.includes('SUPER_ADMIN');
}

export async function GET(req: NextRequest) {
  const actionGuard = await requireActionPermission('tickets', 'view');
  if ('error' in actionGuard) return actionGuard.error;

  const access = await requireMasterAccess();
  if ('error' in access) return access.error;

  const allowed = await hasTicketDeskAccess(access.roles);
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const canViewAll = hasGlobalTicketDeskAccess(access.roles);
  const currentUserId = getSessionUserId(access.session);
  const relatedModules = String(searchParams.get('relatedModule') || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  const tickets = await listTickets({
    status: searchParams.get('status') ? sanitizeStatus(searchParams.get('status')) : '',
    category: searchParams.get('category') ? sanitizeCategory(searchParams.get('category')) : '',
    priority: searchParams.get('priority') ? sanitizePriority(searchParams.get('priority')) : '',
    search: searchParams.get('q') || '',
    includeClosed: searchParams.get('includeClosed') === 'true',
    workspaceIds: searchParams.get('workspaceId') ? [String(searchParams.get('workspaceId'))] : undefined,
    assignedTo: canViewAll ? undefined : currentUserId,
    relatedModules,
  });

  const store = await readAdminStore();
  const rows = tickets.map((ticket) => ({
    ...ticket,
    workspaceName: store.cloud.workspaces[ticket.workspaceId]?.name || ticket.workspaceId,
    assignedToName: ticket.assignedTo
      ? (store.nativeAuth.identities[ticket.assignedTo]?.name || ticket.assignedTo)
      : 'Unassigned',
  }));

  const supportUsers = Object.values(store.nativeAuth.identities)
    .filter((identity) => supportsTicketAssignment(identity, store.users[identity.id]))
    .map((identity) => ({
      id: identity.id,
      name: identity.name,
      email: identity.email,
      roles: Array.from(new Set([
        ...identity.roles,
        ...(store.users[identity.id]?.masterRole ? [String(store.users[identity.id].masterRole)] : []),
      ])),
    }));

  const canAdminManageTickets = normalizeMarveoRoles(access.roles).includes('SUPER_ADMIN');

  return NextResponse.json({
    tickets: rows,
    summary: buildTicketDeskSummary(tickets),
    supportUsers,
    canViewAll,
    canAdminManageTickets,
  });
}

export async function POST(req: NextRequest) {
  const actionGuard = await requireActionPermission('tickets', 'create');
  if ('error' in actionGuard) return actionGuard.error;

  const access = await requireMasterAccess();
  if ('error' in access) return access.error;

  const allowed = await hasTicketDeskAccess(access.roles);
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return badRequest('Invalid JSON body');

  const workspaceId = String((body as { workspaceId?: unknown }).workspaceId || '').trim();
  const clientName = String((body as { clientName?: unknown }).clientName || '').trim();
  const clientEmail = String((body as { clientEmail?: unknown }).clientEmail || '').trim().toLowerCase();
  const clientUserId = String((body as { clientUserId?: unknown }).clientUserId || '').trim();
  const subject = String((body as { subject?: unknown }).subject || '').trim();
  const descriptionHtml = String((body as { descriptionHtml?: unknown }).descriptionHtml || '').trim();

  if (!workspaceId) return badRequest('workspaceId is required');
  if (!clientUserId) return badRequest('clientUserId is required and must reference an existing client user');
  if (!isValidEmail(clientEmail)) return badRequest('valid clientEmail is required');
  if (!subject) return badRequest('subject is required');
  if (!descriptionHtml) return badRequest('descriptionHtml is required');

  const store = await readAdminStore();
  if (!store.cloud.workspaces[workspaceId]) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  const clientIdentity = store.nativeAuth.identities[clientUserId];
  if (!clientIdentity || clientIdentity.userType !== 'CLIENT_USER' || clientIdentity.status !== 'ACTIVE') {
    return badRequest('clientUserId must be an active existing client user');
  }

  const normalizedIdentityEmail = String(clientIdentity.email || '').trim().toLowerCase();
  if (!normalizedIdentityEmail || normalizedIdentityEmail !== clientEmail) {
    return badRequest('clientEmail must match the selected client user');
  }

  const userState = store.users[clientUserId];
  const assignedWorkspaceId = String(userState?.assignedWorkspaceId || '').trim();
  const workspace = store.cloud.workspaces[workspaceId];
  const isWorkspaceAssignedClient = assignedWorkspaceId && assignedWorkspaceId === workspaceId;
  const isOrgAssignedClient = Boolean(
    workspace.clientOrganizationId
      && clientIdentity.organizationId
      && workspace.clientOrganizationId === clientIdentity.organizationId,
  );

  if (!isWorkspaceAssignedClient && !isOrgAssignedClient) {
    return badRequest('selected client does not belong to this workspace');
  }

  const created = await createTicket({
    workspaceId,
    clientUserId,
    clientEmail: normalizedIdentityEmail,
    clientName: clientName || clientIdentity.name || 'Client',
    category: sanitizeCategory((body as { category?: unknown }).category),
    priority: sanitizePriority((body as { priority?: unknown }).priority),
    subject,
    descriptionHtml,
    attachments: (body as { attachments?: unknown }).attachments,
    relatedModule: String((body as { relatedModule?: unknown }).relatedModule || '').trim(),
    source: 'master',
    actorEmail: String(access.session?.user?.email || access.session?.user?.user_email || '').trim().toLowerCase(),
  });

  return NextResponse.json({ ok: true, ticket: created.ticket }, { status: 201 });
}
