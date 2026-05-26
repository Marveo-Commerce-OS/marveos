import { NextRequest, NextResponse } from 'next/server';
import { getCurrentPlatformUser, isSuperAdmin } from '@/lib/auth';
import { appendAuditLog, readAdminStore, updateAdminStore, type CommercialPlanConfig, type CommercialPlanRegionalPricing } from '@/lib/adminStore';
import { requireActionPermission } from '@/lib/master/permissions/guards';

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

async function ensureAdminSession() {
  return requireActionPermission('plansBilling', 'view');
}

function normalizePlanId(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/--+/g, '-').replace(/^-|-$/g, '');
}

function normalizeFeatureEntitlements(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return Array.from(new Set(input.map((item) => String(item).trim()).filter(Boolean)));
}

function normalizeRegions(input: unknown): CommercialPlanRegionalPricing[] {
  if (!Array.isArray(input)) {
    throw new Error('regions must be an array.');
  }

  const normalized = input.map((item) => {
    const row = (item && typeof item === 'object') ? (item as Record<string, unknown>) : {};

    const country = String(row.country || '').trim().toUpperCase();
    const currency = String(row.currency || '').trim().toUpperCase();

    const monthlyRaw = (row.monthly && typeof row.monthly === 'object') ? (row.monthly as Record<string, unknown>) : {};
    const annualRaw = (row.annual && typeof row.annual === 'object') ? (row.annual as Record<string, unknown>) : {};

    const monthlyAmount = Number(monthlyRaw.amount ?? 0);
    const monthlySetupFee = Number(monthlyRaw.setupFee ?? 0);
    const annualAmount = Number(annualRaw.amount ?? 0);
    const annualSetupFee = Number(annualRaw.setupFee ?? 0);
    const annualDiscountPercent = row.annualDiscountPercent === undefined || row.annualDiscountPercent === null
      ? undefined
      : Number(row.annualDiscountPercent);

    if (!country) throw new Error('region.country is required.');
    if (!/^[A-Z]{2,3}$/.test(country)) throw new Error(`region.country invalid: ${country}`);
    if (!currency || !/^[A-Z]{3}$/.test(currency)) throw new Error(`region.currency invalid: ${currency}`);
    if (!Number.isFinite(monthlyAmount) || monthlyAmount < 0) throw new Error(`region.monthly.amount invalid for ${country}`);
    if (!Number.isFinite(monthlySetupFee) || monthlySetupFee < 0) throw new Error(`region.monthly.setupFee invalid for ${country}`);
    if (!Number.isFinite(annualAmount) || annualAmount < 0) throw new Error(`region.annual.amount invalid for ${country}`);
    if (!Number.isFinite(annualSetupFee) || annualSetupFee < 0) throw new Error(`region.annual.setupFee invalid for ${country}`);
    if (annualDiscountPercent !== undefined && (!Number.isFinite(annualDiscountPercent) || annualDiscountPercent < 0 || annualDiscountPercent > 100)) {
      throw new Error(`region.annualDiscountPercent invalid for ${country}`);
    }

    return {
      country,
      currency,
      monthly: {
        amount: Number(monthlyAmount.toFixed(2)),
        setupFee: Number(monthlySetupFee.toFixed(2)),
      },
      annual: {
        amount: Number(annualAmount.toFixed(2)),
        setupFee: Number(annualSetupFee.toFixed(2)),
      },
      annualDiscountPercent: annualDiscountPercent === undefined ? undefined : Number(annualDiscountPercent.toFixed(2)),
    };
  });

  const seen = new Set<string>();
  for (const row of normalized) {
    const key = `${row.country}:${row.currency}`;
    if (seen.has(key)) {
      throw new Error(`Duplicate regional pricing for ${key}`);
    }
    seen.add(key);
  }

  return normalized;
}

function validatePlanPayload(body: Record<string, unknown>, options: { requireId: boolean }) {
  const rawId = String(body.id || '').trim();
  const id = normalizePlanId(rawId);
  const name = String(body.name || '').trim();
  const description = String(body.description || '').trim();
  const active = body.active === undefined ? true : Boolean(body.active);
  const workspaceLimit = Number(body.workspaceLimit ?? 1);
  const trialEnabled = Boolean(body.trialEnabled);
  const trialDurationDays = Number(body.trialDurationDays ?? 0);
  const featureEntitlements = normalizeFeatureEntitlements(body.featureEntitlements);
  const regions = normalizeRegions(body.regions);

  if (options.requireId && !id) {
    throw new Error('id is required.');
  }
  if (!name) {
    throw new Error('name is required.');
  }
  if (!description) {
    throw new Error('description is required.');
  }
  if (!Number.isFinite(workspaceLimit) || workspaceLimit < 1) {
    throw new Error('workspaceLimit must be >= 1.');
  }
  if (!Number.isFinite(trialDurationDays) || trialDurationDays < 0 || trialDurationDays > 365) {
    throw new Error('trialDurationDays must be between 0 and 365.');
  }
  if (trialEnabled && trialDurationDays < 1) {
    throw new Error('trialDurationDays must be at least 1 when trial is enabled.');
  }
  if (regions.length === 0) {
    throw new Error('At least one regional pricing row is required.');
  }

  return {
    id,
    name,
    description,
    active,
    workspaceLimit: Math.floor(workspaceLimit),
    featureEntitlements,
    trialEnabled,
    trialDurationDays: trialEnabled ? Math.floor(trialDurationDays) : 0,
    regions,
  } satisfies CommercialPlanConfig;
}

