import { NextRequest, NextResponse } from 'next/server';
import { getSession, getCurrentWpUser, isSuperAdmin } from '@/lib/auth';
import { appendAuditLog, readAdminStore, updateAdminStore } from '@/lib/adminStore';
import { upsertSchemaVersion } from '@/lib/cloudOrchestration';
import type { PageSchemaData, ComponentSchemaData } from '@/lib/adminStore';
import { requireWorkspaceAccess } from '@/lib/permissions/access';

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

  return NextResponse.json({
    pageSchemas: store.cloud.pageSchemas[workspaceId] ?? [],
    componentSchemas: store.cloud.componentSchemas[workspaceId] ?? [],
    rollout: workspace.rollout,
  });
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
  const workspaceAccess = await requireWorkspaceAccess(workspaceId);
  if ('error' in workspaceAccess) return workspaceAccess.error;

  const body = await req.json();

  const pageSchema = body?.pageSchema as PageSchemaData | undefined;
  const componentSchema = body?.componentSchema as ComponentSchemaData | undefined;
  const activate = Boolean(body?.activate ?? false);
  const channel = String(body?.channel || 'stable') === 'beta' ? 'beta' : 'stable';

  if (!pageSchema && !componentSchema) {
    return NextResponse.json({ error: 'At least one schema payload is required' }, { status: 400 });
  }

  let nextPageVersion = 0;
  let nextComponentVersion = 0;

  await updateAdminStore((current) => {
    const workspace = current.cloud.workspaces[workspaceId];
    if (!workspace) {
      return current;
    }

    const existingPageSchemas = current.cloud.pageSchemas[workspaceId] ?? [];
    const existingComponentSchemas = current.cloud.componentSchemas[workspaceId] ?? [];

    const updatedPageSchemas = pageSchema
      ? upsertSchemaVersion(existingPageSchemas, pageSchema, activate)
      : existingPageSchemas;
    const updatedComponentSchemas = componentSchema
      ? upsertSchemaVersion(existingComponentSchemas, componentSchema, activate)
      : existingComponentSchemas;

    nextPageVersion = updatedPageSchemas[updatedPageSchemas.length - 1]?.version || workspace.rollout.pageSchemaVersion;
    nextComponentVersion = updatedComponentSchemas[updatedComponentSchemas.length - 1]?.version || workspace.rollout.componentSchemaVersion;

    return {
      ...current,
      cloud: {
        ...current.cloud,
        pageSchemas: {
          ...current.cloud.pageSchemas,
          [workspaceId]: updatedPageSchemas,
        },
        componentSchemas: {
          ...current.cloud.componentSchemas,
          [workspaceId]: updatedComponentSchemas,
        },
        workspaces: {
          ...current.cloud.workspaces,
          [workspaceId]: {
            ...workspace,
            rollout: {
              ...workspace.rollout,
              pageSchemaVersion: nextPageVersion,
              componentSchemaVersion: nextComponentVersion,
              channel,
              promotedAt: activate ? new Date().toISOString() : workspace.rollout.promotedAt,
            },
            updatedAt: new Date().toISOString(),
          },
        },
      },
    };
  });

  const actor = await getCurrentWpUser(auth.session.token);
  await appendAuditLog({
    actorEmail: actor?.email ?? auth.session.user?.user_email ?? 'unknown',
    action: 'cloud.schemas.updated',
    target: workspaceId,
    details: `page_schema_v=${nextPageVersion} component_schema_v=${nextComponentVersion} channel=${channel} activate=${activate}`,
  });

  const updatedStore = await readAdminStore();

  return NextResponse.json({
    pageSchemas: updatedStore.cloud.pageSchemas[workspaceId] ?? [],
    componentSchemas: updatedStore.cloud.componentSchemas[workspaceId] ?? [],
    rollout: updatedStore.cloud.workspaces[workspaceId]?.rollout,
  });
}
