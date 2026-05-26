import { NextRequest, NextResponse } from 'next/server';
import { appendAuditLog } from '@/lib/adminStore';
import { convertLiveSessionToTicket, validatePublicLiveSessionAccess } from '@/lib/liveChatSessions/service';
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
  const limited = enforceRateLimit(req, 'public:support-chat:sessions:convert');
  if (limited) {
    const headers = resolveCorsHeaders(req);
    for (const [k, v] of Object.entries(headers)) limited.headers.set(k, v);
    return limited;
  }

  const body = (await req.json().catch(() => null)) as { email?: unknown; closeTicket?: unknown } | null;
  if (!body || typeof body !== 'object') return badRequest(req, 'Invalid JSON body.');

  const { sessionId } = await context.params;
  const email = normalizeEmail(body.email);
  if (!sessionId) return badRequest(req, 'sessionId is required.');
  if (!email) return badRequest(req, 'email is required.');

  const row = await validatePublicLiveSessionAccess({ sessionId, email });
  if (!row) {
    return NextResponse.json({ error: 'Session not found or forbidden.' }, { status: 404, headers: resolveCorsHeaders(req) });
  }

  const converted = await convertLiveSessionToTicket({
    sessionId,
    actorEmail: email,
    closeTicket: Boolean(body.closeTicket),
  });

  if (!converted) {
    return NextResponse.json({ error: 'Unable to convert live session.' }, { status: 500, headers: resolveCorsHeaders(req) });
  }

  await appendAuditLog({
    actorEmail: email,
    action: 'live-chat.session.public.converted',
    target: `live_session:${sessionId}`,
    details: `workspace=${converted.session.workspaceId};ticket=${converted.ticketNumber}`,
  });

  return NextResponse.json({
    ok: true,
    session: converted.session,
    ticket: {
      id: converted.ticketId,
      ticketNumber: converted.ticketNumber,
    },
  }, { headers: resolveCorsHeaders(req) });
}
