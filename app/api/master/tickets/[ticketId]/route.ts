import { NextRequest, NextResponse } from 'next/server';
import { appendAuditLog, readAdminStore } from '@/lib/adminStore';
import { normalizeMarveoRoles } from '@/lib/auth';
import { requireMasterAccess } from '@/lib/permissions/access';
import {
  getTicketWithMessages,
  hasGlobalTicketDeskAccess,
  hasTicketDeskAccess,
  patchTicket,
  purgeTicket,
  sanitizePriority,
  sanitizeStatus,
} from '@/lib/tickets/service';

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
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

type SessionLike = {
  user?: {
    id?: string | number;
    ID?: string | number;
    user_email?: string;
    email?: string;
  } | null;
};

function getSessionIdentity(session: SessionLike) {
  const userId = String(session.user?.id ?? session.user?.ID ?? '').trim();
  const email = String(session.user?.user_email ?? session.user?.email ?? '').trim().toLowerCase() || 'unknown';
  return { userId, email };
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ ticketId: string }> },
) {
  const access = await requireMasterAccess();
  if ('error' in access) return access.error;

  const allowed = await hasTicketDeskAccess(access.roles);
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { ticketId } = await context.params;
  const row = await getTicketWithMessages(ticketId);
  if (!row) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });

  const identity = getSessionIdentity(access.session);
  const canViewAll = hasGlobalTicketDeskAccess(access.roles);
  if (!canViewAll && row.ticket.assignedTo && row.ticket.assignedTo !== identity.userId) {
    return NextResponse.json({ error: 'Forbidden for assigned ticket scope' }, { status: 403 });
  }

  const store = await readAdminStore();
  const workspace = store.cloud.workspaces[row.ticket.workspaceId] || null;
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

  const canAdminManageTicket = normalizeMarveoRoles(access.roles).includes('SUPER_ADMIN');

  return NextResponse.json({
    ticket: row.ticket,
    messages: row.messages,
    workspace,
    client: {
      userId: row.ticket.clientUserId,
      email: row.ticket.clientEmail,
      name: row.ticket.clientName,
    },
    assignedToName: row.ticket.assignedTo
      ? (store.nativeAuth.identities[row.ticket.assignedTo]?.name || row.ticket.assignedTo)
      : 'Unassigned',
    supportUsers,
    canAdminManageTicket,
  });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ ticketId: string }> },
) {
  const access = await requireMasterAccess();
  if ('error' in access) return access.error;

  const allowed = await hasTicketDeskAccess(access.roles);
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return badRequest('Invalid JSON body');

  const { ticketId } = await context.params;
  const identity = getSessionIdentity(access.session);

  const current = await getTicketWithMessages(ticketId);
  if (!current) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });

  const canViewAll = hasGlobalTicketDeskAccess(access.roles);
  if (!canViewAll && current.ticket.assignedTo && current.ticket.assignedTo !== identity.userId) {
    return NextResponse.json({ error: 'Forbidden for assigned ticket scope' }, { status: 403 });
  }

  const updated = await patchTicket({
    ticketId,
    status: (body as { status?: unknown }).status ? sanitizeStatus((body as { status?: unknown }).status) : undefined,
    priority: (body as { priority?: unknown }).priority ? sanitizePriority((body as { priority?: unknown }).priority) : undefined,
    actorEmail: identity.email,
  });

  if (!updated) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });

  await appendAuditLog({
    actorEmail: identity.email,
    action: 'ticket.master.updated',
    target: `ticket:${ticketId}`,
    details: `status=${updated.status};priority=${updated.priority}`,
  });

  return NextResponse.json({ ok: true, ticket: updated });
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ ticketId: string }> },
) {
  const access = await requireMasterAccess();
  if ('error' in access) return access.error;

  const isSuperAdmin = normalizeMarveoRoles(access.roles).includes('SUPER_ADMIN');
  if (!isSuperAdmin) {
    return NextResponse.json({ error: 'Only super admin can delete tickets.' }, { status: 403 });
  }

  const { ticketId } = await context.params;
  const removed = await purgeTicket({ ticketId });
  if (!removed) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
  }

  const identity = getSessionIdentity(access.session);
  await appendAuditLog({
    actorEmail: identity.email,
    action: 'ticket.master.purged',
    target: `ticket:${ticketId}`,
    details: `ticketNumber=${removed.ticketNumber};workspace=${removed.workspaceId}`,
  });

  return NextResponse.json({ ok: true, ticketId, ticketNumber: removed.ticketNumber });
}
