import { NextRequest, NextResponse } from 'next/server';
import { readAdminStore } from '@/lib/adminStore';
import { getWordPressApiBase } from '@/src/lib/endpoints';

function wpEndpoint(path: string): string {
  const base = getWordPressApiBase().replace(/\/$/, '');
  const root = base.includes('/wp-json') ? base : `${base}/wp-json`;
  return `${root}/marveo/v1/${path}`;
}

async function fetchJson<T>(url: string, fallback: T): Promise<T> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });

    if (!response.ok) {
      return fallback;
    }

    return (await response.json()) as T;
  } catch {
    return fallback;
  }
}

function getActiveSchema<T extends { version: number; status: string; data: unknown }>(schemas: T[]): T | null {
  const active = schemas.find((item) => item.status === 'active');
  if (active) {
    return active;
  }

  return schemas.length > 0 ? schemas[schemas.length - 1] : null;
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ workspaceId: string }> },
) {
  const { workspaceId } = await context.params;
  const store = await readAdminStore();
  const workspace = store.cloud.workspaces[workspaceId];

  if (!workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  const pageSchemas = store.cloud.pageSchemas[workspaceId] ?? [];
  const componentSchemas = store.cloud.componentSchemas[workspaceId] ?? [];

  const activePageSchema = getActiveSchema(pageSchemas);
  const activeComponentSchema = getActiveSchema(componentSchemas);

  const [
    profile,
    settings,
    brand,
    navigation,
    modules,
    products,
    blog,
    seo,
    deploymentStatus,
  ] = await Promise.all([
    fetchJson(wpEndpoint('site-profile'), {}),
    fetchJson(wpEndpoint('settings'), {}),
    fetchJson(wpEndpoint('brand'), {}),
    fetchJson(wpEndpoint('navigation'), []),
    fetchJson(wpEndpoint('modules'), {}),
    fetchJson(wpEndpoint('products'), []),
    fetchJson(wpEndpoint('blog'), []),
    fetchJson(wpEndpoint('seo'), {}),
    fetchJson(wpEndpoint('deployment-status'), {}),
  ]);

  const pages = activePageSchema
    ? ((activePageSchema.data as { pages?: unknown[] }).pages ?? [])
    : await fetchJson(wpEndpoint('pages'), []);

  const components = activeComponentSchema
    ? ((activeComponentSchema.data as { components?: unknown[] }).components ?? [])
    : await fetchJson(wpEndpoint('components'), []);

  return NextResponse.json({
    profile,
    settings,
    brand,
    pages,
    navigation,
    components,
    modules,
    products,
    blog,
    seo,
    deploymentStatus,
    rollout: workspace.rollout,
    schemaMeta: {
      pageSchemaVersion: activePageSchema?.version ?? 0,
      componentSchemaVersion: activeComponentSchema?.version ?? 0,
      channel: workspace.rollout.channel,
    },
  });
}
