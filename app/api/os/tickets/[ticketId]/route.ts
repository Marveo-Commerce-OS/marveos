import { NextRequest, NextResponse } from 'next/server';
import { requireOSAccess } from '@/lib/permissions/access';
import {
  filterClientVisibleMessages,
  getTicketWithMessages,
  resolveClientWorkspaceScope,
} from '@/lib/tickets/service';

type SessionLike = {
  user?: {
    id?: string | number;
    ID?: string | number;
  } | null;
};

function getSessionUserId(session: SessionLike): string {
  return String(session.user?.id ?? session.user?.ID ?? '').trim();
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ ticketId: string }> },
) {
  const access = await requireOSAccess();
  if ('error' in access) return access.error;

  const { ticketId } = await context.params;
  const row = await getTicketWithMessages(ticketId);
  if (!row) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });

  const workspaceIds = await resolveClientWorkspaceScope({
    sessionUserId: getSessionUserId(access.session),
    roles: access.roles,
  });
  if (!workspaceIds.includes(row.ticket.workspaceId)) {
    return NextResponse.json({ error: 'Forbidden for this workspace ticket' }, { status: 403 });
  }

  return NextResponse.json({
    ticket: row.ticket,
    messages: filterClientVisibleMessages(row.messages),
  });
}
