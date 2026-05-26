import { NextRequest, NextResponse } from 'next/server';
import { appendAuditLog, readAdminStore } from '@/lib/adminStore';
import { requireMasterAccess } from '@/lib/permissions/access';
import { sendPlatformEmailNotification } from '@/lib/emailNotifications';
import {
  assignTicket,
  getTicketWithMessages,
  hasGlobalTicketDeskAccess,
  hasSupportQueueAccess,
} from '@/lib/tickets/service';
import { requireActionPermission } from '@/lib/master/permissions/guards';
import { upsertOperationalAssignment } from '@/lib/master/operations';

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
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

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ ticketId: string }> },
) {
  const actionGuard = await requireActionPermission('tickets', 'assign');
  if ('error' in actionGuard) return actionGuard.error;

  const access = await requireMasterAccess();
  if ('error' in access) return access.error;

  const allowed = await hasSupportQueueAccess(access.roles);
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return badRequest('Invalid JSON body');

  const { ticketId } = await context.params;
  const current = await getTicketWithMessages(ticketId);
  if (!current) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });

  const identity = getSessionIdentity(access.session);
  const canViewAll = hasGlobalTicketDeskAccess(access.roles);
  if (!canViewAll && current.ticket.assignedTo && current.ticket.assignedTo !== identity.userId) {
    return NextResponse.json({ error: 'Forbidden for assigned ticket scope' }, { status: 403 });
  }

  const assignedToRaw = String((body as { assignedTo?: unknown }).assignedTo || '').trim();
  const assignedTo = assignedToRaw || null;

  if (assignedTo) {
    const store = await readAdminStore();
    if (!store.nativeAuth.identities[assignedTo]) {
      return NextResponse.json({ error: 'Assigned support user not found' }, { status: 404 });
    }
  }

  const updated = await assignTicket({
    ticketId,
    assignedTo,
    actorEmail: identity.email,
  });

  if (!updated) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });

  await appendAuditLog({
    actorEmail: identity.email,
    action: 'ticket.master.assigned',
    target: `ticket:${ticketId}`,
    details: `assignedTo=${assignedTo || 'none'};ticketNumber=${updated.ticketNumber}`,
  });

  const store = await readAdminStore();
  const workspaceName = store.cloud.workspaces[updated.workspaceId]?.name || updated.workspaceId;

  await sendPlatformEmailNotification({
    templateKey: 'TICKET_ASSIGNED',
    to: updated.clientEmail,
    variables: {
      clientName: updated.clientName,
      ticketNumber: updated.ticketNumber,
      workspaceName,
      ticketStatus: updated.status,
    },
  });

  if (assignedTo) {
    const assignee = store.nativeAuth.identities[assignedTo];
    const assigneeEmail = String(
      assignee?.email
        || store.platformSettings.email.supportEmail
        || store.platformSettings.email.userOpsEmail
        || '',
    ).trim().toLowerCase();

    if (assigneeEmail && assigneeEmail !== updated.clientEmail) {
      await sendPlatformEmailNotification({
        to: assigneeEmail,
        templateKey: 'TICKET_ASSIGNED_SUPPORT',
        variables: {
          supportOfficerName: assignee?.name || 'Support Officer',
          ticketNumber: updated.ticketNumber,
          workspaceName,
          ticketSubject: updated.subject,
          clientEmail: updated.clientEmail,
        },
      });
    }

    await upsertOperationalAssignment({
      entityType: 'ticket',
      entityId: updated.id,
      workspaceId: updated.workspaceId,
      assignedToUserId: assignedTo,
      assignedToName: assignee?.name || 'Support Officer',
      assignedRole: String(assignee?.roles?.[0] || 'CUSTOMER_SUPPORT'),
      assignedBy: identity.email,
      assignmentStatus: 'assigned',
      metadata: {
        ticketNumber: updated.ticketNumber,
      },
    });
  }

  return NextResponse.json({ ok: true, ticket: updated });
}
