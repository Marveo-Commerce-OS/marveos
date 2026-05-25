import { NextRequest, NextResponse } from 'next/server';
import { getSession, getCurrentWpUser, isSuperAdmin } from '@/lib/auth';
import { appendAuditLog, readAdminStore, updateAdminStore } from '@/lib/adminStore';
import { appendCommand } from '@/lib/cloudOrchestration';
import { getWordPressApiBase } from '@/src/lib/endpoints';
import { requireWorkspaceAccess } from '@/lib/permissions/access';

type CommandType = 'content_mapping_sync' | 'module_activation';

function createAuditId(): string {
  return `audit_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function getConnectorEndpoint(commandType: CommandType): string {
  const base = getWordPressApiBase();
  const normalized = base.replace(/\/$/, '');
  const root = normalized.includes('/wp-json') ? normalized : `${normalized}/wp-json`;

  if (commandType === 'content_mapping_sync') {
    return `${root}/marveo/v1/content-mapping`;
  }

  return `${root}/marveo/v1/modules/activate`;
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

function parseCommandType(value: string): CommandType | null {
  if (value === 'content_mapping_sync' || value === 'module_activation') {
    return value;
  }

  return null;
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
  const workspaceAccess = await requireWorkspaceAccess(workspaceId);
  if ('error' in workspaceAccess) return workspaceAccess.error;

  const store = await readAdminStore();
  const workspace = store.cloud.workspaces[workspaceId];
  if (!workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  const commands = store.cloud.commands
    .filter((item) => item.workspaceId === workspaceId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return NextResponse.json({ commands });
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
  const workspaceAccess = await requireWorkspaceAccess(workspaceId);
  if ('error' in workspaceAccess) return workspaceAccess.error;

  const body = await req.json();

  const commandType = parseCommandType(String(body?.type || ''));
  if (!commandType) {
    return NextResponse.json({ error: 'Invalid command type' }, { status: 400 });
  }

  const payload = (body?.payload && typeof body.payload === 'object')
    ? (body.payload as Record<string, unknown>)
    : {};

  const store = await readAdminStore();
  const workspace = store.cloud.workspaces[workspaceId];
  if (!workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  const auditId = createAuditId();
  const command = appendCommand(workspaceId, commandType, payload, auditId);

  await updateAdminStore((current) => ({
    ...current,
    cloud: {
      ...current.cloud,
      commands: [command, ...current.cloud.commands].slice(0, 1000),
    },
  }));

  const connectorEndpoint = getConnectorEndpoint(commandType);
  let remoteOk = false;
  let remoteError = '';

  try {
    const response = await fetch(connectorEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.session.token}`,
        'X-Marveo-Audit-Id': auditId,
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
        command_id: command.id,
        ...payload,
      }),
      cache: 'no-store',
    });

    remoteOk = response.ok;
    if (!response.ok) {
      const remoteText = await response.text();
      remoteError = remoteText || `HTTP ${response.status}`;
    }
  } catch (error) {
    remoteError = error instanceof Error ? error.message : 'Connector request failed';
  }

  await updateAdminStore((current) => ({
    ...current,
    cloud: {
      ...current.cloud,
      commands: current.cloud.commands.map((item) => {
        if (item.id !== command.id) {
          return item;
        }

        return {
          ...item,
          status: remoteOk ? 'completed' : 'failed',
          attempts: item.attempts + 1,
          updatedAt: new Date().toISOString(),
          lastError: remoteOk ? undefined : remoteError,
        };
      }),
    },
  }));

  const actor = await getCurrentWpUser(auth.session.token);
  await appendAuditLog({
    actorEmail: actor?.email ?? auth.session.user?.user_email ?? 'unknown',
    action: 'cloud.connector.command',
    target: workspaceId,
    details: `Command ${commandType} audit_id=${auditId} status=${remoteOk ? 'completed' : 'failed'}${remoteError ? ` error=${remoteError}` : ''}`,
  });

  if (!remoteOk) {
    return NextResponse.json(
      {
        commandId: command.id,
        auditId,
        status: 'failed',
        error: remoteError || 'Connector command failed',
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    commandId: command.id,
    auditId,
    status: 'completed',
  });
}
