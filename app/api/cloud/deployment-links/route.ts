import { NextRequest, NextResponse } from 'next/server';
import { getSession, isAdmin } from '@/lib/auth';
import { readAdminStore, updateAdminStore } from '@/lib/adminStore';
import type { DeploymentLink } from '@/lib/adminStore';
import { createWorkspace } from '@/lib/cloudOrchestration';
import { resolveWorkspaceEntitlement } from '@/lib/workspaceEntitlements';
import { v4 as uuid } from 'uuid';

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

// GET /api/cloud/deployment-links - List all deployment links
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

  const links = Object.values(store.cloud.deploymentLinks).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return NextResponse.json({
    accountPlan: store.cloud.accountPlan,
    plan: entitlement.entitlement.planId,
    workspaceCount: entitlement.entitlement.workspaceCount,
    workspaceLimit: entitlement.entitlement.workspaceLimit,
    remainingWorkspaces: entitlement.entitlement.remainingWorkspaces,
    links,
  });
}

// POST /api/cloud/deployment-links - Generate a new deployment link
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

  const store = await readAdminStore();
  const entitlement = resolveWorkspaceEntitlement(store, {
    accountPlan: store.cloud.accountPlan,
  });
  if (!entitlement.ok) {
    return NextResponse.json({ error: entitlement.error }, { status: 503 });
  }

  // Check if workspace limit exceeded
  if (!entitlement.entitlement.hasCapacity) {
    return NextResponse.json(
      {
        error: `Workspace limit reached (${entitlement.entitlement.planId}: ${entitlement.entitlement.workspaceLimit} workspace${entitlement.entitlement.workspaceLimit === 1 ? '' : 's'} max)`,
        currentPlan: entitlement.entitlement.planId,
        workspaceCount: entitlement.entitlement.workspaceCount,
        workspaceLimit: entitlement.entitlement.workspaceLimit,
        remainingWorkspaces: entitlement.entitlement.remainingWorkspaces,
      },
      { status: 402 } // Payment Required
    );
  }

  // Create workspace immediately during deployment link generation
  const workspace = createWorkspace({
    name,
    businessType,
    country,
    businessModel,
    contentSource: contentSource as 'wordpress' | 'nextjs',
    contentBaseUrl,
  });

  // Create deployment link
  const linkId = uuid();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // Link valid for 7 days

  const deploymentLink: DeploymentLink = {
    id: linkId,
    plan: store.cloud.accountPlan,
    createdAt: new Date().toISOString(),
    expiresAt: expiresAt.toISOString(),
    used: false,
    workspaceId: workspace.id,
    provisioning: {
      status: 'pending',
      currentStep: 0,
      totalSteps: 5,
    },
  };

  // Update store with both workspace and deployment link
  await updateAdminStore((current) => ({
    ...current,
    cloud: {
      ...current.cloud,
      workspaces: {
        ...current.cloud.workspaces,
        [workspace.id]: workspace,
      },
      deploymentLinks: {
        ...current.cloud.deploymentLinks,
        [linkId]: deploymentLink,
      },
    },
  }));

  // Generate provisioning URL
  const baseUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000';
  const provisioningUrl = `${baseUrl}/deploy/${linkId}`;

  return NextResponse.json({
    success: true,
    linkId,
    workspaceId: workspace.id,
    provisioningUrl,
    deploymentLink,
    workspace,
  });
}
