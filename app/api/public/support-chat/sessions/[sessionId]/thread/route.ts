import { NextRequest, NextResponse } from 'next/server';
import { enforceRateLimit } from '@/lib/security/requestGuards';
import { resolveCorsHeaders } from '../../../_cors';
import { validatePublicLiveSessionAccess } from '@/lib/liveChatSessions/service';

function normalizeEmail(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: resolveCorsHeaders(req) });
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ sessionId: string }> },
) {
  const limited = enforceRateLimit(req, 'public:support-chat:sessions:thread');
  if (limited) {
    const headers = resolveCorsHeaders(req);
    for (const [k, v] of Object.entries(headers)) limited.headers.set(k, v);
    return limited;
  }

  const { sessionId } = await context.params;
  const email = normalizeEmail(req.nextUrl.searchParams.get('email'));
  if (!sessionId || !email) {
    return NextResponse.json({ error: 'sessionId and email are required.' }, { status: 400, headers: resolveCorsHeaders(req) });
  }

  const row = await validatePublicLiveSessionAccess({ sessionId, email });
  if (!row) {
    return NextResponse.json({ error: 'Session not found or forbidden.' }, { status: 404, headers: resolveCorsHeaders(req) });
  }

  return NextResponse.json({ ok: true, session: row.session, messages: row.messages }, { headers: resolveCorsHeaders(req) });
}
