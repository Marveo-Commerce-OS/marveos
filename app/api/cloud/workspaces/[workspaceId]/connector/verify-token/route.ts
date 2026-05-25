import { NextRequest, NextResponse } from 'next/server';
import { getSession, isAdmin } from '@/lib/auth';
import { getWorkspaceConnectorState, readAdminStore } from '@/lib/adminStore';
import { requireWorkspaceAccess } from '@/lib/permissions/access';

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

// POST /api/cloud/workspaces/:workspaceId/connector/verify-token
// Body: { connectorToken: string }
// Verifies the provided connector token matches the workspace token.
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ workspaceId: string }> },
) {
  const auth = await ensureAdminSession();
  if ('error' in auth) return auth.error;

  const { workspaceId } = await context.params;
  const workspaceAccess = await requireWorkspaceAccess(workspaceId);
  if ('error' in workspaceAccess) return workspaceAccess.error;

  const store = await readAdminStore();
  const workspace = store.cloud.workspaces[workspaceId];
  if (!workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const providedToken = String(body?.connectorToken || '').trim();
  if (!providedToken) {
    return NextResponse.json({ error: 'connectorToken is required' }, { status: 400 });
  }

  const state = await getWorkspaceConnectorState(workspaceId);
  const expectedToken = String(state?.connectorToken || '').trim();

  if (!expectedToken) {
    return NextResponse.json({
      workspaceId,
      valid: false,
      reason: 'No connector token has been generated for this workspace.',
    });
  }

  return NextResponse.json({
    workspaceId,
    valid: providedToken === expectedToken,
    reason: providedToken === expectedToken ? 'Token matches workspace connector token.' : 'Provided token does not match workspace token.',
  });
}
