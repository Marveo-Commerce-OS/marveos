import { NextRequest, NextResponse } from 'next/server';
import { appendAuditLog, readAdminStore } from '@/lib/adminStore';
import { requireMasterAccess, requireWorkspaceAccess } from '@/lib/permissions/access';
import { createSupportOtpChallenge } from '@/lib/support-access/requestSupportSession';
import { sendPlatformEmailNotification } from '@/lib/emailNotifications';

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const master = await requireMasterAccess();
  if ('error' in master) return master.error;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return badRequest('Invalid JSON body');

  const workspaceId = String((body as { workspaceId?: unknown }).workspaceId || '').trim();
  const reason = String((body as { reason?: unknown }).reason || '').trim();
  const clientEmail = String((body as { clientEmail?: unknown }).clientEmail || '').trim().toLowerCase();
  const clientUserId = String((body as { clientUserId?: unknown }).clientUserId || '').trim() || undefined;

  if (!workspaceId) return badRequest('workspaceId is required');
  if (!reason) return badRequest('reason is required');
  if (!clientEmail) return badRequest('clientEmail is required');

  const workspaceAccess = await requireWorkspaceAccess(workspaceId);
  if ('error' in workspaceAccess) return workspaceAccess.error;

  const supportUserId = String(master.session.user?.id ?? master.session.user?.ID ?? '').trim() || 'unknown';
  const challenge = createSupportOtpChallenge({
    workspaceId,
    supportUserId,
    clientUserId,
    clientEmail,
    reason,
  });

  const store = await readAdminStore();
  const appBaseUrl = String(store.platformSettings.email.appBaseUrl || `${req.nextUrl.protocol}//${req.nextUrl.host}`).trim();

  await sendPlatformEmailNotification({
    templateKey: 'PASSWORD_RESET_REQUESTED',
    to: clientEmail,
    variables: {
      userName: clientEmail,
      otpCode: challenge.otpCode,
      appBaseUrl,
      workspaceId,
      reason,
    },
  });

  await appendAuditLog({
    actorEmail: master.session.user?.user_email ?? 'unknown',
    action: 'support.session.otp_requested',
    target: workspaceId,
    details: `challenge=${challenge.challengeId};supportUserId=${supportUserId};clientEmail=${clientEmail}`,
  });

  return NextResponse.json({
    ok: true,
    challengeId: challenge.challengeId,
    expiresAt: challenge.expiresAt,
  });
}
