import { NextRequest, NextResponse } from 'next/server';
import { appendAuditLog } from '@/lib/adminStore';
import { requireOSAccess } from '@/lib/permissions/access';
import {
  addTicketMessage,
  getTicketWithMessages,
  resolveClientWorkspaceScope,
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
  const email = String(session.user?.user_email ?? session.user?.email ?? '').trim().toLowerCase();
  const name = String(session.user?.user_display_name || email || 'Client').trim();
  return { userId, email, name };
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ ticketId: string }> },
) {
  const access = await requireOSAccess();
  if ('error' in access) return access.error;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return badRequest('Invalid JSON body');

  if (Boolean((body as { isInternalNote?: unknown }).isInternalNote)) {
    return NextResponse.json({ error: 'Clients cannot create internal notes.' }, { status: 403 });
  }

  const identity = getSessionIdentity(access.session);
  if (!identity.userId || !identity.email) {
    return NextResponse.json({ error: 'Unable to resolve current client identity.' }, { status: 403 });
  }

  const { ticketId } = await context.params;
  const row = await getTicketWithMessages(ticketId);
  if (!row) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });

  const workspaceIds = await resolveClientWorkspaceScope({
    sessionUserId: identity.userId,
    roles: access.roles,
  });
  if (!workspaceIds.includes(row.ticket.workspaceId)) {
    return NextResponse.json({ error: 'Forbidden for this workspace ticket' }, { status: 403 });
  }

  const messageHtml = String((body as { messageHtml?: unknown }).messageHtml || '').trim();
  if (!messageHtml) return badRequest('messageHtml is required');

  const created = await addTicketMessage({
    ticketId,
    authorType: 'client',
    authorId: identity.userId,
    authorName: identity.name,
    messageHtml,
    attachments: (body as { attachments?: unknown }).attachments,
    isInternalNote: false,
    actorEmail: identity.email,
  });

  await appendAuditLog({
    actorEmail: identity.email,
    action: 'ticket.client.replied',
    target: `ticket:${ticketId}`,
    details: `workspace=${created.ticket.workspaceId};ticketNumber=${created.ticket.ticketNumber}`,
  });

  return NextResponse.json({ ok: true, ticket: created.ticket, message: created.message }, { status: 201 });
}
