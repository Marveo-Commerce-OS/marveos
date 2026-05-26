import { NextRequest, NextResponse } from 'next/server';
import { appendAuditLog, readAdminStore, verifyWorkspaceSupportChatPin } from '@/lib/adminStore';
import {
  addLiveSessionMessage,
  createLiveSession,
  findLatestOpenLiveSession,
  normalizeMessageToHtml,
} from '@/lib/liveChatSessions/service';
import { sanitizeCategory } from '@/lib/tickets/service';
import { enforceRateLimit } from '@/lib/security/requestGuards';
import { resolveCorsHeaders } from '../../_cors';

function badRequest(req: NextRequest, message: string) {
  return NextResponse.json({ error: message }, { status: 400, headers: resolveCorsHeaders(req) });
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
  const limited = enforceRateLimit(req, 'public:support-chat:sessions:start');
  if (limited) {
    const headers = resolveCorsHeaders(req);
    for (const [k, v] of Object.entries(headers)) limited.headers.set(k, v);
    return limited;
  }

  const body = (await req.json().catch(() => null)) as {
    workspaceId?: unknown;
    name?: unknown;
    email?: unknown;
    category?: unknown;
    subject?: unknown;
    message?: unknown;
    attachments?: unknown;
    supportPin?: unknown;
    existingSessionAction?: unknown;
  } | null;

  if (!body || typeof body !== 'object') return badRequest(req, 'Invalid JSON body.');

  const requestedWorkspaceId = String(body.workspaceId || '').trim();
  const name = String(body.name || '').trim();
  const email = normalizeEmail(body.email);
  const category = sanitizeCategory(body.category ?? 'general_enquiry');
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
    return Object.keys(store.cloud.workspaces)[0] || '';
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

  const existing = await findLatestOpenLiveSession({ workspaceId, clientEmail: email, category, subject });
  const action = String(body.existingSessionAction || '').trim().toLowerCase();

  if (existing && action !== 'update' && action !== 'create_new') {
    return NextResponse.json({
      error: 'An open live session with the same category already exists.',
      requiresExistingSessionAction: true,
      existingSession: {
        id: existing.id,
        sessionNumber: existing.sessionNumber,
        status: existing.status,
        subject: existing.subject,
        updatedAt: existing.updatedAt,
      },
    }, { status: 409, headers: resolveCorsHeaders(req) });
  }

  if (existing && action === 'update') {
    const updated = await addLiveSessionMessage({
      sessionId: existing.id,
      authorType: 'client',
      authorId: `public_chat:${email}`,
      authorName: name,
      messageHtml: normalizeMessageToHtml(message),
      attachments: body.attachments,
    });

    await appendAuditLog({
      actorEmail: email,
      action: 'live-chat.session.public.updated-existing',
      target: `live_session:${existing.id}`,
      details: `workspace=${workspaceId};category=${category}`,
    });

    return NextResponse.json({
      ok: true,
      reusedExistingSession: true,
      session: updated.session,
    }, { headers: resolveCorsHeaders(req) });
  }

  const created = await createLiveSession({
    workspaceId,
    clientEmail: email,
    clientName: name,
    category,
    subject,
    initialMessageHtml: normalizeMessageToHtml(message),
    attachments: body.attachments,
  });

  await appendAuditLog({
    actorEmail: email,
    action: 'live-chat.session.public.started',
    target: `live_session:${created.session.id}`,
    details: `workspace=${workspaceId};category=${category}`,
  });

  return NextResponse.json({ ok: true, session: created.session }, { status: 201, headers: resolveCorsHeaders(req) });
}
