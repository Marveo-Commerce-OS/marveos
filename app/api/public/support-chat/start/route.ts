import { NextRequest, NextResponse } from 'next/server';
import { appendAuditLog, readAdminStore, verifyWorkspaceSupportChatPin } from '@/lib/adminStore';
import { addTicketMessage, applyLiveChatLifecycleRules, createTicket, findLatestUnclosedClientTicket, sanitizeCategory } from '@/lib/tickets/service';
import { enforceRateLimit } from '@/lib/security/requestGuards';
import { resolveCorsHeaders } from '../_cors';

function badRequest(req: NextRequest, message: string) {
  return NextResponse.json({ error: message }, { status: 400, headers: resolveCorsHeaders(req) });
}

function toHtmlMessage(message: string): string {
  const escaped = message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>');
  return `<p>${escaped}</p>`;
}

function normalizeEmail(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: resolveCorsHeaders(req) });
}

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, 'public:support-chat:start');
  if (limited) {
    const headers = resolveCorsHeaders(req);
    for (const [k, v] of Object.entries(headers)) limited.headers.set(k, v);
    return limited;
  }

  const body = (await req.json().catch(() => null)) as {
    workspaceId?: unknown;
    name?: unknown;
    email?: unknown;
    type?: unknown;
    category?: unknown;
    subject?: unknown;
    message?: unknown;
    attachments?: unknown;
    supportPin?: unknown;
    existingTicketAction?: unknown;
  } | null;
  if (!body || typeof body !== 'object') return badRequest(req, 'Invalid JSON body.');

  await applyLiveChatLifecycleRules({ actorEmail: 'system@marveo.local' });

  const requestedWorkspaceId = String(body.workspaceId || '').trim();
  const name = String(body.name || '').trim();
  const email = normalizeEmail(body.email);
  const type = String(body.type || 'enquiry').trim().toLowerCase();
  const mode = type === 'technical' ? 'technical' : 'enquiry';
  const category = sanitizeCategory(body.category ?? (mode === 'technical' ? 'technical_support' : 'general_enquiry'));
  const requiresTechnicalPin = category === 'technical_support';
  const submittedSubject = String(body.subject || '').trim();
  const subject = submittedSubject || (category === 'technical_support' ? 'Technical support request' : 'General enquiry');
  const message = String(body.message || '').trim();

  if (!name) return badRequest(req, 'name is required.');
  if (!email || !isValidEmail(email)) return badRequest(req, 'A valid email is required.');
  if (!message) return badRequest(req, 'message is required.');

  const store = await readAdminStore();
  const defaultWorkspaceId = String(process.env.MARVEO_PUBLIC_CHAT_DEFAULT_WORKSPACE_ID || '').trim();

  const workspaceId = (() => {
    if (requestedWorkspaceId) return requestedWorkspaceId;
    if (defaultWorkspaceId) return defaultWorkspaceId;
    const firstWorkspaceId = Object.keys(store.cloud.workspaces)[0];
    return firstWorkspaceId || '';
  })();

  if (!workspaceId) {
    return badRequest(req, 'No workspace is configured for public chat. Set MARVEO_PUBLIC_CHAT_DEFAULT_WORKSPACE_ID.');
  }

  if (!store.cloud.workspaces[workspaceId]) {
    return NextResponse.json({ error: 'Workspace not found for chat request.' }, { status: 404, headers: resolveCorsHeaders(req) });
  }

  if (requiresTechnicalPin && !requestedWorkspaceId) {
    return badRequest(req, 'workspaceId is required for technical support chat.');
  }

  if (requiresTechnicalPin) {
    const pin = String(body.supportPin || '').trim();
    if (!pin) return badRequest(req, 'supportPin is required for technical support chat.');

    const validPin = await verifyWorkspaceSupportChatPin(workspaceId, pin);
    if (!validPin) {
      return NextResponse.json({ error: 'Invalid support PIN for technical support chat.' }, { status: 403, headers: resolveCorsHeaders(req) });
    }
  }

  const existing = await findLatestUnclosedClientTicket({
    workspaceId,
    clientEmail: email,
    category,
    subject,
  });

  const action = String(body.existingTicketAction || '').trim().toLowerCase();
  if (existing && action !== 'update' && action !== 'create_new') {
    return NextResponse.json({
      error: 'An open ticket with the same subject already exists.',
      requiresExistingTicketAction: true,
      existingTicket: {
        id: existing.id,
        ticketNumber: existing.ticketNumber,
        status: existing.status,
        subject: existing.subject,
        updatedAt: existing.updatedAt,
      },
    }, { status: 409, headers: resolveCorsHeaders(req) });
  }

  if (existing && action === 'update') {
    const updated = await addTicketMessage({
      ticketId: existing.id,
      authorType: 'client',
      authorId: `public_chat:${email}`,
      authorName: name,
      messageHtml: toHtmlMessage(message),
      attachments: body.attachments,
      isInternalNote: false,
      actorEmail: email,
    });

    await appendAuditLog({
      actorEmail: email,
      action: 'live-chat.public.updated-existing',
      target: `ticket:${existing.id}`,
      details: `workspace=${existing.workspaceId};mode=${mode};category=${category}`,
    });

    return NextResponse.json({
      ok: true,
      reusedExistingTicket: true,
      ticket: {
        id: updated.ticket.id,
        ticketNumber: updated.ticket.ticketNumber,
        status: updated.ticket.status,
        category: updated.ticket.category,
      },
    }, { status: 200, headers: resolveCorsHeaders(req) });
  }

  const created = await createTicket({
    workspaceId,
    clientUserId: `public_chat:${email}`,
    clientEmail: email,
    clientName: name,
    category,
    priority: category === 'technical_support' ? 'high' : 'normal',
    subject,
    descriptionHtml: toHtmlMessage(message),
    attachments: body.attachments,
    source: 'api',
    relatedModule: 'website_chat_widget',
    actorEmail: email,
  });

  await appendAuditLog({
    actorEmail: email,
    action: 'live-chat.public.started',
    target: `ticket:${created.ticket.id}`,
    details: `workspace=${workspaceId};mode=${mode};category=${category}`,
  });

  return NextResponse.json({
    ok: true,
    ticket: {
      id: created.ticket.id,
      ticketNumber: created.ticket.ticketNumber,
      status: created.ticket.status,
      category: created.ticket.category,
    },
  }, { status: 201, headers: resolveCorsHeaders(req) });
}
