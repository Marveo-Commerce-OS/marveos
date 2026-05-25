'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

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
  status: string;
  trialEndDate: string | null;
  paymentMode: string;
  paymentReference: string | null;
  paymentProvider: string | null;
  updatedAt: string;
};

type BillingCycleChangeRequestRow = {
  id: string;
  subscriptionId: string;
  organizationName: string;
  ownerEmail: string;
  currentBillingInterval: string;
  targetBillingInterval: string;
  proratedAmount: number;
  status: string;
  requestedAt: string;
  requestedByRole: string;
};

type BillingResponse = {
  safeBillingActionsEnabled: boolean;
  canMutateBillingRecords?: boolean;
  subscriptions: SubscriptionRow[];
  billingCycleChangeRequests?: BillingCycleChangeRequestRow[];
  billingCycleCapabilities?: {
    canRequestChange: boolean;
    canApproveChange: boolean;
    canApplyDirectly: boolean;
  };
  error?: string;
};

function toLabel(raw: string): string {
  return raw
    .replace(/[._-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function BillingSubscriptionsClient() {
  const searchParams = useSearchParams();
  const filterId = (searchParams.get('subscription') || '').trim();

  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [payload, setPayload] = useState<BillingResponse | null>(null);

  const rows = useMemo(() => {
    const base = payload?.subscriptions ?? [];
    if (!filterId) return base;
    return base.filter((row) => row.id === filterId);
  }, [payload, filterId]);

  async function load() {
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const res = await fetch('/api/master/billing/subscriptions', { cache: 'no-store' });
      const data = (await res.json().catch(() => null)) as BillingResponse | null;
      if (!res.ok || !data) throw new Error(data?.error || 'Failed to load subscriptions.');
      setPayload(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load subscriptions.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  async function applyAction(subscriptionId: string, action: 'MARK_TRIAL_EXPIRED' | 'SUSPEND' | 'REACTIVATE' | 'DELETE_SUBSCRIPTION' | 'PURGE_TEST_TRIALS' | 'PURGE_TEST_RESTART') {
    setBusyId(subscriptionId || '__bulk__');
    setError('');
    setMessage('');

    try {
      const res = await fetch('/api/master/billing/subscriptions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscriptionId ? { subscriptionId, action } : { action }),
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        subscriptions?: SubscriptionRow[];
        safeBillingActionsEnabled?: boolean;
        canMutateBillingRecords?: boolean;
        deletedCount?: number;
        deletedWorkspaceCount?: number;
      } | null;
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Billing action failed.');

      setPayload((prev) => prev ? ({
        ...prev,
        subscriptions: Array.isArray(data.subscriptions) ? data.subscriptions : prev.subscriptions,
        safeBillingActionsEnabled: Boolean(data.safeBillingActionsEnabled ?? prev.safeBillingActionsEnabled),
        canMutateBillingRecords: Boolean(data.canMutateBillingRecords ?? prev.canMutateBillingRecords),
      }) : prev);

      if (action === 'PURGE_TEST_TRIALS') {
        setMessage(`Purged ${data.deletedCount || 0} trial subscription(s).`);
      } else if (action === 'PURGE_TEST_RESTART') {
        setMessage(`Purged ${data.deletedCount || 0} trial subscription(s) and ${data.deletedWorkspaceCount || 0} linked workspace(s).`);
      } else if (action === 'DELETE_SUBSCRIPTION') {
        setMessage(`Deleted trial subscription ${subscriptionId}.`);
      } else {
        setMessage(`Updated subscription ${subscriptionId}.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Billing action failed.');
    } finally {
      setBusyId(null);
    }
  }

  async function applyBillingCycleAction(params: {
    action: 'REQUEST_BILLING_CYCLE_CHANGE' | 'APPROVE_BILLING_CYCLE_CHANGE' | 'REJECT_BILLING_CYCLE_CHANGE' | 'APPLY_BILLING_CYCLE_CHANGE';
    subscriptionId?: string;
    requestId?: string;
    targetBillingInterval?: 'MONTHLY' | 'ANNUAL';
    reason?: string;
    rejectionReason?: string;
  }) {
    setBusyId(params.subscriptionId || params.requestId || '__cycle__');
    setError('');
    setMessage('');

    try {
      const res = await fetch('/api/master/billing/subscriptions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        subscriptions?: SubscriptionRow[];
        billingCycleChangeRequests?: BillingCycleChangeRequestRow[];
      } | null;
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Billing cycle change failed.');

      setPayload((prev) => prev ? ({
        ...prev,
        subscriptions: Array.isArray(data.subscriptions) ? data.subscriptions : prev.subscriptions,
        billingCycleChangeRequests: Array.isArray(data.billingCycleChangeRequests) ? data.billingCycleChangeRequests : prev.billingCycleChangeRequests,
      }) : prev);

      setMessage('Billing cycle request updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Billing cycle change failed.');
    } finally {
      setBusyId(null);
    }
  }

  const safeActions = Boolean(payload?.safeBillingActionsEnabled);
  const canMutateBillingRecords = Boolean(payload?.canMutateBillingRecords ?? safeActions);
  const cycleCapabilities = payload?.billingCycleCapabilities;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Commercial subscriptions</h2>
          <p className="mt-1 text-xs text-slate-500">
            Live persisted subscription records (trial, active, suspended, etc.).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!safeActions ? (
            <span className="rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              Actions unavailable
            </span>
          ) : (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
              Platform-native billing actions enabled
            </span>
          )}
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            Refresh
          </button>
          {canMutateBillingRecords ? (
            <button
              type="button"
              onClick={() => void applyAction('', 'PURGE_TEST_RESTART')}
              disabled={!safeActions || busyId !== null}
              className="rounded-full bg-rose-100 px-4 py-2 text-sm font-semibold text-rose-900 disabled:opacity-60"
              title="Delete test trial subscriptions and linked test workspaces to restart QA runs."
            >
              Purge and restart test
            </button>
          ) : null}
        </div>
      </div>

      {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
      {message ? <p className="mt-4 text-sm text-emerald-700">{message}</p> : null}

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              {['Organization', 'Owner', 'Plan', 'Interval', 'Country', 'Amount', 'Status', 'Trial end', 'Payment mode', 'Last payment ref', 'Actions'].map((header) => (
                <th key={header} className="px-3 py-2 font-semibold">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={11} className="px-3 py-4 text-slate-500">Loading subscriptions…</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-3 py-4 text-slate-500">No subscriptions created yet.</td>
              </tr>
            ) : (
              rows.map((subscription) => {
                const busy = busyId === subscription.id;
                const canExpireTrial = safeActions && subscription.status === 'TRIAL';
                const canSuspend = safeActions && subscription.status !== 'SUSPENDED';
                const canReactivate = safeActions && subscription.status === 'SUSPENDED';
                const canDeleteTrial = safeActions && subscription.paymentMode === 'TRIAL';

                return (
                  <tr key={subscription.id} className="border-b border-slate-100 last:border-b-0 align-top">
                    <td className="px-3 py-2">
                      <div className="text-slate-900 font-medium">{subscription.organizationName}</div>
                      <div className="text-xs text-slate-500">{subscription.organizationId}</div>
                      <div className="text-[11px] text-slate-400">{subscription.id}</div>
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      <div>{subscription.ownerName || subscription.ownerEmail}</div>
                      <div className="text-xs text-slate-500">{subscription.ownerEmail}</div>
                    </td>
                    <td className="px-3 py-2 text-slate-900">{subscription.planId}</td>
                    <td className="px-3 py-2 text-slate-700">{toLabel(subscription.billingInterval)}</td>
                    <td className="px-3 py-2 text-slate-700">{subscription.country} / {subscription.currency}</td>
                    <td className="px-3 py-2 text-slate-700">{subscription.currency} {subscription.amount}</td>
                    <td className="px-3 py-2 text-slate-700">{toLabel(subscription.status)}</td>
                    <td className="px-3 py-2 text-slate-700">{subscription.trialEndDate ? new Date(subscription.trialEndDate).toLocaleDateString() : '—'}</td>
                    <td className="px-3 py-2 text-slate-700">
                      {toLabel(subscription.paymentMode)}
                      {subscription.paymentProvider ? <div className="text-xs text-slate-500">{toLabel(subscription.paymentProvider)}</div> : null}
                    </td>
                    <td className="px-3 py-2 text-slate-700">{subscription.paymentReference || '—'}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void applyAction(subscription.id, 'MARK_TRIAL_EXPIRED')}
                          disabled={!canExpireTrial || busy}
                          className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-800 disabled:opacity-60"
                          title={safeActions ? 'Mark trial expired' : 'Action unavailable'}
                        >
                          Expire trial
                        </button>
                        <button
                          type="button"
                          onClick={() => void applyAction(subscription.id, 'SUSPEND')}
                          disabled={!canSuspend || busy}
                          className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-900 disabled:opacity-60"
                          title={safeActions ? 'Suspend subscription' : 'Action unavailable'}
                        >
                          Suspend
                        </button>
                        <button
                          type="button"
                          onClick={() => void applyAction(subscription.id, 'REACTIVATE')}
                          disabled={!canReactivate || busy}
                          className="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-900 disabled:opacity-60"
                          title={safeActions ? 'Reactivate subscription' : 'Action unavailable'}
                        >
                          Reactivate
                        </button>
                        <button
                          type="button"
                          onClick={() => void applyAction(subscription.id, 'DELETE_SUBSCRIPTION')}
                          disabled={!canDeleteTrial || busy}
                          className="rounded-full bg-rose-100 px-3 py-1.5 text-xs font-semibold text-rose-900 disabled:opacity-60"
                          title={safeActions ? 'Delete this trial-mode subscription and its linked onboarding sessions' : 'Action unavailable'}
                        >
                          Delete trial
                        </button>
                        {cycleCapabilities?.canApplyDirectly ? (
                          <>
                            <button
                              type="button"
                              onClick={() => void applyBillingCycleAction({ action: 'APPLY_BILLING_CYCLE_CHANGE', subscriptionId: subscription.id, targetBillingInterval: 'MONTHLY' })}
                              disabled={busy}
                              className="rounded-full bg-sky-100 px-3 py-1.5 text-xs font-semibold text-sky-900 disabled:opacity-60"
                            >
                              Set monthly
                            </button>
                            <button
                              type="button"
                              onClick={() => void applyBillingCycleAction({ action: 'APPLY_BILLING_CYCLE_CHANGE', subscriptionId: subscription.id, targetBillingInterval: 'ANNUAL' })}
                              disabled={busy}
                              className="rounded-full bg-sky-100 px-3 py-1.5 text-xs font-semibold text-sky-900 disabled:opacity-60"
                            >
                              Set annual
                            </button>
                          </>
                        ) : cycleCapabilities?.canRequestChange ? (
                          <>
                            <button
                              type="button"
                              onClick={() => void applyBillingCycleAction({ action: 'REQUEST_BILLING_CYCLE_CHANGE', subscriptionId: subscription.id, targetBillingInterval: 'MONTHLY' })}
                              disabled={busy}
                              className="rounded-full bg-sky-100 px-3 py-1.5 text-xs font-semibold text-sky-900 disabled:opacity-60"
                            >
                              Request monthly
                            </button>
                            <button
                              type="button"
                              onClick={() => void applyBillingCycleAction({ action: 'REQUEST_BILLING_CYCLE_CHANGE', subscriptionId: subscription.id, targetBillingInterval: 'ANNUAL' })}
                              disabled={busy}
                              className="rounded-full bg-sky-100 px-3 py-1.5 text-xs font-semibold text-sky-900 disabled:opacity-60"
                            >
                              Request annual
                            </button>
                          </>
                        ) : null}
                      </div>
                      {busy ? <p className="mt-1 text-xs text-slate-500">Updating…</p> : null}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {payload?.billingCycleChangeRequests?.length ? (
        <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Billing cycle change requests</h3>
              <p className="mt-1 text-xs text-slate-500">Pending approvals and applied cycle updates with proration estimates.</p>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  {['Organization', 'Owner', 'Current', 'Target', 'Proration', 'Status', 'Requested by', 'Actions'].map((header) => (
                    <th key={header} className="px-3 py-2 font-semibold">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payload.billingCycleChangeRequests.map((request) => {
                  const busy = busyId === request.id;
                  const canApprove = Boolean(cycleCapabilities?.canApproveChange && request.status === 'PENDING_APPROVAL');
                  const canReject = Boolean(cycleCapabilities?.canApproveChange && request.status === 'PENDING_APPROVAL');
                  return (
                    <tr key={request.id} className="border-b border-slate-100 last:border-b-0 align-top">
                      <td className="px-3 py-2 text-slate-700">{request.organizationName}</td>
                      <td className="px-3 py-2 text-slate-700">{request.ownerEmail}</td>
                      <td className="px-3 py-2 text-slate-700">{toLabel(request.currentBillingInterval)}</td>
                      <td className="px-3 py-2 text-slate-700">{toLabel(request.targetBillingInterval)}</td>
                      <td className="px-3 py-2 text-slate-700">{request.proratedAmount >= 0 ? '+' : ''}{request.proratedAmount}</td>
                      <td className="px-3 py-2 text-slate-700">{toLabel(request.status)}</td>
                      <td className="px-3 py-2 text-slate-700">{request.requestedByRole}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void applyBillingCycleAction({ action: 'APPROVE_BILLING_CYCLE_CHANGE', requestId: request.id })}
                            disabled={!canApprove || busy}
                            className="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-900 disabled:opacity-60"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => void applyBillingCycleAction({ action: 'REJECT_BILLING_CYCLE_CHANGE', requestId: request.id, rejectionReason: 'Rejected from admin billing queue.' })}
                            disabled={!canReject || busy}
                            className="rounded-full bg-rose-100 px-3 py-1.5 text-xs font-semibold text-rose-900 disabled:opacity-60"
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
