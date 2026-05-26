import { NextRequest, NextResponse } from 'next/server';
import { appendAuditLog } from '@/lib/adminStore';
import { requireMasterAccess } from '@/lib/permissions/access';
import { hasSupportQueueAccess } from '@/lib/tickets/service';
import { convertLiveSessionToTicket } from '@/lib/liveChatSessions/service';

type SessionLike = {
  user?: {
    user_email?: string;
    email?: string;
  } | null;
};

function getActorEmail(session: SessionLike): string {
  return String(session.user?.user_email ?? session.user?.email ?? '').trim().toLowerCase() || 'unknown';
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ sessionId: string }> },
) {
  const access = await requireMasterAccess();
  if ('error' in access) return access.error;

  const allowed = await hasSupportQueueAccess(access.roles);
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => null) as { closeTicket?: unknown } | null;
  const { sessionId } = await context.params;

  const actorEmail = getActorEmail(access.session);
  const converted = await convertLiveSessionToTicket({
    sessionId,
    actorEmail,
    closeTicket: Boolean(body?.closeTicket),
  });

  if (!converted) return NextResponse.json({ error: 'Live session not found' }, { status: 404 });

  await appendAuditLog({
    actorEmail,
    action: 'live-chat.session.converted',
    target: `live_session:${sessionId}`,
    details: `ticket=${converted.ticketNumber}`,
  });

  return NextResponse.json({
    ok: true,
    session: converted.session,
    ticket: {
      id: converted.ticketId,
      ticketNumber: converted.ticketNumber,
    },
  });
}
