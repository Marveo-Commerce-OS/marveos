import { NextRequest, NextResponse } from 'next/server';
import { updateLiveSessionPresence, validatePublicLiveSessionAccess } from '@/lib/liveChatSessions/service';
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
  const limited = enforceRateLimit(req, 'public:support-chat:sessions:presence');
  if (limited) {
    const headers = resolveCorsHeaders(req);
    for (const [k, v] of Object.entries(headers)) limited.headers.set(k, v);
    return limited;
  }

  const body = (await req.json().catch(() => null)) as {
    email?: unknown;
    online?: unknown;
  } | null;
  if (!body || typeof body !== 'object') return badRequest(req, 'Invalid JSON body.');

  const { sessionId } = await context.params;
  const email = normalizeEmail(body.email);
  const online = Boolean(body.online);

  if (!sessionId) return badRequest(req, 'sessionId is required.');
  if (!email) return badRequest(req, 'email is required.');

  const row = await validatePublicLiveSessionAccess({ sessionId, email });
  if (!row) {
    return NextResponse.json({ error: 'Session not found or forbidden.' }, { status: 404, headers: resolveCorsHeaders(req) });
  }

  const presence = await updateLiveSessionPresence({ sessionId, actor: 'client', online });
  if (!presence) {
    return NextResponse.json({ error: 'Session not found.' }, { status: 404, headers: resolveCorsHeaders(req) });
  }

  return NextResponse.json({ ok: true, presence }, { headers: resolveCorsHeaders(req) });
}
