import { NextRequest, NextResponse } from 'next/server';
import { getSession, getCurrentWpUser, isAdmin } from '@/lib/auth';
import { appendAuditLog, readAdminStore, updateAdminStore, type AccountPlan, type WorkspaceOrchestration } from '@/lib/adminStore';
import { createWorkspace, deriveClientOwnershipContext } from '@/lib/cloudOrchestration';
import { sendPlatformEmailNotification } from '@/lib/emailNotifications';
import { resolveWorkspaceEntitlement } from '@/lib/workspaceEntitlements';

const WEBSITE_TYPES = new Set(['NEW_WEBSITE', 'EXISTING_WEBSITE', 'CUSTOM_HEADLESS']);

const INCOMPLETE_WORKSPACE_STATUSES = new Set<WorkspaceOrchestration['status']>(['draft', 'onboarding', 'blocked']);

function isEntitledCommercialSubscriptionStatus(status: string | undefined): boolean {
  return status === 'TRIAL' || status === 'ACTIVE';
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function toLegacyAccountPlan(planId: string | undefined, fallback: AccountPlan): AccountPlan {
  if (planId === 'starter' || planId === 'business' || planId === 'enterprise') {
    return planId;
  }

  if (planId === 'growth') {
    return 'business';
  }

  return fallback;
}

function normalizeValue(value: string | undefined): string {
  return String(value || '').trim().toLowerCase();
}

function normalizeUrl(value: string | undefined): string {
  return normalizeValue(value).replace(/\/+$/, '');
}

function profileFromWorkspace(workspace: WorkspaceOrchestration): Record<string, unknown> {
  const profile = workspace.businessProfile;
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return {};
  return profile as Record<string, unknown>;
}

function findReusableWorkspace(params: {
  workspaces: Record<string, WorkspaceOrchestration>;
  onboardingSessionId?: string;
  clientOrganizationId: string;
  clientSubscriptionId: string;
  businessName: string;
  contactEmail: string;
  contentBaseUrl: string;
}): WorkspaceOrchestration | null {
  const sameScope = (workspace: WorkspaceOrchestration) => {
    const sameOrganization = workspace.clientOrganizationId === params.clientOrganizationId;
    const sameSubscription = workspace.clientSubscriptionId === params.clientSubscriptionId;
    return sameOrganization || sameSubscription;
  };

  const inScope = Object.values(params.workspaces).filter(sameScope);
  if (inScope.length === 0) return null;

  if (params.onboardingSessionId) {
    const sessionMatched = inScope.find((workspace) => {
      const profile = profileFromWorkspace(workspace);
      return normalizeValue(String(profile.onboardingSessionId || '')) === normalizeValue(params.onboardingSessionId);
    });

    if (sessionMatched) {
      return sessionMatched;
    }
  }

  const now = Date.now();
  const recentThresholdMs = 10 * 60 * 1000;
  const normalizedBusinessName = normalizeValue(params.businessName);
  const normalizedContactEmail = normalizeValue(params.contactEmail);
  const normalizedBaseUrl = normalizeUrl(params.contentBaseUrl);

  const candidate = inScope.find((workspace) => {
    if (!INCOMPLETE_WORKSPACE_STATUSES.has(workspace.status)) {
      return false;
    }

    const updatedAtMs = Number(new Date(workspace.updatedAt || workspace.createdAt).getTime());
    const recentlyTouched = Number.isFinite(updatedAtMs) && now - updatedAtMs <= recentThresholdMs;
    if (!recentlyTouched) {
      return false;
    }

    const profile = profileFromWorkspace(workspace);
    const workspaceBusinessName = normalizeValue(String(profile.businessName || workspace.name || ''));
    const workspaceContactEmail = normalizeValue(String(profile.contactEmail || ''));
    const workspaceBaseUrl = normalizeUrl(workspace.contentBaseUrl);

    return workspaceBusinessName === normalizedBusinessName
      && workspaceContactEmail === normalizedContactEmail
      && workspaceBaseUrl === normalizedBaseUrl;
  });

  return candidate || null;
}

async function ensureAdminSession() {
  const session = await getSession();
  if (!session) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const admin = await isAdmin(session.token);
  if (!admin) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { session };
}

export async function GET() {
  const auth = await ensureAdminSession();
  if ('error' in auth) {
    return auth.error;
  }

  const store = await readAdminStore();
  const entitlement = resolveWorkspaceEntitlement(store, {
    accountPlan: store.cloud.accountPlan,
  });
  if (!entitlement.ok) {
    return NextResponse.json({ error: entitlement.error }, { status: 503 });
  }

  const workspaces = Object.values(store.cloud.workspaces).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return NextResponse.json({
    workspaces,
    plan: entitlement.entitlement.planId,
    accountPlan: store.cloud.accountPlan,
    workspaceCount: entitlement.entitlement.workspaceCount,
    workspaceLimit: entitlement.entitlement.workspaceLimit,
    remainingWorkspaces: entitlement.entitlement.remainingWorkspaces,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const auth = await ensureAdminSession();

  const name = String(body?.name || '').trim();
  const businessType = String(body?.businessType || '').trim();
  const country = String(body?.country || '').trim();
  const businessModel = String(body?.businessModel || '').trim();
  const contentSource = String(body?.contentSource || '').trim().toLowerCase();
  const contentBaseUrl = String(body?.contentBaseUrl || '').trim();
  const planId = body?.planId ? String(body.planId).trim() : undefined;
  const websiteTypeRaw = body?.websiteType ? String(body.websiteType).trim() : undefined;
  const selectedTemplateId = body?.selectedTemplateId ? String(body.selectedTemplateId).trim() : undefined;
  const supportRequired = typeof body?.supportRequired === 'boolean' ? body.supportRequired : undefined;
  const businessProfile =
    body?.businessProfile && typeof body.businessProfile === 'object' && !Array.isArray(body.businessProfile)
      ? (body.businessProfile as Record<string, unknown>)
      : undefined;
  const websiteType = websiteTypeRaw && WEBSITE_TYPES.has(websiteTypeRaw)
    ? (websiteTypeRaw as 'NEW_WEBSITE' | 'EXISTING_WEBSITE' | 'CUSTOM_HEADLESS')
    : undefined;
  const onboardingSessionId = String(body?.onboardingSessionId || '').trim();

  let actorEmail = '';
  let ownerName = '';
  let ownership: ReturnType<typeof deriveClientOwnershipContext> | null = null;
  let legacyAccountPlan: AccountPlan;
  let subscriptionPlanId: string | undefined;
  let subscriptionForSessionPlan: string | undefined;

  if ('error' in auth) {
    if (!onboardingSessionId) {
      return auth.error;
    }

    const store = await readAdminStore();
    const onboarding = store.cloud.commercial.onboardingSessions[onboardingSessionId];
    if (!onboarding) {
      return NextResponse.json({ error: 'Invalid onboarding session' }, { status: 401 });
    }

    const subscription = store.cloud.commercial.subscriptions[onboarding.subscriptionId];
    if (!subscription || !isEntitledCommercialSubscriptionStatus(subscription.status)) {
      return NextResponse.json({ error: 'Subscription not entitled for workspace provisioning' }, { status: 402 });
    }

    const identity = store.cloud.commercial.identities[onboarding.identityId];
    const organization = store.cloud.commercial.organizations[onboarding.organizationId];
    actorEmail = identity?.email || '';
    ownerName = String(identity?.name || organization?.name || '').trim();
    subscriptionForSessionPlan = subscription.planId;
    subscriptionPlanId = subscription.planId;
    legacyAccountPlan = toLegacyAccountPlan(subscription.planId, store.cloud.accountPlan);

    ownership = {
      clientOrganizationId: onboarding.organizationId,
      clientOrganizationName: organization?.name || name || 'Client Organization',
      clientSubscriptionId: onboarding.subscriptionId,
      clientSubscriptionPlan: legacyAccountPlan,
      workspaceOwnership: 'client',
    };
  } else {
    const store = await readAdminStore();
    actorEmail = auth.session.user?.user_email ?? auth.session.user?.email ?? '';
    ownership = deriveClientOwnershipContext({
      name,
      contentBaseUrl,
      businessProfile,
      planId,
      actorEmail,
    });
    subscriptionPlanId = planId;
    legacyAccountPlan = toLegacyAccountPlan(planId, store.cloud.accountPlan);
  }

  if (!name || !businessType || !country || !businessModel || !contentBaseUrl) {
    return badRequest('name, businessType, country, businessModel, and contentBaseUrl are required');
  }

  if (contentSource !== 'wordpress' && contentSource !== 'nextjs') {
    return badRequest('contentSource must be either wordpress or nextjs');
  }

  if (websiteTypeRaw && !websiteType) {
    return badRequest('websiteType must be NEW_WEBSITE, EXISTING_WEBSITE, or CUSTOM_HEADLESS');
  }

  const store = await readAdminStore();
  const entitlement = resolveWorkspaceEntitlement(store, {
    subscriptionPlanId,
    accountPlan: legacyAccountPlan,
    scope: {
      clientOrganizationId: ownership.clientOrganizationId,
      clientSubscriptionId: ownership.clientSubscriptionId,
    },
  });
  if (!entitlement.ok) {
    return NextResponse.json({ error: entitlement.error }, { status: 503 });
  }

  if (!entitlement.entitlement.hasCapacity) {
    return NextResponse.json(
      {
        error: `Workspace limit reached for this client subscription (${entitlement.entitlement.planId}: ${entitlement.entitlement.workspaceLimit} workspace${entitlement.entitlement.workspaceLimit === 1 ? '' : 's'} max)`,
        hint: 'Upgrade this client subscription to add more workspace capacity.',
        currentPlan: entitlement.entitlement.planId,
        workspaceCount: entitlement.entitlement.workspaceCount,
        workspaceLimit: entitlement.entitlement.workspaceLimit,
        remainingWorkspaces: entitlement.entitlement.remainingWorkspaces,
      },
      { status: 402 } // Payment Required
    );
  }

  const normalizedBusinessName = String((businessProfile?.businessName as string) || name || '').trim();
  const normalizedContactEmail = String((businessProfile?.contactEmail as string) || actorEmail || '').trim();
  const reusableWorkspace = findReusableWorkspace({
    workspaces: store.cloud.workspaces,
    onboardingSessionId,
    clientOrganizationId: ownership.clientOrganizationId,
    clientSubscriptionId: ownership.clientSubscriptionId,
    businessName: normalizedBusinessName,
    contactEmail: normalizedContactEmail,
    contentBaseUrl,
  });

  if (reusableWorkspace) {
    return NextResponse.json(
      {
        workspace: reusableWorkspace,
        reused: true,
        reason: 'existing_pending_workspace',
        planId: entitlement.entitlement.planId,
        workspaceCount: entitlement.entitlement.workspaceCount,
        workspaceLimit: entitlement.entitlement.workspaceLimit,
        remainingWorkspaces: entitlement.entitlement.remainingWorkspaces,
      },
      { status: 200 },
    );
  }

  const workspaceBusinessProfile = {
    ...(businessProfile || {}),
    ...(onboardingSessionId ? { onboardingSessionId } : {}),
    ...(subscriptionForSessionPlan ? { commercialPlanId: subscriptionForSessionPlan } : {}),
  };

  const workspace = createWorkspace({
    name,
    businessType,
    country,
    businessModel,
    contentSource,
    contentBaseUrl,
    planId: planId || subscriptionPlanId,
    websiteType,
    businessProfile: workspaceBusinessProfile,
    selectedTemplateId,
    supportRequired,
    clientOrganizationId: ownership.clientOrganizationId,
    clientOrganizationName: ownership.clientOrganizationName,
    clientSubscriptionId: ownership.clientSubscriptionId,
    clientSubscriptionPlan: legacyAccountPlan,
    workspaceOwnership: ownership.workspaceOwnership,
    actorEmail,
  });

  await updateAdminStore((current) => ({
    ...current,
    cloud: {
      ...current.cloud,
      workspaces: {
        ...current.cloud.workspaces,
        [workspace.id]: workspace,
      },
    },
  }));

  const actor = 'error' in auth ? null : await getCurrentWpUser(auth.session.token);
  await appendAuditLog({
    actorEmail: actor?.email ?? (actorEmail || 'unknown'),
    action: 'cloud.workspace.created',
    target: workspace.id,
    details: `Workspace created with onboarding step machine initialized (${workspace.name}).`,
  });

  if (onboardingSessionId && actorEmail) {
    const appBaseUrl = (process.env.MARVEO_APP_BASE_URL || req.nextUrl.origin).replace(/\/$/, '');
    const loginUrl = `${appBaseUrl}/login`;
    const continueSetupUrl = `${appBaseUrl}/setup/mvp?session=${encodeURIComponent(onboardingSessionId)}`;
    const changePasswordUrl = `${appBaseUrl}/password/change`;

    await sendPlatformEmailNotification({
      templateKey: 'CLIENT_SIGNUP',
      to: actorEmail,
      variables: {
        clientName: ownerName || workspace.name || actorEmail,
        workspaceName: workspace.name,
        appBaseUrl: loginUrl,
        loginUrl,
        continueSetupUrl,
        changePasswordUrl,
        onboardingSessionId,
        workspaceId: workspace.id,
      },
      fallbackSubject: `Your workspace is ready: ${workspace.name}`,
    });
  }

  return NextResponse.json({ workspace }, { status: 201 });
}
