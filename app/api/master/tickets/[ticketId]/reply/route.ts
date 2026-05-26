import { NextRequest, NextResponse } from 'next/server';
import { appendAuditLog } from '@/lib/adminStore';
import { requireMasterAccess } from '@/lib/permissions/access';
import {
  addTicketMessage,
  getTicketWithMessages,
  hasGlobalTicketDeskAccess,
  hasSupportQueueAccess,
} from '@/lib/tickets/service';

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

type SessionLike = {
  user?: {
    id?: string | number;
    ID?: string | number;
    user_email?: string;
    email?: string;
    user_display_name?: string;
  } | null;
};

function getSessionIdentity(session: SessionLike) {
  const userId = String(session.user?.id ?? session.user?.ID ?? '').trim();
  const email = String(session.user?.user_email ?? session.user?.email ?? '').trim().toLowerCase() || 'unknown';
  const name = String(session.user?.user_display_name || email || 'Support').trim();
  return { userId, email, name };
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ ticketId: string }> },
) {
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

  const messageHtml = String((body as { messageHtml?: unknown }).messageHtml || '').trim();
  if (!messageHtml) return badRequest('messageHtml is required');

  const created = await addTicketMessage({
    ticketId,
    authorType: 'support',
    authorId: identity.userId,
    authorName: identity.name,
    messageHtml,
    attachments: (body as { attachments?: unknown }).attachments,
    isInternalNote: false,
    actorEmail: identity.email,
  });

  await appendAuditLog({
    actorEmail: identity.email,
    action: 'ticket.master.replied',
    target: `ticket:${ticketId}`,
    details: `workspace=${created.ticket.workspaceId};ticketNumber=${created.ticket.ticketNumber}`,
  });

  return NextResponse.json({ ok: true, ticket: created.ticket, message: created.message }, { status: 201 });
}
