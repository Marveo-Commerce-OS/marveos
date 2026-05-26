import { NextRequest, NextResponse } from 'next/server';
import { appendAuditLog } from '@/lib/adminStore';
import { requireMasterAccess } from '@/lib/permissions/access';
import { hasSupportQueueAccess } from '@/lib/tickets/service';
import { addLiveSessionMessage, assignLiveSessionResponder } from '@/lib/liveChatSessions/service';

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

  const body = await req.json().catch(() => null) as { messageHtml?: unknown; attachments?: unknown } | null;
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const messageHtml = String(body.messageHtml || '').trim();
  if (!messageHtml) return NextResponse.json({ error: 'messageHtml is required' }, { status: 400 });

  await assignLiveSessionResponder({
    sessionId,
    responderId: identity.userId,
    responderName: identity.name,
  });

  const updated = await addLiveSessionMessage({
    sessionId,
    authorType: 'support',
    authorId: identity.userId,
    authorName: identity.name,
    messageHtml,
    attachments: body.attachments,
  });

  await appendAuditLog({
    actorEmail: identity.email,
    action: 'live-chat.session.support-replied',
    target: `live_session:${sessionId}`,
    details: `responder=${identity.userId}`,
  });

  return NextResponse.json({ ok: true, session: updated.session, message: updated.message });
}
