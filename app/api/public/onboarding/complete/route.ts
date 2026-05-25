import { NextRequest, NextResponse } from 'next/server';
import { readAdminStore } from '@/lib/adminStore';
import { sendPlatformEmailNotification } from '@/lib/emailNotifications';
import { asOptionalTrimmedString, asTrimmedString, enforceRateLimit, parseEmail } from '@/lib/security/requestGuards';

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, 'public:onboarding:complete');
  if (limited) return limited;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return badRequest('Invalid JSON body');

  const onboardingSessionId = asTrimmedString((body as { onboardingSessionId?: unknown }).onboardingSessionId);
  const workspaceId = asTrimmedString((body as { workspaceId?: unknown }).workspaceId);
  const workspaceNameInput = asOptionalTrimmedString((body as { workspaceName?: unknown }).workspaceName);
  const clientNameInput = asOptionalTrimmedString((body as { clientName?: unknown }).clientName);
  const clientEmailInput = parseEmail((body as { clientEmail?: unknown }).clientEmail);

  if (!onboardingSessionId) return badRequest('onboardingSessionId is required');
  if (!workspaceId) return badRequest('workspaceId is required');

  const store = await readAdminStore();
  const onboarding = store.cloud.commercial.onboardingSessions[onboardingSessionId];
  if (!onboarding) {
    return NextResponse.json({ error: 'Onboarding session not found' }, { status: 404 });
  }

  const workspace = store.cloud.workspaces[workspaceId];
  if (!workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  const sameOrg = workspace.clientOrganizationId === onboarding.organizationId;
  const sameSub = workspace.clientSubscriptionId === onboarding.subscriptionId;
  if (!sameOrg && !sameSub) {
    return NextResponse.json({ error: 'Workspace does not match onboarding session' }, { status: 403 });
  }

  const identity = store.cloud.commercial.identities[onboarding.identityId];
  const clientEmail = clientEmailInput || identity?.email || '';
  if (!clientEmail) {
    return NextResponse.json({ error: 'Client email not available' }, { status: 422 });
  }

  const appBaseUrl = (process.env.MARVEO_APP_BASE_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`).replace(/\/$/, '');
  const loginUrl = `${appBaseUrl}/login`;
  const continueSetupUrl = `${appBaseUrl}/setup/mvp?session=${encodeURIComponent(onboardingSessionId)}`;
  const changePasswordUrl = `${appBaseUrl}/password/change`;

  const clientName = clientNameInput
    || workspace.name
    || identity?.name
    || clientEmail;
  const workspaceName = workspaceNameInput || workspace.name || 'Marveo Workspace';

  const clientEmailResult = await sendPlatformEmailNotification({
    templateKey: 'CLIENT_SIGNUP',
    to: clientEmail,
    variables: {
      clientName,
      workspaceName,
      appBaseUrl: loginUrl,
      loginUrl,
      continueSetupUrl,
      changePasswordUrl,
      onboardingSessionId,
      workspaceId,
    },
  });

  const opsRecipients = Array.from(
    new Set(
      [
        store.platformSettings.email.deploymentEmail,
        store.platformSettings.email.userOpsEmail,
        store.platformSettings.email.supportEmail,
      ]
        .map((item) => String(item || '').trim().toLowerCase())
        .filter(Boolean),
    ),
  );

  let opsEmailResult: Awaited<ReturnType<typeof sendPlatformEmailNotification>> | null = null;
  if (opsRecipients.length > 0) {
    opsEmailResult = await sendPlatformEmailNotification({
      templateKey: 'SUPPORT_ASSIGNED',
      to: opsRecipients,
      variables: {
        clientName,
        workspaceName,
        supportOfficerName: 'Onboarding Installer',
        workspaceId,
        onboardingSessionId,
        loginUrl,
        continueSetupUrl,
      },
      fallbackSubject: `New workspace installed: ${workspaceName}`,
    });
  }

  return NextResponse.json({
    ok: true,
    workspaceId,
    onboardingSessionId,
    clientEmail,
    clientEmailSent: Boolean(clientEmailResult.ok),
    opsEmailSent: Boolean(opsEmailResult?.ok),
    loginUrl,
    continueSetupUrl,
    notes: {
      client: clientEmailResult.ok ? 'sent' : `skipped: ${clientEmailResult.reason}`,
      ops: opsEmailResult
        ? (opsEmailResult.ok ? 'sent' : `skipped: ${opsEmailResult.reason}`)
        : 'no-ops-recipients-configured',
    },
  });
}
