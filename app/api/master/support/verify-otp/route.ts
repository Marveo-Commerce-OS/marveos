import { NextRequest, NextResponse } from 'next/server';
import { appendAuditLog } from '@/lib/adminStore';
import { requireMasterAccess } from '@/lib/permissions/access';
import { verifySupportOtpAndCreateSession } from '@/lib/support-access/verifySupportOTP';

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const master = await requireMasterAccess();
  if ('error' in master) return master.error;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return badRequest('Invalid JSON body');

  const challengeId = String((body as { challengeId?: unknown }).challengeId || '').trim();
  const otpCode = String((body as { otpCode?: unknown }).otpCode || '').trim();

  if (!challengeId) return badRequest('challengeId is required');
  if (!otpCode) return badRequest('otpCode is required');

  const verified = await verifySupportOtpAndCreateSession({ challengeId, otpCode });
  if (!verified.ok) {
    return NextResponse.json({ ok: false, error: verified.reason }, { status: 403 });
  }

  await appendAuditLog({
    actorEmail: master.session.user?.user_email ?? 'unknown',
    action: 'support.session.issued',
    target: verified.session.workspaceId,
    details: `sessionId=${verified.session.id};expiresAt=${verified.session.expiresAt};supportUserId=${verified.session.supportUserId}`,
  });

  return NextResponse.json({
    ok: true,
    supportSessionToken: verified.token,
    supportSession: verified.session,
  });
}
