import { NextRequest, NextResponse } from 'next/server';
import { appendAuditLog } from '@/lib/adminStore';
import { requireMasterAccess } from '@/lib/permissions/access';
import { revokeSupportSession } from '@/lib/support-access/revokeSupportSession';

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const master = await requireMasterAccess();
  if ('error' in master) return master.error;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return badRequest('Invalid JSON body');

  const sessionId = String((body as { sessionId?: unknown }).sessionId || '').trim();
  if (!sessionId) return badRequest('sessionId is required');

  const revoked = revokeSupportSession({ sessionId });
  if (!revoked.ok) {
    return NextResponse.json({ ok: false, error: revoked.reason }, { status: 404 });
  }

  await appendAuditLog({
    actorEmail: master.session.user?.user_email ?? 'unknown',
    action: 'support.session.revoked',
    target: revoked.session.workspaceId,
    details: `sessionId=${revoked.session.id};revokedAt=${revoked.session.revokedAt}`,
  });

  return NextResponse.json({
    ok: true,
    supportSession: revoked.session,
  });
}
