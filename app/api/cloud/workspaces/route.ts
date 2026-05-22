import { NextRequest, NextResponse } from 'next/server';
import { getSession, getCurrentWpUser, isAdmin } from '@/lib/auth';
import { appendAuditLog, readAdminStore, updateAdminStore, PLAN_WORKSPACE_LIMITS, type AccountPlan } from '@/lib/adminStore';
import { createWorkspace, deriveClientOwnershipContext } from '@/lib/cloudOrchestration';

const WEBSITE_TYPES = new Set(['NEW_WEBSITE', 'EXISTING_WEBSITE', 'CUSTOM_HEADLESS']);

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
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
  const workspaces = Object.values(store.cloud.workspaces).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const workspaceCount = workspaces.length;
  const workspaceLimit = PLAN_WORKSPACE_LIMITS[store.cloud.accountPlan];
  const remainingWorkspaces = Math.max(0, workspaceLimit - workspaceCount);

  return NextResponse.json({
    workspaces,
    plan: store.cloud.accountPlan,
    workspaceCount,
    workspaceLimit,
    remainingWorkspaces,
  });
}

export async function POST(req: NextRequest) {
  const auth = await ensureAdminSession();
  if ('error' in auth) {
    return auth.error;
  }

  const body = await req.json();
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

  const ownership = deriveClientOwnershipContext({
    name,
    contentBaseUrl,
    businessProfile,
    planId,
    actorEmail: auth.session.user?.user_email ?? auth.session.user?.email ?? '',
  });

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
  const currentPlan: AccountPlan = (planId && planId in PLAN_WORKSPACE_LIMITS ? (planId as AccountPlan) : store.cloud.accountPlan);
  const workspaceCount = Object.values(store.cloud.workspaces).filter((workspace) => {
    const sameOrganization = workspace.clientOrganizationId === ownership.clientOrganizationId;
    const sameSubscription = workspace.clientSubscriptionId === ownership.clientSubscriptionId;
    return sameOrganization || sameSubscription;
  }).length;
  const workspaceLimit = PLAN_WORKSPACE_LIMITS[currentPlan];

  if (workspaceCount >= workspaceLimit) {
    return NextResponse.json(
      {
        error: `Workspace limit reached for this client subscription (${currentPlan}: ${workspaceLimit} workspace${workspaceLimit === 1 ? '' : 's'} max)`,
        hint: 'Create a new client organization/subscription context or upgrade the client plan',
        currentPlan,
        workspaceCount,
        workspaceLimit,
      },
      { status: 402 } // Payment Required
    );
  }

  const workspace = createWorkspace({
    name,
    businessType,
    country,
    businessModel,
    contentSource,
    contentBaseUrl,
    planId,
    websiteType,
    businessProfile,
    selectedTemplateId,
    supportRequired,
    clientOrganizationId: ownership.clientOrganizationId,
    clientOrganizationName: ownership.clientOrganizationName,
    clientSubscriptionId: ownership.clientSubscriptionId,
    clientSubscriptionPlan: currentPlan,
    workspaceOwnership: ownership.workspaceOwnership,
    actorEmail: auth.session.user?.user_email ?? auth.session.user?.email ?? '',
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

  const actor = await getCurrentWpUser(auth.session.token);
  await appendAuditLog({
    actorEmail: actor?.email ?? auth.session.user?.user_email ?? 'unknown',
    action: 'cloud.workspace.created',
    target: workspace.id,
    details: `Workspace created with onboarding step machine initialized (${workspace.name}).`,
  });

  return NextResponse.json({ workspace }, { status: 201 });
}
