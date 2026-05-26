import { NextResponse } from 'next/server';
import { requireActionPermission } from '@/lib/master/permissions/guards';
import {
  getAdminStoreBackendDiagnostics,
  readAdminStore,
  writeAdminStore,
} from '@/lib/adminStore';

async function ensureAdminSession() {
  return requireActionPermission('systemSettings', 'view');
}

export async function GET() {
  const auth = await ensureAdminSession();
  if ('error' in auth) return auth.error;

  const diagnostics = getAdminStoreBackendDiagnostics();

  try {
    const store = await readAdminStore();
    return NextResponse.json({
      ok: true,
      backend: diagnostics.backend,
      postgresConfigured: diagnostics.postgresConfigured,
      postgresHost: diagnostics.postgresHost,
      postgresTable: diagnostics.postgresTable,
      postgresKey: diagnostics.postgresKey,
      hasPlatformSettings: Boolean(store.platformSettings),
      workspaceCount: Object.keys(store.cloud?.workspaces || {}).length,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      backend: diagnostics.backend,
      postgresConfigured: diagnostics.postgresConfigured,
      postgresHost: diagnostics.postgresHost,
      postgresTable: diagnostics.postgresTable,
      postgresKey: diagnostics.postgresKey,
      error: error instanceof Error ? error.message : 'Failed to read store.',
      checkedAt: new Date().toISOString(),
    }, { status: 500 });
  }
}

export async function POST() {
  const auth = await ensureAdminSession();
  if ('error' in auth) return auth.error;

  const diagnostics = getAdminStoreBackendDiagnostics();

  try {
    const current = await readAdminStore();
    await writeAdminStore(current);

    return NextResponse.json({
      ok: true,
      backend: diagnostics.backend,
      postgresConfigured: diagnostics.postgresConfigured,
      postgresHost: diagnostics.postgresHost,
      postgresTable: diagnostics.postgresTable,
      postgresKey: diagnostics.postgresKey,
      smokeWrite: 'passed',
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      backend: diagnostics.backend,
      postgresConfigured: diagnostics.postgresConfigured,
      postgresHost: diagnostics.postgresHost,
      postgresTable: diagnostics.postgresTable,
      postgresKey: diagnostics.postgresKey,
      smokeWrite: 'failed',
      error: error instanceof Error ? error.message : 'Smoke write failed.',
      checkedAt: new Date().toISOString(),
    }, { status: 500 });
  }
}
