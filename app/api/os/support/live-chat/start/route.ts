import { NextRequest, NextResponse } from 'next/server';
import { appendAuditLog, verifyWorkspaceSupportChatPin } from '@/lib/adminStore';
import { requireOSAccess } from '@/lib/permissions/access';
import { addTicketMessage, applyLiveChatLifecycleRules, createTicket, findLatestUnclosedClientTicket, resolveClientWorkspaceScope, sanitizeCategory } from '@/lib/tickets/service';

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

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
  const email = String(session.user?.user_email ?? session.user?.email ?? '').trim().toLowerCase();
  const name = String(session.user?.user_display_name || email || 'Client').trim();
  return { userId, email, name };
}

function toHtmlMessage(message: string): string {
  const escaped = message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>');
  return `<p>${escaped}</p>`;
}

export async function POST(req: NextRequest) {
  const access = await requireOSAccess();
  if ('error' in access) return access.error;

  await applyLiveChatLifecycleRules({ actorEmail: 'system@marveo.local' });

  const body = (await req.json().catch(() => null)) as {
    workspaceId?: unknown;
    type?: unknown;
    category?: unknown;
    subject?: unknown;
    message?: unknown;
    supportPin?: unknown;
    existingTicketAction?: unknown;
  } | null;
  if (!body || typeof body !== 'object') return badRequest('Invalid JSON body.');

  const identity = getSessionIdentity(access.session);
  if (!identity.userId || !identity.email) {
    return NextResponse.json({ error: 'Unable to resolve current client identity.' }, { status: 403 });
  }

  const scope = await resolveClientWorkspaceScope({
    sessionUserId: identity.userId,
    roles: access.roles,
  });
  if (scope.length === 0) {
    return NextResponse.json({ error: 'No workspace scope found for this user.' }, { status: 403 });
  }

  const requestedWorkspaceId = String(body.workspaceId || '').trim();
  const workspaceId = requestedWorkspaceId || scope[0];
  if (!scope.includes(workspaceId)) {
    return NextResponse.json({ error: 'Forbidden for this workspace.' }, { status: 403 });
  }

  const type = String(body.type || 'enquiry').trim().toLowerCase();
  const mode = type === 'technical' ? 'technical' : 'enquiry';
  const category = sanitizeCategory(body.category ?? (mode === 'technical' ? 'technical_support' : 'general_enquiry'));
  const requiresTechnicalPin = category === 'technical_support';
  const submittedSubject = String(body.subject || '').trim();
  const subject = submittedSubject || (category === 'technical_support' ? 'Technical support request' : 'General enquiry');
  const rawMessage = String(body.message || '').trim();
  if (!rawMessage) return badRequest('message is required.');

  if (requiresTechnicalPin) {
    const pin = String(body.supportPin || '').trim();
    if (!pin) return badRequest('supportPin is required for technical support chat.');

    const validPin = await verifyWorkspaceSupportChatPin(workspaceId, pin);
    if (!validPin) {
      return NextResponse.json({ error: 'Invalid support PIN for technical support chat.' }, { status: 403 });
    }
  }

  const existing = await findLatestUnclosedClientTicket({
    workspaceId,
    clientEmail: identity.email,
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
    }, { status: 409 });
  }

  if (existing && action === 'update') {
    const updated = await addTicketMessage({
      ticketId: existing.id,
      authorType: 'client',
      authorId: identity.userId,
      authorName: identity.name,
      messageHtml: toHtmlMessage(rawMessage),
      isInternalNote: false,
      actorEmail: identity.email,
    });

    await appendAuditLog({
      actorEmail: identity.email,
      action: 'live-chat.client.updated-existing',
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
    }, { status: 200 });
  }

  const created = await createTicket({
    workspaceId,
    clientUserId: identity.userId,
    clientEmail: identity.email,
    clientName: identity.name,
    category,
    priority: category === 'technical_support' ? 'high' : 'normal',
    subject,
    descriptionHtml: toHtmlMessage(rawMessage),
    source: 'os',
    relatedModule: 'portal_chat_widget',
    actorEmail: identity.email,
  });

  await appendAuditLog({
    actorEmail: identity.email,
    action: 'live-chat.client.started',
    target: `ticket:${created.ticket.id}`,
    details: `workspace=${created.ticket.workspaceId};mode=${mode};category=${category}`,
  });

  return NextResponse.json({
    ok: true,
    ticket: {
      id: created.ticket.id,
      ticketNumber: created.ticket.ticketNumber,
      status: created.ticket.status,
      category: created.ticket.category,
    },
  }, { status: 201 });
}
