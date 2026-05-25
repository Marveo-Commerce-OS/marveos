import type { AdminConfigStore, AccountPlan, CommercialPlanConfig, WorkspaceOrchestration } from '@/lib/adminStore';

export interface ResolvedWorkspaceEntitlement {
  planId: string;
  planName: string;
  workspaceLimit: number;
  workspaceCount: number;
  remainingWorkspaces: number;
  hasCapacity: boolean;
}

export interface WorkspaceEntitlementScope {
  clientOrganizationId?: string;
  clientSubscriptionId?: string;
}

export type WorkspaceEntitlementResult =
  | {
      ok: true;
      entitlement: ResolvedWorkspaceEntitlement;
      source: 'subscription_plan' | 'account_plan';
    }
  | {
      ok: false;
      error: string;
    };

function normalize(value: string | undefined | null): string {
  return String(value || '').trim().toLowerCase();
}

function toPositiveLimit(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const normalized = Math.floor(parsed);
  if (normalized < 1) return null;
  return normalized;
}

function getScopedWorkspaceCount(
  workspaces: Record<string, WorkspaceOrchestration>,
  scope?: WorkspaceEntitlementScope,
): number {
  if (!scope?.clientOrganizationId && !scope?.clientSubscriptionId) {
    return Object.keys(workspaces).length;
  }

  return Object.values(workspaces).filter((workspace) => {
    const sameOrganization = scope.clientOrganizationId
      ? workspace.clientOrganizationId === scope.clientOrganizationId
      : false;
    const sameSubscription = scope.clientSubscriptionId
      ? workspace.clientSubscriptionId === scope.clientSubscriptionId
      : false;

    return sameOrganization || sameSubscription;
  }).length;
}

function findCommercialPlanById(
  plans: CommercialPlanConfig[],
  candidatePlanId: string | undefined,
): CommercialPlanConfig | null {
  const normalized = normalize(candidatePlanId);
  if (!normalized) return null;

  const byExact = plans.find((plan) => normalize(plan.id) === normalized);
  if (byExact) return byExact;

  if (normalized === 'business') {
    return plans.find((plan) => normalize(plan.id) === 'growth') || null;
  }

  if (normalized === 'growth') {
    return plans.find((plan) => normalize(plan.id) === 'business') || null;
  }

  return null;
}

function findCommercialPlanByAccountPlan(
  plans: CommercialPlanConfig[],
  accountPlan: AccountPlan | undefined,
): CommercialPlanConfig | null {
  if (!accountPlan) return null;

  if (accountPlan === 'starter') {
    return findCommercialPlanById(plans, 'starter');
  }

  if (accountPlan === 'business') {
    return findCommercialPlanById(plans, 'growth') || findCommercialPlanById(plans, 'business');
  }

  return findCommercialPlanById(plans, 'enterprise');
}

export function resolveWorkspaceEntitlement(
  store: AdminConfigStore,
  params: {
    subscriptionPlanId?: string;
    accountPlan?: AccountPlan;
    scope?: WorkspaceEntitlementScope;
  },
): WorkspaceEntitlementResult {
  const plans = Array.isArray(store.cloud.commercial?.plans) ? store.cloud.commercial.plans : [];

  if (plans.length === 0) {
    return {
      ok: false,
      error: 'Commercial plan configuration is missing. Workspace entitlement cannot be resolved safely.',
    };
  }

  const fromSubscription = findCommercialPlanById(plans, params.subscriptionPlanId);
  const fromAccount = findCommercialPlanByAccountPlan(plans, params.accountPlan ?? store.cloud.accountPlan);
  const selectedPlan = fromSubscription || fromAccount;
  const source = fromSubscription ? 'subscription_plan' : 'account_plan';

  if (!selectedPlan) {
    return {
      ok: false,
      error: `No commercial plan metadata found for entitlement resolution (subscriptionPlanId=${params.subscriptionPlanId || 'n/a'}, accountPlan=${params.accountPlan || store.cloud.accountPlan}).`,
    };
  }

  const workspaceLimit = toPositiveLimit(selectedPlan.workspaceLimit);
  if (!workspaceLimit) {
    return {
      ok: false,
      error: `Invalid workspace limit configured for plan ${selectedPlan.id}.`,
    };
  }

  const workspaceCount = getScopedWorkspaceCount(store.cloud.workspaces, params.scope);
  const remainingWorkspaces = Math.max(0, workspaceLimit - workspaceCount);

  return {
    ok: true,
    source,
    entitlement: {
      planId: selectedPlan.id,
      planName: selectedPlan.name,
      workspaceLimit,
      workspaceCount,
      remainingWorkspaces,
      hasCapacity: remainingWorkspaces > 0,
    },
  };
}
