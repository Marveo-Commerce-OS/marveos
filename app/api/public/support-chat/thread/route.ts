import { NextRequest, NextResponse } from 'next/server';
import { applyLiveChatLifecycleRules, filterClientVisibleMessages, getTicketWithMessages } from '@/lib/tickets/service';
import { enforceRateLimit } from '@/lib/security/requestGuards';
import { resolveCorsHeaders } from '../_cors';

function normalizeEmail(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: resolveCorsHeaders(req) });
}

export async function GET(req: NextRequest) {
  await applyLiveChatLifecycleRules({ actorEmail: 'system@marveo.local' });

  const limited = enforceRateLimit(req, 'public:support-chat:thread');
  if (limited) {
    const headers = resolveCorsHeaders(req);
    for (const [k, v] of Object.entries(headers)) limited.headers.set(k, v);
    return limited;
  }

  const ticketId = String(req.nextUrl.searchParams.get('ticketId') || '').trim();
  const email = normalizeEmail(req.nextUrl.searchParams.get('email'));
  if (!ticketId || !email) {
    return NextResponse.json({ error: 'ticketId and email are required.' }, { status: 400, headers: resolveCorsHeaders(req) });
  }

  const row = await getTicketWithMessages(ticketId);
  if (!row) return NextResponse.json({ error: 'Ticket not found.' }, { status: 404, headers: resolveCorsHeaders(req) });
  if (normalizeEmail(row.ticket.clientEmail) !== email) {
    return NextResponse.json({ error: 'Forbidden for this ticket.' }, { status: 403, headers: resolveCorsHeaders(req) });
  }

  return NextResponse.json({
    ok: true,
    ticket: row.ticket,
    messages: filterClientVisibleMessages(row.messages),
  }, { headers: resolveCorsHeaders(req) });
}
