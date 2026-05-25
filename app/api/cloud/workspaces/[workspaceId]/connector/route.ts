import { NextRequest, NextResponse } from 'next/server';
import { getSession, isAdmin, getCurrentWpUser } from '@/lib/auth';
import {
  appendAuditLog,
  type ConnectorStatusKey,
  readAdminStore,
  getWorkspaceConnectorState,
  setWorkspaceConnectorState,
} from '@/lib/adminStore';
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

function generateConnectorToken(): string {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let token = 'marveo_';
  for (let i = 0; i < 32; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

// GET /api/cloud/workspaces/:workspaceId/connector
// Returns current connector status and site metadata for the workspace
export async function GET(
  _req: NextRequest,
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

  const connectorState = await getWorkspaceConnectorState(workspaceId);

  return NextResponse.json({
    workspaceId,
    connectorStatus: connectorState?.connectorStatus ?? 'NOT_CONNECTED',
    connectorToken: connectorState?.connectorToken ?? null,
    connectorConnectedAt: connectorState?.connectorConnectedAt ?? null,
    connectorLastVerificationAttempt: connectorState?.connectorLastVerificationAttempt ?? null,
    connectorVerificationError: connectorState?.connectorVerificationError ?? null,
    connectorSiteMetadata: connectorState?.connectorSiteMetadata ?? null,
    websiteType: workspace.websiteType ?? null,
    contentBaseUrl: workspace.contentBaseUrl ?? null,
  });
}

// POST /api/cloud/workspaces/:workspaceId/connector
// Body: {
//   action: 'generate_token' | 'reset' | 'set_token' | 'update_status',
//   connectorToken?: string,
//   connectorStatus?: ConnectorStatusKey
// }
// Generates or resets the workspace-level connector token
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

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const action = String(body?.action || 'generate_token');

  const validActions = new Set(['generate_token', 'reset', 'set_token', 'update_status']);
  if (!validActions.has(action)) {
    return NextResponse.json({ error: 'Invalid action. Use generate_token, reset, set_token, or update_status.' }, { status: 400 });
  }

  if (action === 'update_status') {
    const connectorStatusRaw = String(body?.connectorStatus || '').trim();
    const validStatuses = new Set<ConnectorStatusKey>([
      'NOT_CONNECTED',
      'TOKEN_GENERATED',
      'PENDING_VERIFICATION',
      'CONNECTED',
      'FAILED',
      'SUPPORT_REQUIRED',
    ]);

    if (!validStatuses.has(connectorStatusRaw as ConnectorStatusKey)) {
      return NextResponse.json({ error: 'Invalid connectorStatus value.' }, { status: 400 });
    }

    const supportRequiredPatch = connectorStatusRaw === 'FAILED' || connectorStatusRaw === 'SUPPORT_REQUIRED'
      ? true
      : connectorStatusRaw === 'CONNECTED'
        ? false
        : undefined;

    await setWorkspaceConnectorState(workspaceId, {
      connectorStatus: connectorStatusRaw as ConnectorStatusKey,
      supportRequired: supportRequiredPatch,
    });

    return NextResponse.json({
      workspaceId,
      connectorStatus: connectorStatusRaw,
      updatedAt: new Date().toISOString(),
    });
  }

  if (action === 'set_token') {
    const providedToken = String(body?.connectorToken || '').trim();
    if (!providedToken) {
      return NextResponse.json({ error: 'connectorToken is required for set_token.' }, { status: 400 });
    }

    await setWorkspaceConnectorState(workspaceId, {
      connectorStatus: 'TOKEN_GENERATED',
      connectorToken: providedToken,
      connectorConnectedAt: undefined,
      connectorLastVerificationAttempt: undefined,
      connectorVerificationError: undefined,
      connectorSiteMetadata: undefined,
    });

    return NextResponse.json({
      workspaceId,
      connectorToken: providedToken,
      connectorStatus: 'TOKEN_GENERATED',
      generatedAt: new Date().toISOString(),
    });
  }

  const newToken = generateConnectorToken();

  await setWorkspaceConnectorState(workspaceId, {
    connectorStatus: 'TOKEN_GENERATED',
    connectorToken: newToken,
    connectorConnectedAt: undefined,
    connectorLastVerificationAttempt: undefined,
    connectorVerificationError: undefined,
    connectorSiteMetadata: undefined,
  });

  const actor = await getCurrentWpUser(auth.session.token);
  await appendAuditLog({
    actorEmail: actor?.email ?? auth.session.user?.user_email ?? 'unknown',
    action: 'cloud.connector.token_generated',
    target: workspaceId,
    details: `Connector token generated for workspace. Action: ${action}`,
  });

  return NextResponse.json({
    workspaceId,
    connectorToken: newToken,
    connectorStatus: 'TOKEN_GENERATED',
    generatedAt: new Date().toISOString(),
  });
}
