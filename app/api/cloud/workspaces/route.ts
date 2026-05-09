import { NextRequest, NextResponse } from 'next/server';
import { getSession, getCurrentWpUser, isAdmin } from '@/lib/auth';
import { appendAuditLog, readAdminStore, updateAdminStore, PLAN_WORKSPACE_LIMITS } from '@/lib/adminStore';
import { createWorkspace } from '@/lib/cloudOrchestration';

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

  if (!name || !businessType || !country || !businessModel || !contentBaseUrl) {
    return badRequest('name, businessType, country, businessModel, and contentBaseUrl are required');
  }

  if (contentSource !== 'wordpress' && contentSource !== 'nextjs') {
    return badRequest('contentSource must be either wordpress or nextjs');
  }

  // Check plan-based workspace limits
  const store = await readAdminStore();
  const currentPlan = store.cloud.accountPlan;
  const workspaceCount = Object.keys(store.cloud.workspaces).length;
  const workspaceLimit = PLAN_WORKSPACE_LIMITS[currentPlan];

  if (workspaceCount >= workspaceLimit) {
    return NextResponse.json(
      {
        error: `Workspace limit reached (${currentPlan}: ${workspaceLimit} workspace${workspaceLimit === 1 ? '' : 's'} max)`,
        hint: 'Use the deployment link flow to provision new workspaces, or upgrade your plan',
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
