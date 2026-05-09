import { NextRequest, NextResponse } from 'next/server';
import { getSession, getCurrentWpUser, isSuperAdmin } from '@/lib/auth';
import { appendAuditLog, readAdminStore, updateAdminStore } from '@/lib/adminStore';
import { getWordPressApiBase } from '@/src/lib/endpoints';
import { validateWorkspaceReadiness } from '@/lib/cloudOrchestration';

async function ensureAdminSession() {
  const session = await getSession();
  if (!session) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const superAdmin = await isSuperAdmin(session.token);
  if (!superAdmin) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { session };
}

function deploymentStatusEndpoint(): string {
  const base = getWordPressApiBase().replace(/\/$/, '');
  const root = base.includes('/wp-json') ? base : `${base}/wp-json`;
  return `${root}/marveo/v1/deployment-status`;
}

async function fetchConnectorDeploymentStatus(token: string) {
  try {
    const response = await fetch(deploymentStatusEndpoint(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as {
      setup_completed?: boolean;
      validation_passed?: boolean;
      missing_requirements?: string[];
      validation_states?: Record<string, boolean>;
      recovery_suggestions?: Array<{ suggestion?: string }>;
    };
  } catch {
    return null;
  }
}

function buildRecoveryActions(missingRequirements: string[]): string[] {
  return missingRequirements.map((item) => `Resolve ${item} and re-run launch guard validation.`);
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ workspaceId: string }> },
) {
  const auth = await ensureAdminSession();
  if ('error' in auth) {
    return auth.error;
  }

  const { workspaceId } = await context.params;
  const store = await readAdminStore();
  const workspace = store.cloud.workspaces[workspaceId];

  if (!workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  const connectorStatus = await fetchConnectorDeploymentStatus(auth.session.token);
  const validated = validateWorkspaceReadiness(workspace, connectorStatus || undefined);

  return NextResponse.json({
    workspaceId,
    ready: validated.missingRequirements.length === 0,
    deploymentReadiness: validated.deploymentReadiness,
    missingRequirements: validated.missingRequirements,
    recoveryActions: buildRecoveryActions(validated.missingRequirements),
    connectorStatus,
  });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ workspaceId: string }> },
) {
  const auth = await ensureAdminSession();
  if ('error' in auth) {
    return auth.error;
  }

  const { workspaceId } = await context.params;
  const body = await req.json();
  const launch = Boolean(body?.launch);

  const store = await readAdminStore();
  const workspace = store.cloud.workspaces[workspaceId];
  if (!workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  const connectorStatus = await fetchConnectorDeploymentStatus(auth.session.token);
  const validated = validateWorkspaceReadiness(workspace, connectorStatus || undefined);

  await updateAdminStore((current) => ({
    ...current,
    cloud: {
      ...current.cloud,
      workspaces: {
        ...current.cloud.workspaces,
        [workspaceId]: {
          ...validated,
          status:
            validated.missingRequirements.length === 0
              ? (launch ? 'launched' : 'ready_for_launch')
              : 'blocked',
          updatedAt: new Date().toISOString(),
        },
      },
    },
  }));

  const actor = await getCurrentWpUser(auth.session.token);
  await appendAuditLog({
    actorEmail: actor?.email ?? auth.session.user?.user_email ?? 'unknown',
    action: launch ? 'cloud.launch.attempt' : 'cloud.launch.validate',
    target: workspaceId,
    details: `launch=${launch} ready=${validated.missingRequirements.length === 0} missing=${validated.missingRequirements.join('; ') || 'none'}`,
  });

  if (validated.missingRequirements.length > 0) {
    return NextResponse.json(
      {
        launched: false,
        blocked: true,
        missingRequirements: validated.missingRequirements,
        recoveryActions: buildRecoveryActions(validated.missingRequirements),
      },
      { status: 409 },
    );
  }

  return NextResponse.json({
    launched: launch,
    blocked: false,
    message: launch ? 'Launch approved and status promoted to launched.' : 'Launch validation passed.',
    deploymentReadiness: validated.deploymentReadiness,
  });
}
