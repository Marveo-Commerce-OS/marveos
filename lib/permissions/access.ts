import { NextResponse } from 'next/server';
import { getSession, hasClientWorkspaceAccess, hasInternalPlatformAccess, normalizeRoles } from '@/lib/auth';
import { readAdminStore, type CommercialSubscriptionStatus } from '@/lib/adminStore';

export type AccessResult = {
  session: NonNullable<Awaited<ReturnType<typeof getSession>>>;
  roles: string[];
};

type AccessErrorResult = {
  error: NextResponse;
};

export async function requireMasterAccess(): Promise<AccessResult | AccessErrorResult> {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const roles = normalizeRoles(session.user?.roles);
  if (!hasInternalPlatformAccess(roles)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { session, roles };
}

export async function requireOSAccess(): Promise<AccessResult | AccessErrorResult> {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const roles = normalizeRoles(session.user?.roles);
  if (!hasClientWorkspaceAccess(roles) && !hasInternalPlatformAccess(roles)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { session, roles };
}

export async function requireWorkspaceAccess(workspaceId: string): Promise<(AccessResult & { workspaceId: string }) | AccessErrorResult> {
  if (!workspaceId) {
    return { error: NextResponse.json({ error: 'workspaceId is required' }, { status: 400 }) };
  }

  const base = await requireOSAccess();
  if ('error' in base) return base;

  const store = await readAdminStore();
  const workspace = store.cloud.workspaces[workspaceId];
  if (!workspace) {
    return { error: NextResponse.json({ error: 'Workspace not found' }, { status: 404 }) };
  }

  const internal = hasInternalPlatformAccess(base.roles);
  if (internal) return { ...base, workspaceId };

  const rawUserId = base.session.user?.id ?? base.session.user?.ID;
  const normalizedUserId = String(rawUserId ?? '').trim();
  const userState = normalizedUserId ? store.users[normalizedUserId] : undefined;

  if (userState?.assignedWorkspaceId && userState.assignedWorkspaceId !== workspaceId) {
    return { error: NextResponse.json({ error: 'Forbidden for this workspace' }, { status: 403 }) };
  }

  return { ...base, workspaceId };
}

export async function requireSubscriptionEntitlement(subscriptionId: string): Promise<{ ok: true } | AccessErrorResult> {
  if (!subscriptionId) {
    return { error: NextResponse.json({ error: 'subscriptionId is required' }, { status: 400 }) };
  }

  const store = await readAdminStore();
  const subscription = store.cloud.commercial.subscriptions[subscriptionId];
  if (!subscription) {
    return { error: NextResponse.json({ error: 'Subscription not found' }, { status: 404 }) };
  }

  const status = subscription.status as CommercialSubscriptionStatus;
  const entitled = status === 'TRIAL' || status === 'ACTIVE';
  if (!entitled) {
    return { error: NextResponse.json({ error: 'Subscription entitlement required' }, { status: 402 }) };
  }

  return { ok: true };
}
