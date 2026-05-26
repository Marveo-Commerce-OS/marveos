import { NextRequest, NextResponse } from 'next/server';
import { appendAuditLog } from '@/lib/adminStore';
import { getTicketWithMessages, patchTicket } from '@/lib/tickets/service';
import { enforceRateLimit } from '@/lib/security/requestGuards';
import { resolveCorsHeaders } from '../_cors';

function normalizeEmail(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function badRequest(req: NextRequest, message: string) {
  return NextResponse.json({ error: message }, { status: 400, headers: resolveCorsHeaders(req) });
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: resolveCorsHeaders(req) });
}

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, 'public:support-chat:end');
  if (limited) {
    const headers = resolveCorsHeaders(req);
    for (const [k, v] of Object.entries(headers)) limited.headers.set(k, v);
    return limited;
  }

  const body = (await req.json().catch(() => null)) as {
    ticketId?: unknown;
    email?: unknown;
  } | null;

  if (!body || typeof body !== 'object') return badRequest(req, 'Invalid JSON body.');

  const ticketId = String(body.ticketId || '').trim();
  const email = normalizeEmail(body.email);

  if (!ticketId) return badRequest(req, 'ticketId is required.');
  if (!email) return badRequest(req, 'email is required.');

  const row = await getTicketWithMessages(ticketId);
  if (!row) return NextResponse.json({ error: 'Ticket not found.' }, { status: 404, headers: resolveCorsHeaders(req) });
  if (normalizeEmail(row.ticket.clientEmail) !== email) {
    return NextResponse.json({ error: 'Forbidden for this ticket.' }, { status: 403, headers: resolveCorsHeaders(req) });
  }

  const patched = await patchTicket({
    ticketId,
    status: 'closed',
    actorEmail: email,
  });

  if (!patched) return NextResponse.json({ error: 'Ticket not found.' }, { status: 404, headers: resolveCorsHeaders(req) });

  await appendAuditLog({
    actorEmail: email,
    action: 'live-chat.public.ended',
    target: `ticket:${ticketId}`,
    details: `workspace=${patched.workspaceId};ticketNumber=${patched.ticketNumber}`,
  });

  return NextResponse.json({ ok: true, ticket: patched }, { headers: resolveCorsHeaders(req) });
}
