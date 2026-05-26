import { NextRequest, NextResponse } from 'next/server';
import { appendAuditLog } from '@/lib/adminStore';
import { addLiveSessionMessage, normalizeMessageToHtml, validatePublicLiveSessionAccess } from '@/lib/liveChatSessions/service';
import { enforceRateLimit } from '@/lib/security/requestGuards';
import { resolveCorsHeaders } from '../../../_cors';

function badRequest(req: NextRequest, message: string) {
  return NextResponse.json({ error: message }, { status: 400, headers: resolveCorsHeaders(req) });
}

function normalizeEmail(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: resolveCorsHeaders(req) });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ sessionId: string }> },
) {
  const limited = enforceRateLimit(req, 'public:support-chat:sessions:message');
  if (limited) {
    const headers = resolveCorsHeaders(req);
    for (const [k, v] of Object.entries(headers)) limited.headers.set(k, v);
    return limited;
  }

  const body = (await req.json().catch(() => null)) as {
    email?: unknown;
    message?: unknown;
    attachments?: unknown;
  } | null;

  if (!body || typeof body !== 'object') return badRequest(req, 'Invalid JSON body.');

  const { sessionId } = await context.params;
  const email = normalizeEmail(body.email);
  const message = String(body.message || '').trim();

  if (!sessionId) return badRequest(req, 'sessionId is required.');
  if (!email) return badRequest(req, 'email is required.');
  if (!message) return badRequest(req, 'message is required.');

  const row = await validatePublicLiveSessionAccess({ sessionId, email });
  if (!row) {
    return NextResponse.json({ error: 'Session not found or forbidden.' }, { status: 404, headers: resolveCorsHeaders(req) });
  }

  const updated = await addLiveSessionMessage({
    sessionId,
    authorType: 'client',
    authorId: `public_chat:${email}`,
    authorName: row.session.clientName || email,
    messageHtml: normalizeMessageToHtml(message),
    attachments: body.attachments,
  });

  await appendAuditLog({
    actorEmail: email,
    action: 'live-chat.session.public.replied',
    target: `live_session:${sessionId}`,
    details: `workspace=${updated.session.workspaceId}`,
  });

  return NextResponse.json({ ok: true, session: updated.session, message: updated.message }, { headers: resolveCorsHeaders(req) });
}
