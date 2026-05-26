import { NextRequest, NextResponse } from 'next/server';
import { getCurrentPlatformUser, isSuperAdmin, normalizeMarveoRoles } from '@/lib/auth';
import {
  appendAuditLog,
  readAdminStore,
  updateAdminStore,
  type CommercialBillingCycleChangeRequest,
  type CommercialBillingInterval,
  type CommercialPlanConfig,
  type CommercialSubscriptionStatus,
} from '@/lib/adminStore';
import { sendPlatformEmailNotification } from '@/lib/emailNotifications';
import { requireActionPermission } from '@/lib/master/permissions/guards';
import { appendOperationalActivityEvent, appendOperationalAuditEvent } from '@/lib/master/operations';

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

type BillingCycleChangeRow = {
  id: string;
  subscriptionId: string;
  organizationName: string;
  ownerEmail: string;
  currentBillingInterval: CommercialBillingInterval;
  targetBillingInterval: CommercialBillingInterval;
  proratedAmount: number;
  status: CommercialBillingCycleChangeRequest['status'];
  requestedAt: string;
  requestedByRole: string;
};

async function ensureAdminSession() {
  return requireActionPermission('plansBilling', 'view');
}

async function resolveActorContext(token: string) {
  const actor = await getCurrentPlatformUser(token);
  const roles = normalizeMarveoRoles(actor?.roles || []);
  return {
    actor,
    roles,
    isSuper: roles.includes('SUPER_ADMIN'),
    isAdminRole: roles.includes('ADMIN') || roles.includes('SUPER_ADMIN'),
    isBillingManager: roles.includes('BILLING_MANAGER'),
  };
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

function mapBillingCycleRequests(store: Awaited<ReturnType<typeof readAdminStore>>): BillingCycleChangeRow[] {
  const commercial = store.cloud.commercial;

  return Object.values(commercial.billingCycleChangeRequests || {})
    .map((request) => {
      const subscription = commercial.subscriptions[request.subscriptionId];
      const identity = subscription ? commercial.identities[subscription.identityId] : null;
      const organization = subscription ? commercial.organizations[subscription.organizationId] : null;

      return {
        id: request.id,
        subscriptionId: request.subscriptionId,
        organizationName: organization?.name || request.organizationId,
        ownerEmail: identity?.email || 'unknown',
        currentBillingInterval: request.currentBillingInterval,
        targetBillingInterval: request.targetBillingInterval,
        proratedAmount: request.proratedAmount,
        status: request.status,
        requestedAt: request.requestedAt,
        requestedByRole: request.requestedByRole,
      };
    })
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
}

function getPlanRegionPrice(plan: CommercialPlanConfig, country: string, billingInterval: CommercialBillingInterval) {
  const region = plan.regions.find((item) => item.country === country)
    || plan.regions.find((item) => item.country === 'US')
    || plan.regions[0];

  const intervalPrice = billingInterval === 'ANNUAL' ? region.annual : region.monthly;
  return { region, intervalPrice };
}

function calculateProration(params: {
  currentAmount: number;
  targetAmount: number;
  periodStartAt?: string;
  periodEndAt?: string;
}) {
  const startAt = params.periodStartAt ? new Date(params.periodStartAt).getTime() : NaN;
  const endAt = params.periodEndAt ? new Date(params.periodEndAt).getTime() : NaN;
  const now = Date.now();

  if (!Number.isFinite(startAt) || !Number.isFinite(endAt) || endAt <= startAt) {
    return Math.round(params.targetAmount - params.currentAmount);
  }

  const total = endAt - startAt;
  const remaining = Math.max(0, endAt - now);
  const remainingRatio = total > 0 ? remaining / total : 0;
  const currentValue = params.currentAmount * remainingRatio;
  const targetValue = params.targetAmount * remainingRatio;

  return Math.round(targetValue - currentValue);
}

function applyBillingCycleChange(params: {
  current: Awaited<ReturnType<typeof readAdminStore>>;
  subscriptionId: string;
  targetBillingInterval: CommercialBillingInterval;
  actorRole: string;
  actorEmail: string;
  reason?: string;
  direct: boolean;
}) {
  const now = new Date().toISOString();
  const current = params.current;
  const subscription = current.cloud.commercial.subscriptions[params.subscriptionId];
  if (!subscription) {
    return { current, request: null as BillingCycleChangeRow | null };
  }

  const plan = current.cloud.commercial.plans.find((item) => item.id === subscription.planId) || current.cloud.commercial.plans[0];
  const { intervalPrice } = getPlanRegionPrice(plan, subscription.country, params.targetBillingInterval);
  const proratedAmount = calculateProration({
    currentAmount: subscription.amount,
    targetAmount: intervalPrice.amount,
    periodStartAt: subscription.billingPeriodStartAt || subscription.trialStartDate || subscription.createdAt,
    periodEndAt: subscription.billingPeriodEndAt || subscription.trialEndDate || subscription.createdAt,
  });
  const requestId = `cycle_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  const request: CommercialBillingCycleChangeRequest = {
    id: requestId,
    subscriptionId: subscription.id,
    organizationId: subscription.organizationId,
    requestedBy: params.actorEmail,
    requestedByRole: params.actorRole,
    currentBillingInterval: subscription.billingInterval,
    targetBillingInterval: params.targetBillingInterval,
    proratedAmount,
    reason: params.reason,
    status: params.direct ? 'APPLIED' : 'PENDING_APPROVAL',
    requestedAt: now,
    approvedAt: params.direct ? now : undefined,
    approvedBy: params.direct ? params.actorEmail : undefined,
    appliedAt: params.direct ? now : undefined,
    appliedBy: params.direct ? params.actorEmail : undefined,
  };

  current.cloud.commercial.billingCycleChangeRequests[requestId] = request;

  if (params.direct) {
    current.cloud.commercial.subscriptions[subscription.id] = {
      ...subscription,
      billingInterval: params.targetBillingInterval,
      intendedBillingInterval: params.targetBillingInterval,
      amount: intervalPrice.amount,
      setupFee: intervalPrice.setupFee || 0,
      renewalAmount: intervalPrice.amount,
      renewalSetupFee: intervalPrice.setupFee || 0,
      billingPeriodStartAt: now,
      billingPeriodEndAt: params.targetBillingInterval === 'ANNUAL' ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: now,
    };
  }

  return { current, request };
}

export async function GET() {
  const auth = await ensureAdminSession();
  if ('error' in auth) return auth.error;

  const canMutate = await isSuperAdmin(auth.session.token);
  const actor = await resolveActorContext(auth.session.token);
  const store = await readAdminStore();
  return NextResponse.json({
    safeBillingActionsEnabled: canMutate,
    canMutateBillingRecords: canMutate,
    subscriptions: mapSubscriptionRows(store),
    billingCycleChangeRequests: mapBillingCycleRequests(store),
    billingCycleCapabilities: {
      canRequestChange: actor.isBillingManager || actor.isAdminRole || actor.isSuper,
      canApproveChange: actor.isAdminRole,
      canApplyDirectly: actor.isSuper,
    },
  });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireActionPermission('plansBilling', 'approve');
  if ('error' in auth) return auth.error;

  const canMutate = await isSuperAdmin(auth.session.token);
  const actor = await resolveActorContext(auth.session.token);

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
    'REQUEST_BILLING_CYCLE_CHANGE',
    'APPROVE_BILLING_CYCLE_CHANGE',
    'REJECT_BILLING_CYCLE_CHANGE',
    'APPLY_BILLING_CYCLE_CHANGE',
  ]);
  if (!allowedActions.has(action)) {
    return badRequest('action must be MARK_TRIAL_EXPIRED, SUSPEND, REACTIVATE, DELETE_SUBSCRIPTION, PURGE_TEST_TRIALS, PURGE_TEST_RESTART, REQUEST_BILLING_CYCLE_CHANGE, APPROVE_BILLING_CYCLE_CHANGE, REJECT_BILLING_CYCLE_CHANGE, or APPLY_BILLING_CYCLE_CHANGE');
  }

  const cycleChangeAction = action === 'REQUEST_BILLING_CYCLE_CHANGE' || action === 'APPROVE_BILLING_CYCLE_CHANGE' || action === 'REJECT_BILLING_CYCLE_CHANGE' || action === 'APPLY_BILLING_CYCLE_CHANGE';
  if (!cycleChangeAction && !canMutate) {
    return NextResponse.json({ error: 'Only super admins can mutate billing records.' }, { status: 403 });
  }

  if (!subscriptionId && action !== 'PURGE_TEST_TRIALS' && action !== 'PURGE_TEST_RESTART' && action !== 'REQUEST_BILLING_CYCLE_CHANGE' && action !== 'APPROVE_BILLING_CYCLE_CHANGE' && action !== 'REJECT_BILLING_CYCLE_CHANGE' && action !== 'APPLY_BILLING_CYCLE_CHANGE') {
    return badRequest('subscriptionId is required');
  }

  let nextStatus: CommercialSubscriptionStatus | null = null;
  let deletedSubscriptionIds: string[] = [];
  const deletedWorkspaceIds: string[] = [];
  let changedCycleRequestId: string | null = null;

  await updateAdminStore((current) => {
    const subscriptions = { ...current.cloud.commercial.subscriptions };
    const onboardingSessions = { ...current.cloud.commercial.onboardingSessions };
    const billingCycleChangeRequests = { ...current.cloud.commercial.billingCycleChangeRequests };

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
            billingCycleChangeRequests,
          },
        },
      };
    }

    if (action === 'REQUEST_BILLING_CYCLE_CHANGE') {
      if (!(actor.isBillingManager || actor.isAdminRole || actor.isSuper)) {
        return current;
      }

      const targetBillingInterval = String((body as { targetBillingInterval?: unknown }).targetBillingInterval || '').trim().toUpperCase() === 'ANNUAL'
        ? 'ANNUAL'
        : 'MONTHLY';
      const reason = String((body as { reason?: unknown }).reason || '').trim() || undefined;
      const subscription = subscriptions[subscriptionId];
      if (!subscription) return current;

      const plan = current.cloud.commercial.plans.find((item) => item.id === subscription.planId) || current.cloud.commercial.plans[0];
      const { intervalPrice } = getPlanRegionPrice(plan, subscription.country, targetBillingInterval);
      const proratedAmount = calculateProration({
        currentAmount: subscription.amount,
        targetAmount: intervalPrice.amount,
        periodStartAt: subscription.billingPeriodStartAt || subscription.trialStartDate || subscription.createdAt,
        periodEndAt: subscription.billingPeriodEndAt || subscription.trialEndDate || subscription.createdAt,
      });

      const requestId = `cycle_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      billingCycleChangeRequests[requestId] = {
        id: requestId,
        subscriptionId,
        organizationId: subscription.organizationId,
        requestedBy: actor.actor?.email || 'unknown',
        requestedByRole: actor.roles[0] || 'UNKNOWN',
        currentBillingInterval: subscription.billingInterval,
        targetBillingInterval,
        proratedAmount,
        reason,
        status: actor.isSuper ? 'APPLIED' : 'PENDING_APPROVAL',
        requestedAt: new Date().toISOString(),
        approvedAt: actor.isSuper ? new Date().toISOString() : undefined,
        approvedBy: actor.isSuper ? actor.actor?.email : undefined,
        appliedAt: actor.isSuper ? new Date().toISOString() : undefined,
        appliedBy: actor.isSuper ? actor.actor?.email : undefined,
      };
      changedCycleRequestId = requestId;

      if (actor.isSuper) {
        subscriptions[subscriptionId] = {
          ...subscription,
          billingInterval: targetBillingInterval,
          intendedBillingInterval: targetBillingInterval,
          amount: intervalPrice.amount,
          setupFee: intervalPrice.setupFee || 0,
          renewalAmount: intervalPrice.amount,
          renewalSetupFee: intervalPrice.setupFee || 0,
          billingPeriodStartAt: new Date().toISOString(),
          billingPeriodEndAt: targetBillingInterval === 'ANNUAL'
            ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          updatedAt: new Date().toISOString(),
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
            billingCycleChangeRequests,
          },
        },
      };
    }

    if (action === 'APPROVE_BILLING_CYCLE_CHANGE' || action === 'REJECT_BILLING_CYCLE_CHANGE' || action === 'APPLY_BILLING_CYCLE_CHANGE') {
      if (!(actor.isAdminRole || actor.isSuper)) {
        return current;
      }

      const requestId = String((body as { requestId?: unknown }).requestId || '').trim();
      const request = requestId ? billingCycleChangeRequests[requestId] : undefined;
      if (!request) return current;

      const subscription = subscriptions[request.subscriptionId];
      if (!subscription) return current;

      if (action === 'REJECT_BILLING_CYCLE_CHANGE') {
        billingCycleChangeRequests[requestId] = {
          ...request,
          status: 'REJECTED',
          rejectionReason: String((body as { rejectionReason?: unknown }).rejectionReason || '').trim() || undefined,
        };
        changedCycleRequestId = requestId;
      } else {
        const plan = current.cloud.commercial.plans.find((item) => item.id === subscription.planId) || current.cloud.commercial.plans[0];
        const { intervalPrice } = getPlanRegionPrice(plan, subscription.country, request.targetBillingInterval);
        subscriptions[subscription.id] = {
          ...subscription,
          billingInterval: request.targetBillingInterval,
          intendedBillingInterval: request.targetBillingInterval,
          amount: intervalPrice.amount,
          setupFee: intervalPrice.setupFee || 0,
          renewalAmount: intervalPrice.amount,
          renewalSetupFee: intervalPrice.setupFee || 0,
          billingPeriodStartAt: new Date().toISOString(),
          billingPeriodEndAt: request.targetBillingInterval === 'ANNUAL'
            ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          updatedAt: new Date().toISOString(),
        };

        billingCycleChangeRequests[requestId] = {
          ...request,
          status: 'APPLIED',
          approvedAt: new Date().toISOString(),
          approvedBy: actor.actor?.email,
          appliedAt: new Date().toISOString(),
          appliedBy: actor.actor?.email,
        };
        changedCycleRequestId = requestId;
      }

      return {
        ...current,
        cloud: {
          ...current.cloud,
          commercial: {
            ...current.cloud.commercial,
            subscriptions,
            onboardingSessions,
            billingCycleChangeRequests,
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

  const auditedActor = await getCurrentPlatformUser(auth.session.token);
  await appendAuditLog({
    actorEmail: auditedActor?.email ?? String(auth.session.user?.user_email ?? 'unknown'),
    action: 'billing.subscription.status_changed',
    target: action === 'PURGE_TEST_TRIALS' || action === 'PURGE_TEST_RESTART'
      ? 'subscription:trial-purge'
      : action.includes('BILLING_CYCLE_CHANGE') && changedCycleRequestId
        ? `billing-cycle:${changedCycleRequestId}`
        : `subscription:${subscriptionId}`,
    details: `action=${action};status=${nextStatus || 'unchanged'};deleted=${deletedSubscriptionIds.length};deletedWorkspaces=${deletedWorkspaceIds.length};cycleRequest=${changedCycleRequestId || 'none'}`,
  });

  await appendOperationalAuditEvent({
    actor: auditedActor?.email ?? String(auth.session.user?.user_email ?? 'unknown'),
    action: `billing.${String(action || '').toLowerCase()}`,
    entity: 'subscription',
    entityId: subscriptionId || changedCycleRequestId || 'bulk',
    metadata: {
      deletedCount: deletedSubscriptionIds.length,
      deletedWorkspaceCount: deletedWorkspaceIds.length,
      nextStatus: nextStatus || 'unchanged',
    },
  });

  if (action === 'SUSPEND' || action === 'MARK_TRIAL_EXPIRED') {
    await appendOperationalActivityEvent({
      type: 'payment_failed',
      actor: auditedActor?.email ?? String(auth.session.user?.user_email ?? 'unknown'),
      target: subscriptionId,
      metadata: {
        action,
        status: nextStatus || 'unchanged',
      },
    });
  }

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
    billingCycleChangeRequests: mapBillingCycleRequests(refreshed),
    safeBillingActionsEnabled: true,
    canMutateBillingRecords: true,
  });
}