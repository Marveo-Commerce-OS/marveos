import { NextRequest, NextResponse } from 'next/server';
import { getSession, getCurrentWpUser, isSuperAdmin } from '@/lib/auth';
import { appendAuditLog, readAdminStore, updateAdminStore } from '@/lib/adminStore';
import { updateStepStatus } from '@/lib/cloudOrchestration';

type OnboardingAction = 'start' | 'complete' | 'fail' | 'retry' | 'rollback';

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

function isAction(value: string): value is OnboardingAction {
  return ['start', 'complete', 'fail', 'retry', 'rollback'].includes(value);
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

  return NextResponse.json({ workspace });
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ workspaceId: string }> },
) {
  const auth = await ensureAdminSession();
  if ('error' in auth) {
    return auth.error;
  }

  const { workspaceId } = await context.params;
  const body = await req.json();

  const step = Number(body?.step || 0);
  const action = String(body?.action || '');
  const errorMessage = body?.error ? String(body.error) : undefined;

  if (!Number.isFinite(step) || step < 1 || step > 11) {
    return NextResponse.json({ error: 'step must be between 1 and 11' }, { status: 400 });
  }

  if (!isAction(action)) {
    return NextResponse.json({ error: 'invalid onboarding action' }, { status: 400 });
  }

  let nextWorkspace = null;

  await updateAdminStore((current) => {
    const workspace = current.cloud.workspaces[workspaceId];
    if (!workspace) {
      return current;
    }

    nextWorkspace = updateStepStatus(workspace, step, action, errorMessage);

    return {
      ...current,
      cloud: {
        ...current.cloud,
        workspaces: {
          ...current.cloud.workspaces,
          [workspaceId]: nextWorkspace,
        },
      },
    };
  });

  if (!nextWorkspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  const actor = await getCurrentWpUser(auth.session.token);
  await appendAuditLog({
    actorEmail: actor?.email ?? auth.session.user?.user_email ?? 'unknown',
    action: `cloud.onboarding.${action}`,
    target: workspaceId,
    details: `Step ${step} transitioned with action=${action}${errorMessage ? ` error=${errorMessage}` : ''}`,
  });

  return NextResponse.json({ workspace: nextWorkspace });
}
