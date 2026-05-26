import { NextRequest, NextResponse } from 'next/server';
import { appendAuditLog } from '@/lib/adminStore';
import { requireMasterAccess } from '@/lib/permissions/access';
import { hasSupportQueueAccess } from '@/lib/tickets/service';
import { assignLiveSessionResponder } from '@/lib/liveChatSessions/service';

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
  context: { params: Promise<{ sessionId: string }> },
) {
  const access = await requireMasterAccess();
  if ('error' in access) return access.error;

  const allowed = await hasSupportQueueAccess(access.roles);
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { sessionId } = await context.params;
  const identity = getSessionIdentity(access.session);
  const body = await req.json().catch(() => null) as { responderId?: unknown; responderName?: unknown } | null;

  const responderId = String(body?.responderId || identity.userId).trim();
  const responderName = String(body?.responderName || identity.name || 'Support').trim();
  if (!responderId) return NextResponse.json({ error: 'responderId is required' }, { status: 400 });

  const updated = await assignLiveSessionResponder({ sessionId, responderId, responderName });
  if (!updated) return NextResponse.json({ error: 'Live session not found' }, { status: 404 });

  await appendAuditLog({
    actorEmail: identity.email,
    action: 'live-chat.session.assigned',
    target: `live_session:${sessionId}`,
    details: `responder=${responderId}`,
  });

  return NextResponse.json({ ok: true, session: updated });
}
