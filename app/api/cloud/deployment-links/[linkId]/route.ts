import { NextRequest, NextResponse } from 'next/server';
import { getSession, isSuperAdmin } from '@/lib/auth';
import { readAdminStore, updateAdminStore } from '@/lib/adminStore';

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

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

// GET /api/cloud/deployment-links/[linkId] - Get link details
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ linkId: string }> }
) {
  const { linkId } = await params;

  if (!linkId || typeof linkId !== 'string') {
    return badRequest('linkId is required');
  }

  const store = await readAdminStore();
  const link = store.cloud.deploymentLinks[linkId];

  if (!link) {
    return NextResponse.json({ error: 'Link not found' }, { status: 404 });
  }

  const now = new Date();
  const expiredAt = new Date(link.expiresAt);
  const isExpired = now > expiredAt;

  if (isExpired) {
    return NextResponse.json(
      { error: 'Deployment link has expired' },
      { status: 410 } // Gone
    );
  }

  const workspace = link.workspaceId ? store.cloud.workspaces[link.workspaceId] : null;

  return NextResponse.json({
    link,
    workspace,
    isExpired,
    expiresIn: Math.max(0, Math.floor((expiredAt.getTime() - now.getTime()) / 1000)),
  });
}

// POST /api/cloud/deployment-links/[linkId]/finalize - Mark link as used and start provisioning
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ linkId: string }> }
) {
  const auth = await ensureAdminSession();
  if ('error' in auth) {
    return auth.error;
  }

  const { linkId } = await params;

  if (!linkId || typeof linkId !== 'string') {
    return badRequest('linkId is required');
  }

  const store = await readAdminStore();
  const link = store.cloud.deploymentLinks[linkId];

  if (!link) {
    return NextResponse.json({ error: 'Link not found' }, { status: 404 });
  }

  if (link.used) {
    return NextResponse.json({ error: 'Deployment link has already been used' }, { status: 410 });
  }

  const now = new Date();
  const expiredAt = new Date(link.expiresAt);

  if (now > expiredAt) {
    return NextResponse.json({ error: 'Deployment link has expired' }, { status: 410 });
  }

  if (!link.workspaceId) {
    return badRequest('No workspace associated with this deployment link');
  }

  const workspace = store.cloud.workspaces[link.workspaceId];
  if (!workspace) {
    return badRequest('Associated workspace not found');
  }

  // Mark link as used and update provisioning status
  await updateAdminStore((current) => {
    if (!link.workspaceId) {
      return current;
    }

    const workspaceId = link.workspaceId;

    return {
      ...current,
      cloud: {
        ...current.cloud,
        deploymentLinks: {
          ...current.cloud.deploymentLinks,
          [linkId]: {
            ...current.cloud.deploymentLinks[linkId],
            used: true,
            usedAt: now.toISOString(),
            provisioning: {
              status: 'in_progress' as const,
              currentStep: 1,
              totalSteps: 5,
            },
          },
        },
        workspaces: {
          ...current.cloud.workspaces,
          [workspaceId]: {
            ...workspace,
            status: 'onboarding' as const,
            currentStep: 0,
          },
        },
      },
    };
  });

  // In a real system, this would trigger:
  // 1. Infrastructure provisioning (database, API keys, etc.)
  // 2. DNS configuration
  // 3. SSL certificate generation
  // 4. Webhook registration
  // 5. Content sync trigger

  return NextResponse.json({
    success: true,
    message: 'Deployment link finalized. Provisioning started.',
    linkId,
    workspaceId: link.workspaceId,
    workspace,
    provisioningStatus: 'in_progress',
  });
}
