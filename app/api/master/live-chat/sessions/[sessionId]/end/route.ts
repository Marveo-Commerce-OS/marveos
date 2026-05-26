import { NextResponse } from 'next/server';
import { appendAuditLog } from '@/lib/adminStore';
import { requireMasterAccess } from '@/lib/permissions/access';
import { hasSupportQueueAccess } from '@/lib/tickets/service';
import { endLiveSession } from '@/lib/liveChatSessions/service';

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
  _req: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const access = await requireMasterAccess();
  if ('error' in access) return access.error;

  const allowed = await hasSupportQueueAccess(access.roles);
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { sessionId } = await context.params;
  const ended = await endLiveSession({ sessionId });
  if (!ended) return NextResponse.json({ error: 'Live session not found' }, { status: 404 });

  const actorEmail = getActorEmail(access.session);
  await appendAuditLog({
    actorEmail,
    action: 'live-chat.session.ended-by-support',
    target: `live_session:${sessionId}`,
    details: `status=${ended.status}`,
  });

  return NextResponse.json({ ok: true, session: ended });
}
