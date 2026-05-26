import { NextRequest, NextResponse } from 'next/server';
import { appendAuditLog } from '@/lib/adminStore';
import { applyLiveChatLifecycleRules } from '@/lib/tickets/service';

export async function GET(req: NextRequest) {
  const cronHeader = req.headers.get('x-vercel-cron');
  const authHeader = req.headers.get('authorization');
  const secret = String(process.env.SUPPORT_CHAT_CRON_SECRET || process.env.REPORTS_CRON_SECRET || '').trim();
  const hasBearer = Boolean(secret) && authHeader === `Bearer ${secret}`;

  if (!cronHeader && !hasBearer) {
    return NextResponse.json({ error: 'Unauthorized cron trigger.' }, { status: 401 });
  }

  const result = await applyLiveChatLifecycleRules({ actorEmail: 'system@cron' });

  await appendAuditLog({
    actorEmail: 'system@cron',
    action: 'live-chat.lifecycle.executed',
    target: 'support-chat-lifecycle-cron',
    details: `reminded=${result.reminded};autoClosed=${result.autoClosed}`,
  });

  return NextResponse.json({
    ok: true,
    reminded: result.reminded,
    autoClosed: result.autoClosed,
  });
}
