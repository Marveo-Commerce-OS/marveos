'use client';

import { useEffect, useMemo, useState } from 'react';

type IntervalPrice = {
  amount: number;
  setupFee: number;
};

type RegionalPrice = {
  country: string;
  currency: string;
  monthly: IntervalPrice;
  annual: IntervalPrice;
  annualDiscountPercent?: number;
};

type PlanConfig = {
  id: string;
  name: string;
  description: string;
  active: boolean;
  workspaceLimit: number;
  featureEntitlements: string[];
  trialEnabled: boolean;
  trialDurationDays?: number;
  regions: RegionalPrice[];
};

type TrialDefaults = {
  trialEnabled: boolean;
  trialDurationDays: number;
};

type PlansResponse = {
  plans: PlanConfig[];
  trialDefaults: TrialDefaults;
  canMutate: boolean;
  error?: string;
};

function asNumber(value: string, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function createEmptyPlan(): PlanConfig {
  return {
    id: '',
    name: '',
    description: '',
    active: true,
    workspaceLimit: 1,
    featureEntitlements: [],
    trialEnabled: true,
    trialDurationDays: 14,
    regions: [
      {
        country: 'US',
        currency: 'USD',
        monthly: { amount: 0, setupFee: 0 },
        annual: { amount: 0, setupFee: 0 },
        annualDiscountPercent: 0,
      },
    ],
  };
}

export default function BillingPlansManagerClient() {
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [plans, setPlans] = useState<PlanConfig[]>([]);
  const [trialDefaults, setTrialDefaults] = useState<TrialDefaults>({ trialEnabled: true, trialDurationDays: 14 });
  const [canMutate, setCanMutate] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, PlanConfig>>({});
  const [newPlan, setNewPlan] = useState<PlanConfig>(createEmptyPlan());

  const sortedPlans = useMemo(() => [...plans].sort((a, b) => a.id.localeCompare(b.id)), [plans]);

  function hydrateDrafts(nextPlans: PlanConfig[]) {
    const next: Record<string, PlanConfig> = {};
    for (const plan of nextPlans) {
      next[plan.id] = JSON.parse(JSON.stringify(plan)) as PlanConfig;
    }
    setDrafts(next);
  }

  async function loadPlans() {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/master/billing/plans', { cache: 'no-store' });
      const body = (await res.json().catch(() => null)) as PlansResponse | null;
      if (!res.ok || !body) {
        throw new Error(body?.error || 'Failed to load plans.');
      }

      setPlans(Array.isArray(body.plans) ? body.plans : []);
      setTrialDefaults(body.trialDefaults || { trialEnabled: true, trialDurationDays: 14 });
      setCanMutate(Boolean(body.canMutate));
      hydrateDrafts(Array.isArray(body.plans) ? body.plans : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load plans.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPlans();
  }, []);

  function updateDraft(planId: string, mutator: (prev: PlanConfig) => PlanConfig) {
    setDrafts((prev) => ({
      ...prev,
      [planId]: mutator(prev[planId]),
    }));
  }

  function updateRegion(planId: string, index: number, mutator: (prev: RegionalPrice) => RegionalPrice) {
    updateDraft(planId, (prev) => {
      const regions = [...prev.regions];
      regions[index] = mutator(regions[index]);
      return { ...prev, regions };
    });
  }

  async function savePlan(planId: string) {
    const draft = drafts[planId];
    if (!draft) return;

    setSavingKey(planId);
    setError('');
    setNotice('');

    try {
      const res = await fetch('/api/master/billing/plans', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId,
          ...draft,
        }),
      });

      const body = (await res.json().catch(() => null)) as PlansResponse & { ok?: boolean; error?: string };
      if (!res.ok || !body?.ok) {
        throw new Error(body?.error || 'Failed to save plan.');
      }

      const nextPlans = Array.isArray(body.plans) ? body.plans : [];
      setPlans(nextPlans);
      setTrialDefaults(body.trialDefaults || trialDefaults);
      setCanMutate(Boolean(body.canMutate));
      hydrateDrafts(nextPlans);
      setNotice(`Saved plan ${planId}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save plan.');
    } finally {
      setSavingKey(null);
    }
  }

  async function saveTrialDefaults() {
    setSavingKey('trial-defaults');
    setError('');
    setNotice('');

    try {
      const res = await fetch('/api/master/billing/plans', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_TRIAL_DEFAULTS',
          trialEnabled: trialDefaults.trialEnabled,
          trialDurationDays: trialDefaults.trialDurationDays,
        }),
      });

      const body = (await res.json().catch(() => null)) as PlansResponse & { ok?: boolean; error?: string };
      if (!res.ok || !body?.ok) {
        throw new Error(body?.error || 'Failed to update trial defaults.');
      }

      const nextPlans = Array.isArray(body.plans) ? body.plans : [];
      setPlans(nextPlans);
      setTrialDefaults(body.trialDefaults || trialDefaults);
      setCanMutate(Boolean(body.canMutate));
      hydrateDrafts(nextPlans);
      setNotice('Updated trial defaults.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update trial defaults.');
    } finally {
      setSavingKey(null);
    }
  }

  async function createPlan() {
    setSavingKey('new-plan');
    setError('');
    setNotice('');

    try {
      const res = await fetch('/api/master/billing/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPlan),
      });

      const body = (await res.json().catch(() => null)) as PlansResponse & { ok?: boolean; error?: string };
      if (!res.ok || !body?.ok) {
        throw new Error(body?.error || 'Failed to create plan.');
      }

      const nextPlans = Array.isArray(body.plans) ? body.plans : [];
      setPlans(nextPlans);
      setCanMutate(Boolean(body.canMutate));
      hydrateDrafts(nextPlans);
      setNewPlan(createEmptyPlan());
      setNotice('Created new plan.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create plan.');
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Plan management</h2>
          <p className="mt-1 text-xs text-slate-500">Create, edit, activate/deactivate plans, regional prices, and trial settings. Public pricing reads from this data.</p>
        </div>
        <button
          type="button"
          onClick={() => void loadPlans()}
          disabled={loading}
          className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          Refresh
        </button>
      </div>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      {notice ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</div> : null}

      {!canMutate ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Plans are read-only for your role. Super admin access is required to mutate plans.
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-900">Global trial defaults</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={trialDefaults.trialEnabled}
              onChange={(e) => setTrialDefaults((prev) => ({ ...prev, trialEnabled: e.target.checked }))}
              disabled={!canMutate || savingKey === 'trial-defaults'}
            />
            Trial enabled by default
          </label>
          <label className="text-sm text-slate-700">
            Trial duration (days)
            <input
              type="number"
              min={1}
              max={365}
              value={trialDefaults.trialDurationDays}
              onChange={(e) => setTrialDefaults((prev) => ({ ...prev, trialDurationDays: asNumber(e.target.value, 14) }))}
              disabled={!canMutate || savingKey === 'trial-defaults'}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </label>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => void saveTrialDefaults()}
              disabled={!canMutate || savingKey === 'trial-defaults'}
              className="rounded-full bg-indigo-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              Save defaults
            </button>
          </div>
        </div>
      </div>

      {loading ? <p className="text-sm text-slate-500">Loading plans...</p> : null}

      <div className="space-y-4">
        {sortedPlans.map((plan) => {
          const draft = drafts[plan.id] || plan;
          const saving = savingKey === plan.id;

          return (
            <div key={plan.id} className="rounded-xl border border-slate-200 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900">{plan.id}</p>
                <button
                  type="button"
                  onClick={() => void savePlan(plan.id)}
                  disabled={!canMutate || saving}
                  className="rounded-full bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {saving ? 'Saving...' : 'Save plan'}
                </button>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <label className="text-sm text-slate-700">
                  Name
                  <input
                    value={draft.name}
                    onChange={(e) => updateDraft(plan.id, (prev) => ({ ...prev, name: e.target.value }))}
                    disabled={!canMutate || saving}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </label>

                <label className="text-sm text-slate-700">
                  Workspace limit
                  <input
                    type="number"
                    min={1}
                    value={draft.workspaceLimit}
                    onChange={(e) => updateDraft(plan.id, (prev) => ({ ...prev, workspaceLimit: asNumber(e.target.value, 1) }))}
                    disabled={!canMutate || saving}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </label>

                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={Boolean(draft.active)}
                    onChange={(e) => updateDraft(plan.id, (prev) => ({ ...prev, active: e.target.checked }))}
                    disabled={!canMutate || saving}
                  />
                  Plan active
                </label>

                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={Boolean(draft.trialEnabled)}
                    onChange={(e) => updateDraft(plan.id, (prev) => ({ ...prev, trialEnabled: e.target.checked }))}
                    disabled={!canMutate || saving}
                  />
                  Trial enabled for this plan
                </label>

                <label className="text-sm text-slate-700 lg:col-span-2">
                  Description
                  <textarea
                    value={draft.description}
                    onChange={(e) => updateDraft(plan.id, (prev) => ({ ...prev, description: e.target.value }))}
                    disabled={!canMutate || saving}
                    className="mt-1 min-h-[64px] w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </label>

                <label className="text-sm text-slate-700">
                  Trial duration days
                  <input
                    type="number"
                    min={0}
                    max={365}
                    value={draft.trialDurationDays ?? 0}
                    onChange={(e) => updateDraft(plan.id, (prev) => ({ ...prev, trialDurationDays: asNumber(e.target.value, 0) }))}
                    disabled={!canMutate || saving}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </label>

                <label className="text-sm text-slate-700">
                  Feature entitlements (comma-separated)
                  <input
                    value={draft.featureEntitlements.join(', ')}
                    onChange={(e) => updateDraft(plan.id, (prev) => ({
                      ...prev,
                      featureEntitlements: e.target.value.split(',').map((item) => item.trim()).filter(Boolean),
                    }))}
                    disabled={!canMutate || saving}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </label>
              </div>

              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900">Regional pricing</p>
                  <button
                    type="button"
                    onClick={() => updateDraft(plan.id, (prev) => ({
                      ...prev,
                      regions: [
                        ...prev.regions,
                        {
                          country: 'US',
                          currency: 'USD',
                          monthly: { amount: 0, setupFee: 0 },
                          annual: { amount: 0, setupFee: 0 },
                          annualDiscountPercent: 0,
                        },
                      ],
                    }))}
                    disabled={!canMutate || saving}
                    className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-800 disabled:opacity-60"
                  >
                    Add region
                  </button>
                </div>

                <div className="space-y-2">
                  {draft.regions.map((region, idx) => (
                    <div key={`${plan.id}-region-${idx}`} className="rounded-lg border border-slate-200 bg-white p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                          {region.country || 'Region'} pricing
                        </p>
                        <span className="text-[11px] text-slate-400">
                          {region.currency || 'Currency'} · row {idx + 1}
                        </span>
                      </div>
                      <div className="grid gap-2 lg:grid-cols-7">
                      <input
                        value={region.country}
                        onChange={(e) => updateRegion(plan.id, idx, (prev) => ({ ...prev, country: e.target.value.toUpperCase() }))}
                        disabled={!canMutate || saving}
                        className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                        placeholder="Country"
                      />
                      <input
                        value={region.currency}
                        onChange={(e) => updateRegion(plan.id, idx, (prev) => ({ ...prev, currency: e.target.value.toUpperCase() }))}
                        disabled={!canMutate || saving}
                        className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                        placeholder="Currency"
                      />
                      <input
                        type="number"
                        value={region.monthly.amount}
                        onChange={(e) => updateRegion(plan.id, idx, (prev) => ({ ...prev, monthly: { ...prev.monthly, amount: asNumber(e.target.value, 0) } }))}
                        disabled={!canMutate || saving}
                        className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                        placeholder="Monthly"
                      />
                      <input
                        type="number"
                        value={region.monthly.setupFee}
                        onChange={(e) => updateRegion(plan.id, idx, (prev) => ({ ...prev, monthly: { ...prev.monthly, setupFee: asNumber(e.target.value, 0) } }))}
                        disabled={!canMutate || saving}
                        className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                        placeholder="Monthly setup"
                      />
                      <input
                        type="number"
                        value={region.annual.amount}
                        onChange={(e) => updateRegion(plan.id, idx, (prev) => ({ ...prev, annual: { ...prev.annual, amount: asNumber(e.target.value, 0) } }))}
                        disabled={!canMutate || saving}
                        className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                        placeholder="Annual"
                      />
                      <input
                        type="number"
                        value={region.annual.setupFee}
                        onChange={(e) => updateRegion(plan.id, idx, (prev) => ({ ...prev, annual: { ...prev.annual, setupFee: asNumber(e.target.value, 0) } }))}
                        disabled={!canMutate || saving}
                        className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                        placeholder="Annual setup"
                      />
                      <div className="flex gap-1">
                        <input
                          type="number"
                          value={region.annualDiscountPercent ?? 0}
                          onChange={(e) => updateRegion(plan.id, idx, (prev) => ({ ...prev, annualDiscountPercent: asNumber(e.target.value, 0) }))}
                          disabled={!canMutate || saving}
                          className="w-full rounded-lg border border-slate-300 px-2 py-1 text-xs"
                          placeholder="Discount %"
                        />
                        <button
                          type="button"
                          onClick={() => updateDraft(plan.id, (prev) => ({
                            ...prev,
                            regions: prev.regions.filter((_, regionIdx) => regionIdx !== idx),
                          }))}
                          disabled={!canMutate || saving || draft.regions.length <= 1}
                          className="rounded-lg bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-800 disabled:opacity-60"
                        >
                          Remove
                        </button>
                      </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {canMutate ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-900">Create new plan</p>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <label className="text-sm text-slate-700">
              Plan ID
              <input
                value={newPlan.id}
                onChange={(e) => setNewPlan((prev) => ({ ...prev, id: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                placeholder="pro"
              />
            </label>
            <label className="text-sm text-slate-700">
              Name
              <input
                value={newPlan.name}
                onChange={(e) => setNewPlan((prev) => ({ ...prev, name: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="text-sm text-slate-700 lg:col-span-2">
              Description
              <textarea
                value={newPlan.description}
                onChange={(e) => setNewPlan((prev) => ({ ...prev, description: e.target.value }))}
                className="mt-1 min-h-[64px] w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="text-sm text-slate-700">
              Workspace limit
              <input
                type="number"
                min={1}
                value={newPlan.workspaceLimit}
                onChange={(e) => setNewPlan((prev) => ({ ...prev, workspaceLimit: asNumber(e.target.value, 1) }))}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={newPlan.active}
                onChange={(e) => setNewPlan((prev) => ({ ...prev, active: e.target.checked }))}
              />
              Plan active
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={newPlan.trialEnabled}
                onChange={(e) => setNewPlan((prev) => ({ ...prev, trialEnabled: e.target.checked }))}
              />
              Trial enabled
            </label>
            <label className="text-sm text-slate-700">
              Trial duration days
              <input
                type="number"
                min={0}
                max={365}
                value={newPlan.trialDurationDays ?? 14}
                onChange={(e) => setNewPlan((prev) => ({ ...prev, trialDurationDays: asNumber(e.target.value, 14) }))}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="text-sm text-slate-700 lg:col-span-2">
              Feature entitlements (comma-separated)
              <input
                value={newPlan.featureEntitlements.join(', ')}
                onChange={(e) => setNewPlan((prev) => ({
                  ...prev,
                  featureEntitlements: e.target.value.split(',').map((item) => item.trim()).filter(Boolean),
                }))}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
                placeholder="workspace.basic, support.standard"
              />
            </label>
          </div>
          <div className="mt-4">
            <button
              type="button"
              onClick={() => void createPlan()}
              disabled={savingKey === 'new-plan'}
              className="rounded-full bg-indigo-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {savingKey === 'new-plan' ? 'Creating...' : 'Create plan'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
