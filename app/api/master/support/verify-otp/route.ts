import { NextRequest, NextResponse } from 'next/server';
import { appendAuditLog, readAdminStore } from '@/lib/adminStore';
import { requireMasterAccess } from '@/lib/permissions/access';
import { verifySupportOtpAndCreateSession } from '@/lib/support-access/verifySupportOTP';
import { sendPlatformEmailNotification } from '@/lib/emailNotifications';
import { requireActionPermission } from '@/lib/master/permissions/guards';
import { appendOperationalActivityEvent, appendOperationalAuditEvent, upsertOperationalAssignment } from '@/lib/master/operations';

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const actionGuard = await requireActionPermission('supportQueue', 'approve');
  if ('error' in actionGuard) return actionGuard.error;

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

  const store = await readAdminStore();
  const workspace = store.cloud.workspaces[verified.session.workspaceId];
  const supportOfficer = store.nativeAuth.identities[verified.session.supportUserId];
  const clientEmail = verified.session.clientEmail;
  const clientName = String(workspace?.businessProfile?.businessName || clientEmail).trim();
  const supportOfficerName = String(supportOfficer?.name || supportOfficer?.email || 'Support Officer').trim();

  await sendPlatformEmailNotification({
    to: clientEmail,
    templateKey: 'SUPPORT_ACCESS_APPROVED',
    variables: {
      clientName,
      workspaceName: workspace?.name || verified.session.workspaceId,
      expiresAt: verified.session.expiresAt,
      sessionId: verified.session.id,
    },
  });

  const supportOfficerEmail = String(
    supportOfficer?.email
      || store.platformSettings.email.supportEmail
      || store.platformSettings.email.userOpsEmail
      || '',
  ).trim().toLowerCase();

  if (supportOfficerEmail && supportOfficerEmail !== clientEmail) {
    await sendPlatformEmailNotification({
      to: supportOfficerEmail,
      templateKey: 'SUPPORT_ACCESS_APPROVED_SUPPORT',
      variables: {
        supportOfficerName,
        workspaceName: workspace?.name || verified.session.workspaceId,
        clientEmail,
        expiresAt: verified.session.expiresAt,
        sessionId: verified.session.id,
      },
    });
  }

  await appendAuditLog({
    actorEmail: master.session.user?.user_email ?? 'unknown',
    action: 'support.session.issued',
    target: verified.session.workspaceId,
    details: `sessionId=${verified.session.id};expiresAt=${verified.session.expiresAt};supportUserId=${verified.session.supportUserId}`,
  });

  await upsertOperationalAssignment({
    entityType: 'support_session',
    entityId: verified.session.id,
    workspaceId: verified.session.workspaceId,
    assignedToUserId: verified.session.supportUserId,
    assignedToName: supportOfficerName,
    assignedRole: String(supportOfficer?.roles?.[0] || 'CUSTOMER_SUPPORT'),
    assignedBy: master.session.user?.user_email ?? 'unknown',
    assignmentStatus: 'in_progress',
    metadata: {
      expiresAt: verified.session.expiresAt,
      clientEmail,
    },
  });

  await appendOperationalActivityEvent({
    type: 'support_session_started',
    actor: master.session.user?.user_email ?? 'unknown',
    target: verified.session.id,
    workspaceId: verified.session.workspaceId,
    metadata: {
      supportUserId: verified.session.supportUserId,
      clientEmail,
      sessionId: verified.session.id,
    },
  });

  await appendOperationalAuditEvent({
    actor: master.session.user?.user_email ?? 'unknown',
    action: 'support.access.granted',
    entity: 'support_session',
    entityId: verified.session.id,
    workspaceId: verified.session.workspaceId,
    metadata: {
      supportUserId: verified.session.supportUserId,
      clientEmail,
    },
  });

  return NextResponse.json({
    ok: true,
    supportSessionToken: verified.token,
    supportSession: verified.session,
  });
}
