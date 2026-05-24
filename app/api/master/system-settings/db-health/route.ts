import { NextResponse } from 'next/server';
import { getSession, isAdmin } from '@/lib/auth';
import {
  getAdminStoreBackendDiagnostics,
  readAdminStore,
  writeAdminStore,
} from '@/lib/adminStore';

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
