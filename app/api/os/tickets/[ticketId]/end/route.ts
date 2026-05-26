import { NextRequest, NextResponse } from 'next/server';
import { appendAuditLog } from '@/lib/adminStore';
import { requireOSAccess } from '@/lib/permissions/access';
import { getTicketWithMessages, patchTicket, resolveClientWorkspaceScope } from '@/lib/tickets/service';

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
  const email = String(session.user?.user_email ?? session.user?.email ?? '').trim().toLowerCase();
  return { userId, email };
}

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ ticketId: string }> },
) {
  const access = await requireOSAccess();
  if ('error' in access) return access.error;

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

  const patched = await patchTicket({
    ticketId,
    status: 'closed',
    actorEmail: identity.email,
  });

  if (!patched) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });

  await appendAuditLog({
    actorEmail: identity.email,
    action: 'live-chat.client.ended',
    target: `ticket:${ticketId}`,
    details: `workspace=${patched.workspaceId};ticketNumber=${patched.ticketNumber}`,
  });

  return NextResponse.json({ ok: true, ticket: patched });
}
