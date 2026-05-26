import { NextRequest, NextResponse } from 'next/server';
import { appendAuditLog } from '@/lib/adminStore';
import { requireOSAccess } from '@/lib/permissions/access';
import {
  createTicket,
  listTickets,
  resolveClientWorkspaceScope,
  sanitizeCategory,
  sanitizePriority,
  sanitizeStatus,
} from '@/lib/tickets/service';

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

export async function GET(req: NextRequest) {
  const access = await requireOSAccess();
  if ('error' in access) return access.error;

  const identity = getSessionIdentity(access.session);
  const workspaceIds = await resolveClientWorkspaceScope({
    sessionUserId: identity.userId,
    roles: access.roles,
  });

  if (workspaceIds.length === 0) {
    return NextResponse.json({ tickets: [] });
  }

  const { searchParams } = req.nextUrl;
  const tickets = await listTickets({
    workspaceIds,
    status: searchParams.get('status') ? sanitizeStatus(searchParams.get('status')) : '',
    category: searchParams.get('category') ? sanitizeCategory(searchParams.get('category')) : '',
    priority: searchParams.get('priority') ? sanitizePriority(searchParams.get('priority')) : '',
    search: searchParams.get('q') || '',
    includeClosed: searchParams.get('includeClosed') === 'true',
  });

  const includeActiveLiveChat = searchParams.get('includeActiveLiveChat') === 'true';
  const filteredTickets = includeActiveLiveChat
    ? tickets
    : tickets.filter((ticket) => {
        const moduleKey = String(ticket.relatedModule || '').trim().toLowerCase();
        const isLiveChat = moduleKey === 'live_chat'
          || moduleKey === 'website_live_chat'
          || moduleKey === 'portal_chat_widget'
          || moduleKey === 'website_chat_widget';
        if (!isLiveChat) return true;
        return ticket.status === 'closed' || ticket.status === 'resolved';
      });

  return NextResponse.json({ tickets: filteredTickets });
}

export async function POST(req: NextRequest) {
  const access = await requireOSAccess();
  if ('error' in access) return access.error;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return badRequest('Invalid JSON body');

  const identity = getSessionIdentity(access.session);
  if (!identity.userId || !identity.email) {
    return NextResponse.json({ error: 'Unable to resolve current client identity.' }, { status: 403 });
  }

  const workspaceIds = await resolveClientWorkspaceScope({
    sessionUserId: identity.userId,
    roles: access.roles,
  });

  if (workspaceIds.length === 0) {
    return NextResponse.json({ error: 'No workspace scope found for this user.' }, { status: 403 });
  }

  const requestedWorkspaceId = String((body as { workspaceId?: unknown }).workspaceId || '').trim();
  const workspaceId = requestedWorkspaceId || workspaceIds[0];
  if (!workspaceIds.includes(workspaceId)) {
    return NextResponse.json({ error: 'Forbidden for this workspace' }, { status: 403 });
  }

  const subject = String((body as { subject?: unknown }).subject || '').trim();
  const descriptionHtml = String((body as { descriptionHtml?: unknown }).descriptionHtml || '');
  if (!subject) return badRequest('subject is required');
  if (!descriptionHtml.trim()) return badRequest('descriptionHtml is required');

  const created = await createTicket({
    workspaceId,
    clientUserId: identity.userId,
    clientEmail: identity.email,
    clientName: identity.name,
    category: sanitizeCategory((body as { category?: unknown }).category),
    priority: sanitizePriority((body as { priority?: unknown }).priority),
    subject,
    descriptionHtml,
    attachments: (body as { attachments?: unknown }).attachments,
    relatedModule: String((body as { relatedModule?: unknown }).relatedModule || '').trim(),
    source: 'os',
    actorEmail: identity.email,
  });

  await appendAuditLog({
    actorEmail: identity.email,
    action: 'ticket.client.created',
    target: `ticket:${created.ticket.id}`,
    details: `workspace=${created.ticket.workspaceId};ticketNumber=${created.ticket.ticketNumber}`,
  });

  return NextResponse.json({ ok: true, ticket: created.ticket }, { status: 201 });
}