export async function GET() {
  const auth = await ensureAdminSession();
  if ('error' in auth) return auth.error;

  const canMutate = await isSuperAdmin(auth.session.token);
  const store = await readAdminStore();

  return NextResponse.json({
    plans: store.cloud.commercial.plans,
    trialDefaults: store.cloud.commercial.trialDefaults,
    canMutate,
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireActionPermission('plansBilling', 'update');
  if ('error' in auth) return auth.error;

  const canMutate = await isSuperAdmin(auth.session.token);
  if (!canMutate) {
    return NextResponse.json({ error: 'Only super admins can create plans.' }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return badRequest('Invalid JSON body.');

  let payload: CommercialPlanConfig;
  try {
    payload = validatePlanPayload(body, { requireId: true });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : 'Invalid plan payload.');
  }

  let created = false;
  await updateAdminStore((current) => {
    const exists = current.cloud.commercial.plans.some((plan) => plan.id === payload.id);
    if (exists) {
      return current;
    }

    created = true;
    return {
      ...current,
      cloud: {
        ...current.cloud,
        commercial: {
          ...current.cloud.commercial,
          plans: [...current.cloud.commercial.plans, payload],
        },
      },
    };
  });

  if (!created) {
    return badRequest(`Plan with id '${payload.id}' already exists.`);
  }

  const actor = await getCurrentPlatformUser(auth.session.token);
  await appendAuditLog({
    actorEmail: actor?.email ?? String(auth.session.user?.user_email ?? 'unknown'),
    action: 'billing.plan.created',
    target: `plan:${payload.id}`,
    details: `name=${payload.name};active=${payload.active}`,
  });

  const refreshed = await readAdminStore();
  return NextResponse.json({ ok: true, plans: refreshed.cloud.commercial.plans, canMutate: true });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireActionPermission('plansBilling', 'update');
  if ('error' in auth) return auth.error;

  const canMutate = await isSuperAdmin(auth.session.token);
  if (!canMutate) {
    return NextResponse.json({ error: 'Only super admins can update plans.' }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return badRequest('Invalid JSON body.');

  const action = String(body.action || 'UPDATE_PLAN').trim().toUpperCase();

  if (action === 'UPDATE_TRIAL_DEFAULTS') {
    const trialEnabled = Boolean(body.trialEnabled);
    const trialDurationDays = Number(body.trialDurationDays ?? 14);
    if (!Number.isFinite(trialDurationDays) || trialDurationDays < 1 || trialDurationDays > 365) {
      return badRequest('trialDurationDays must be between 1 and 365.');
    }

    await updateAdminStore((current) => ({
      ...current,
      cloud: {
        ...current.cloud,
        commercial: {
          ...current.cloud.commercial,
          trialDefaults: {
            trialEnabled,
            trialDurationDays: Math.floor(trialDurationDays),
          },
        },
      },
    }));

    const refreshed = await readAdminStore();
    return NextResponse.json({
      ok: true,
      plans: refreshed.cloud.commercial.plans,
      trialDefaults: refreshed.cloud.commercial.trialDefaults,
      canMutate: true,
    });
  }

  const planId = normalizePlanId(String(body.planId || body.id || '').trim());
  if (!planId) return badRequest('planId is required.');

  const existingStore = await readAdminStore();
  const existingPlan = existingStore.cloud.commercial.plans.find((plan) => plan.id === planId);
  if (!existingPlan) {
    return badRequest(`Plan '${planId}' not found.`);
  }

  const editablePayload = {
    ...existingPlan,
    ...body,
    id: planId,
  } as Record<string, unknown>;

  let nextPlan: CommercialPlanConfig;
  try {
    nextPlan = validatePlanPayload(editablePayload, { requireId: true });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : 'Invalid plan payload.');
  }

  await updateAdminStore((current) => ({
    ...current,
    cloud: {
      ...current.cloud,
      commercial: {
        ...current.cloud.commercial,
        plans: current.cloud.commercial.plans.map((plan) => (plan.id === planId ? nextPlan : plan)),
      },
    },
  }));

  const actor = await getCurrentPlatformUser(auth.session.token);
  await appendAuditLog({
    actorEmail: actor?.email ?? String(auth.session.user?.user_email ?? 'unknown'),
    action: 'billing.plan.updated',
    target: `plan:${planId}`,
    details: `active=${nextPlan.active};trial=${nextPlan.trialEnabled};workspaceLimit=${nextPlan.workspaceLimit}`,
  });

  const refreshed = await readAdminStore();
  return NextResponse.json({
    ok: true,
    plans: refreshed.cloud.commercial.plans,
    trialDefaults: refreshed.cloud.commercial.trialDefaults,
    canMutate: true,
  });
}
