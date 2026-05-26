import { NextRequest, NextResponse } from 'next/server';
import { requireMasterAccess } from '@/lib/permissions/access';
import { hasSupportQueueAccess } from '@/lib/tickets/service';
import { updateLiveSessionPresence } from '@/lib/liveChatSessions/service';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ sessionId: string }> },
) {
  const access = await requireMasterAccess();
  if ('error' in access) return access.error;

  const allowed = await hasSupportQueueAccess(access.roles);
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => null) as { online?: unknown } | null;
  const online = Boolean(body?.online);

  const { sessionId } = await context.params;
  const presence = await updateLiveSessionPresence({
    sessionId,
    actor: 'support',
    online,
  });

  if (!presence) return NextResponse.json({ error: 'Live session not found' }, { status: 404 });
  return NextResponse.json({ ok: true, presence });
}
