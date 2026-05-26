import { NextRequest, NextResponse } from 'next/server';
import { appendAuditLog } from '@/lib/adminStore';
import { addTicketMessage, applyLiveChatLifecycleRules, filterClientVisibleMessages, getTicketWithMessages } from '@/lib/tickets/service';
import { enforceRateLimit } from '@/lib/security/requestGuards';
import { resolveCorsHeaders } from '../_cors';

function badRequest(req: NextRequest, message: string) {
  return NextResponse.json({ error: message }, { status: 400, headers: resolveCorsHeaders(req) });
}

function normalizeEmail(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function toHtmlMessage(message: string): string {
  const escaped = message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>');
  return `<p>${escaped}</p>`;
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: resolveCorsHeaders(req) });
}

export async function POST(req: NextRequest) {
  await applyLiveChatLifecycleRules({ actorEmail: 'system@marveo.local' });

  const limited = enforceRateLimit(req, 'public:support-chat:reply');
  if (limited) {
    const headers = resolveCorsHeaders(req);
    for (const [k, v] of Object.entries(headers)) limited.headers.set(k, v);
    return limited;
  }

  const body = (await req.json().catch(() => null)) as {
    ticketId?: unknown;
    email?: unknown;
    message?: unknown;
    attachments?: unknown;
  } | null;
  if (!body || typeof body !== 'object') return badRequest(req, 'Invalid JSON body.');

  const ticketId = String(body.ticketId || '').trim();
  const email = normalizeEmail(body.email);
  const message = String(body.message || '').trim();
  if (!ticketId) return badRequest(req, 'ticketId is required.');
  if (!email) return badRequest(req, 'email is required.');
  if (!message) return badRequest(req, 'message is required.');

  const row = await getTicketWithMessages(ticketId);
  if (!row) return NextResponse.json({ error: 'Ticket not found.' }, { status: 404, headers: resolveCorsHeaders(req) });
  if (normalizeEmail(row.ticket.clientEmail) !== email) {
    return NextResponse.json({ error: 'Forbidden for this ticket.' }, { status: 403, headers: resolveCorsHeaders(req) });
  }

  const created = await addTicketMessage({
    ticketId,
    authorType: 'client',
    authorId: `public_chat:${email}`,
    authorName: row.ticket.clientName || email,
    messageHtml: toHtmlMessage(message),
    attachments: body.attachments,
    isInternalNote: false,
    actorEmail: email,
  });

  await appendAuditLog({
    actorEmail: email,
    action: 'live-chat.public.replied',
    target: `ticket:${ticketId}`,
    details: `workspace=${created.ticket.workspaceId}`,
  });

  const fresh = await getTicketWithMessages(ticketId);
  return NextResponse.json({
    ok: true,
    ticket: created.ticket,
    messages: filterClientVisibleMessages(fresh?.messages || []),
  }, { headers: resolveCorsHeaders(req) });
}
