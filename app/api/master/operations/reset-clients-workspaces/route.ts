import { NextRequest, NextResponse } from 'next/server';
import { appendAuditLog, readAdminStore, updateAdminStore } from '@/lib/adminStore';
import { getCurrentPlatformUser, getSession, isAdmin, isSuperAdmin } from '@/lib/auth';

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

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

  const canReset = await isSuperAdmin(auth.session.token);
  const store = await readAdminStore();

  return NextResponse.json({
    canReset,
    counts: {
      workspaces: Object.keys(store.cloud.workspaces).length,
      clientOrganizations: Object.keys(store.cloud.commercial.organizations).length,
      clientIdentities: Object.keys(store.cloud.commercial.identities).length,
      subscriptions: Object.keys(store.cloud.commercial.subscriptions).length,
      onboardingSessions: Object.keys(store.cloud.commercial.onboardingSessions).length,
    },
  });
}

export async function POST(req: NextRequest) {
  const auth = await ensureAdminSession();
  if ('error' in auth) return auth.error;

  const superAdmin = await isSuperAdmin(auth.session.token);
  if (!superAdmin) {
    return NextResponse.json({ error: 'Only super admins can purge clients/workspaces.' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const confirmText = String(body?.confirmText || '').trim().toUpperCase();
  if (confirmText !== 'RESET') {
    return badRequest('confirmText must be RESET');
  }

  const before = await readAdminStore();
  const deletedCounts = {
    workspaces: Object.keys(before.cloud.workspaces).length,
    clientOrganizations: Object.keys(before.cloud.commercial.organizations).length,
    clientIdentities: Object.keys(before.cloud.commercial.identities).length,
    subscriptions: Object.keys(before.cloud.commercial.subscriptions).length,
    onboardingSessions: Object.keys(before.cloud.commercial.onboardingSessions).length,
    invoices: Object.keys(before.cloud.commercial.invoices).length,
    billingCycleChangeRequests: Object.keys(before.cloud.commercial.billingCycleChangeRequests).length,
  };

  await updateAdminStore((current) => ({
    ...current,
    cloud: {
      ...current.cloud,
      workspaces: {},
      commercial: {
        ...current.cloud.commercial,
        identities: {},
        organizations: {},
        subscriptions: {},
        onboardingSessions: {},
        invoices: {},
        billingCycleChangeRequests: {},
      },
    },
  }));

  const actor = await getCurrentPlatformUser(auth.session.token);
  await appendAuditLog({
    actorEmail: actor?.email ?? String(auth.session.user?.user_email ?? 'unknown'),
    action: 'master.reset.clients_workspaces',
    target: 'cloud.records',
    details: `workspaces=${deletedCounts.workspaces};organizations=${deletedCounts.clientOrganizations};identities=${deletedCounts.clientIdentities};subscriptions=${deletedCounts.subscriptions};sessions=${deletedCounts.onboardingSessions};invoices=${deletedCounts.invoices};cycleRequests=${deletedCounts.billingCycleChangeRequests}`,
  });

  return NextResponse.json({
    ok: true,
    deletedCounts,
  });
}
