import { NextRequest, NextResponse } from 'next/server';
import { appendAuditLog, readAdminStore } from '@/lib/adminStore';
import { requireMasterAccess, requireWorkspaceAccess } from '@/lib/permissions/access';
import { createSupportOtpChallenge } from '@/lib/support-access/requestSupportSession';
import { sendPlatformEmailNotification } from '@/lib/emailNotifications';
import { requireActionPermission } from '@/lib/master/permissions/guards';
import { appendOperationalAuditEvent } from '@/lib/master/operations';

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const actionGuard = await requireActionPermission('supportQueue', 'update');
  if ('error' in actionGuard) return actionGuard.error;

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
  const workspace = store.cloud.workspaces[workspaceId];
  const clientName = String(workspace?.businessProfile?.businessName || clientEmail).trim();
  const supportOfficerName = String(store.nativeAuth.identities[supportUserId]?.name || master.session.user?.display_name || 'Support Officer').trim();
  const supportOfficerEmail = String(
    store.nativeAuth.identities[supportUserId]?.email
      || store.platformSettings.email.supportEmail
      || store.platformSettings.email.userOpsEmail
      || '',
  ).trim().toLowerCase();

  await sendPlatformEmailNotification({
    to: clientEmail,
    templateKey: 'SUPPORT_ACCESS_REQUESTED',
    variables: {
      clientName,
      workspaceName: workspace?.name || workspaceId,
      otpCode: challenge.otpCode,
      expiresAt: challenge.expiresAt,
      reason,
    },
  });

  if (supportOfficerEmail && supportOfficerEmail !== clientEmail) {
    await sendPlatformEmailNotification({
      to: supportOfficerEmail,
      templateKey: 'SUPPORT_ACCESS_REQUESTED_SUPPORT',
      variables: {
        supportOfficerName,
        workspaceName: workspace?.name || workspaceId,
        clientEmail,
        clientName,
        expiresAt: challenge.expiresAt,
        reason,
      },
    });
  }

  await appendAuditLog({
    actorEmail: master.session.user?.user_email ?? 'unknown',
    action: 'support.session.otp_requested',
    target: workspaceId,
    details: `challenge=${challenge.challengeId};supportUserId=${supportUserId};clientEmail=${clientEmail}`,
  });

  await appendOperationalAuditEvent({
    actor: master.session.user?.user_email ?? 'unknown',
    action: 'support.access.requested',
    entity: 'workspace',
    entityId: workspaceId,
    workspaceId,
    metadata: {
      challengeId: challenge.challengeId,
      clientEmail,
      supportUserId,
    },
  });

  return NextResponse.json({
    ok: true,
    challengeId: challenge.challengeId,
    expiresAt: challenge.expiresAt,
  });
}
