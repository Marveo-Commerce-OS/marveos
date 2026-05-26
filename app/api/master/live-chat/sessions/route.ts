import { NextRequest, NextResponse } from 'next/server';
import { readAdminStore } from '@/lib/adminStore';
import { requireMasterAccess } from '@/lib/permissions/access';
import { hasSupportQueueAccess, sanitizeCategory } from '@/lib/tickets/service';
import { listLiveSessions } from '@/lib/liveChatSessions/service';

export async function GET(req: NextRequest) {
  const access = await requireMasterAccess();
  if ('error' in access) return access.error;

  const allowed = await hasSupportQueueAccess(access.roles);
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const search = String(req.nextUrl.searchParams.get('q') || '').trim();
  const status = String(req.nextUrl.searchParams.get('status') || '').trim().toLowerCase() as '';
  const categoryParam = String(req.nextUrl.searchParams.get('category') || '').trim();
  const includeConverted = String(req.nextUrl.searchParams.get('includeConverted') || 'false').trim().toLowerCase() === 'true';

  const sessions = await listLiveSessions({
    status: status as Parameters<typeof listLiveSessions>[0]['status'],
    category: categoryParam ? sanitizeCategory(categoryParam) : '',
    search,
    includeConverted,
  });

  const store = await readAdminStore();

  const hydrated = sessions.map((session) => {
    const messages = Array.isArray(store.cloud.ticketing.liveMessages[session.id])
      ? store.cloud.ticketing.liveMessages[session.id]
      : [];
    const latest = messages.length > 0 ? messages[messages.length - 1] : null;

    return {
      ...session,
      lastMessagePreview: latest?.messageText || '',
      lastMessageAt: latest?.createdAt || session.updatedAt,
      lastMessageAuthorType: latest?.authorType || null,
      messageCount: messages.length,
    };
  });

  return NextResponse.json({ sessions: hydrated });
}
