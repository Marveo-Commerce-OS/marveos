import { NextRequest, NextResponse } from 'next/server';
import { appendAuditLog, readAdminStore, updateAdminStore } from '@/lib/adminStore';
import { requireMasterAccess } from '@/lib/permissions/access';
import { hasSupportQueueAccess } from '@/lib/tickets/service';

function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function stripTags(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeTitle(value: unknown): string {
  return String(value || '').trim().slice(0, 120);
}

function normalizeHtml(value: unknown): string {
  return String(value || '').trim();
}

export async function GET() {
  const access = await requireMasterAccess();
  if ('error' in access) return access.error;

  const allowed = await hasSupportQueueAccess(access.roles);
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const store = await readAdminStore();
  const definedReplies = Object.values(store.cloud.ticketing.definedReplies || {})
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return NextResponse.json({
    ok: true,
    definedReplies,
  });
}

export async function POST(req: NextRequest) {
  const access = await requireMasterAccess();
  if ('error' in access) return access.error;

  const allowed = await hasSupportQueueAccess(access.roles);
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = (await req.json().catch(() => null)) as {
    id?: unknown;
    title?: unknown;
    contentHtml?: unknown;
    delete?: unknown;
  } | null;
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const actorEmail = String(access.session.user?.user_email || access.session.user?.email || 'unknown').trim().toLowerCase();
  const id = String(body.id || '').trim();
  const isDelete = Boolean(body.delete);

  if (isDelete) {
    if (!id) {
      return NextResponse.json({ error: 'id is required for delete.' }, { status: 400 });
    }

    await updateAdminStore((current) => {
      const nextReplies = { ...(current.cloud.ticketing.definedReplies || {}) };
      delete nextReplies[id];

      return {
        ...current,
        cloud: {
          ...current.cloud,
          ticketing: {
            ...current.cloud.ticketing,
            definedReplies: nextReplies,
          },
        },
      };
    });

    await appendAuditLog({
      actorEmail,
      action: 'defined-reply.deleted',
      target: `defined-reply:${id}`,
      details: 'deleted=true',
    });

    return NextResponse.json({ ok: true, deleted: id });
  }

  const title = normalizeTitle(body.title);
  const contentHtml = normalizeHtml(body.contentHtml);
  if (!title) return NextResponse.json({ error: 'title is required.' }, { status: 400 });
  if (!contentHtml) return NextResponse.json({ error: 'contentHtml is required.' }, { status: 400 });

  const now = new Date().toISOString();
  const replyId = id || createId('dr');
  const contentText = stripTags(contentHtml);

  const updated = await updateAdminStore((current) => {
    const existing = current.cloud.ticketing.definedReplies?.[replyId];
    const next = {
      id: replyId,
      title,
      contentHtml,
      contentText,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    return {
      ...current,
      cloud: {
        ...current.cloud,
        ticketing: {
          ...current.cloud.ticketing,
          definedReplies: {
            ...(current.cloud.ticketing.definedReplies || {}),
            [replyId]: next,
          },
        },
      },
    };
  });

  await appendAuditLog({
    actorEmail,
    action: id ? 'defined-reply.updated' : 'defined-reply.created',
    target: `defined-reply:${replyId}`,
    details: `title=${title}`,
  });

  return NextResponse.json({
    ok: true,
    definedReply: updated.cloud.ticketing.definedReplies[replyId],
  });
}
