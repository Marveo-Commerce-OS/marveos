import { NextRequest, NextResponse } from 'next/server';
import { getSession, getCurrentPlatformUser, isAdmin, isSuperAdmin } from '@/lib/auth';
import { appendAuditLog, readAdminStore, updateAdminStore, type CommercialSubscriptionStatus } from '@/lib/adminStore';
import { sendPlatformEmailNotification } from '@/lib/emailNotifications';

type SubscriptionRow = {
  id: string;
  ownerEmail: string;
  ownerName: string | null;
  organizationId: string;
  organizationName: string;
  planId: string;
  billingInterval: string;
  country: string;
  currency: string;
  amount: number;
  status: CommercialSubscriptionStatus;
  trialEndDate: string | null;
  paymentMode: string;
  paymentReference: string | null;
  paymentProvider: string | null;
  updatedAt: string;
};

async function ensureAdminSession() {
  const session = await getSession();
  if (!session) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const allowed = await isAdmin(session.token);
  if (!allowed) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { session };
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function mapSubscriptionRows(store: Awaited<ReturnType<typeof readAdminStore>>): SubscriptionRow[] {
  const commercial = store.cloud.commercial;

  return Object.values(commercial.subscriptions)
    .map((sub) => {
      const identity = commercial.identities[sub.identityId];
      const org = commercial.organizations[sub.organizationId];

      return {
        id: sub.id,
        ownerEmail: identity?.email || 'unknown',
        ownerName: identity?.name || null,
        organizationId: sub.organizationId,
        organizationName: org?.name || sub.organizationId,
        planId: sub.planId,
        billingInterval: sub.billingInterval,
        country: sub.country,
        currency: sub.currency,
        amount: sub.amount,
        status: sub.status,
        trialEndDate: sub.trialEndDate || null,
        paymentMode: sub.paymentMode,
        paymentReference: sub.paymentReference || null,
        paymentProvider: sub.paymentProvider || null,
        updatedAt: sub.updatedAt,
      };
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function GET() {
  const auth = await ensureAdminSession();
  if ('error' in auth) return auth.error;

  const canMutate = await isSuperAdmin(auth.session.token);
  const store = await readAdminStore();
  return NextResponse.json({
    safeBillingActionsEnabled: canMutate,
    canMutateBillingRecords: canMutate,
    subscriptions: mapSubscriptionRows(store),
  });
}

export async function PATCH(req: NextRequest) {
  const auth = await ensureAdminSession();
  if ('error' in auth) return auth.error;

  const canMutate = await isSuperAdmin(auth.session.token);
  if (!canMutate) {
    return NextResponse.json({ error: 'Only super admins can mutate billing records.' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return badRequest('Invalid JSON body');

  const subscriptionId = String((body as { subscriptionId?: unknown }).subscriptionId || '').trim();
  const action = String((body as { action?: unknown }).action || '').trim().toUpperCase();

  const allowedActions = new Set([
    'MARK_TRIAL_EXPIRED',
    'SUSPEND',
    'REACTIVATE',
    'DELETE_SUBSCRIPTION',
    'PURGE_TEST_TRIALS',
    'PURGE_TEST_RESTART',
  ]);
  if (!allowedActions.has(action)) {
    return badRequest('action must be MARK_TRIAL_EXPIRED, SUSPEND, REACTIVATE, DELETE_SUBSCRIPTION, PURGE_TEST_TRIALS, or PURGE_TEST_RESTART');
  }

  if (!subscriptionId && action !== 'PURGE_TEST_TRIALS' && action !== 'PURGE_TEST_RESTART') {
    return badRequest('subscriptionId is required');
  }

  let nextStatus: CommercialSubscriptionStatus | null = null;
  let deletedSubscriptionIds: string[] = [];
  let deletedWorkspaceIds: string[] = [];

  await updateAdminStore((current) => {
    const subscriptions = { ...current.cloud.commercial.subscriptions };
    const onboardingSessions = { ...current.cloud.commercial.onboardingSessions };

    if (action === 'PURGE_TEST_TRIALS' || action === 'PURGE_TEST_RESTART') {
      const candidates = Object.values(subscriptions)
        .filter((item) => item.paymentMode === 'TRIAL')
        .filter((item) => item.status === 'TRIAL' || item.status === 'EXPIRED' || item.status === 'PAST_DUE' || item.status === 'SUSPENDED');

      deletedSubscriptionIds = candidates.map((item) => item.id);
      const deletedSet = new Set(deletedSubscriptionIds);

      for (const id of deletedSubscriptionIds) {
        delete subscriptions[id];
      }

      for (const [sessionId, session] of Object.entries(onboardingSessions)) {
        if (deletedSet.has(session.subscriptionId)) {
          delete onboardingSessions[sessionId];
        }
      }

      if (action === 'PURGE_TEST_RESTART') {
        const workspaces = { ...current.cloud.workspaces };
        for (const workspace of Object.values(workspaces)) {
          if (workspace.clientSubscriptionId && deletedSet.has(workspace.clientSubscriptionId)) {
            deletedWorkspaceIds.push(workspace.id);
            delete workspaces[workspace.id];
          }
        }

        return {
          ...current,
          cloud: {
            ...current.cloud,
            commercial: {
              ...current.cloud.commercial,
              subscriptions,
              onboardingSessions,
            },
            workspaces,
          },
        };
      }

      return {
        ...current,
        cloud: {
          ...current.cloud,
          commercial: {
            ...current.cloud.commercial,
            subscriptions,
            onboardingSessions,
          },
        },
      };
    }

    const existing = subscriptions[subscriptionId];
    if (!existing) return current;

    if (action === 'DELETE_SUBSCRIPTION') {
      const canDelete = existing.paymentMode === 'TRIAL' || existing.status === 'TRIAL' || existing.status === 'EXPIRED';
      if (!canDelete) {
        return current;
      }

      deletedSubscriptionIds = [existing.id];
      delete subscriptions[existing.id];

      for (const [sessionId, session] of Object.entries(onboardingSessions)) {
        if (session.subscriptionId === existing.id) {
          delete onboardingSessions[sessionId];
        }
      }

      return {
        ...current,
        cloud: {
          ...current.cloud,
          commercial: {
            ...current.cloud.commercial,
            subscriptions,
            onboardingSessions,
          },
        },
      };
    }

    if (action === 'MARK_TRIAL_EXPIRED') {
      nextStatus = existing.status === 'TRIAL' ? 'EXPIRED' : existing.status;
    }

    if (action === 'SUSPEND') {
      nextStatus = existing.status === 'SUSPENDED' ? 'SUSPENDED' : 'SUSPENDED';
    }

    if (action === 'REACTIVATE') {
      nextStatus = existing.status === 'ACTIVE' ? 'ACTIVE' : 'ACTIVE';
    }

    const resolvedStatus = nextStatus || existing.status;

    subscriptions[subscriptionId] = {
      ...existing,
      status: resolvedStatus,
      updatedAt: new Date().toISOString(),
    };

    return {
      ...current,
      cloud: {
        ...current.cloud,
        commercial: {
          ...current.cloud.commercial,
          subscriptions,
        },
      },
    };
  });

  const actor = await getCurrentPlatformUser(auth.session.token);
  await appendAuditLog({
    actorEmail: actor?.email ?? String(auth.session.user?.user_email ?? 'unknown'),
    action: 'billing.subscription.status_changed',
    target: action === 'PURGE_TEST_TRIALS' || action === 'PURGE_TEST_RESTART' ? 'subscription:trial-purge' : `subscription:${subscriptionId}`,
    details: `action=${action};status=${nextStatus || 'unchanged'};deleted=${deletedSubscriptionIds.length};deletedWorkspaces=${deletedWorkspaceIds.length}`,
  });

  const refreshed = await readAdminStore();
  const targetSub = refreshed.cloud.commercial.subscriptions[subscriptionId];
  const targetIdentity = targetSub ? refreshed.cloud.commercial.identities[targetSub.identityId] : null;
  if (targetSub && targetIdentity?.email && action !== 'DELETE_SUBSCRIPTION' && action !== 'PURGE_TEST_TRIALS' && action !== 'PURGE_TEST_RESTART') {
    const templateKey = action === 'SUSPEND'
      ? 'BILLING_SUSPENDED'
      : action === 'REACTIVATE'
        ? 'BILLING_REACTIVATED'
        : 'BILLING_NOTICE';

    await sendPlatformEmailNotification({
      templateKey,
      to: targetIdentity.email,
      variables: {
        clientName: targetIdentity.name || targetIdentity.email,
        subscriptionId,
        status: targetSub.status,
        billingEmail: refreshed.platformSettings.email.billingEmail || '',
      },
    });
  }

  return NextResponse.json({
    ok: true,
    subscriptionId,
    deletedCount: deletedSubscriptionIds.length,
    deletedSubscriptionIds,
    deletedWorkspaceCount: deletedWorkspaceIds.length,
    deletedWorkspaceIds,
    subscriptions: mapSubscriptionRows(refreshed),
    safeBillingActionsEnabled: true,
    canMutateBillingRecords: true,
  });
}