export const dynamic = 'force-dynamic';

import { getControlCenterSnapshot } from '../_lib/controlCenter';

export default async function MasterBillingPage() {
  const snapshot = await getControlCenterSnapshot();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Plans & Billing</h1>
        <p className="mt-2 text-sm text-slate-600">Subscription footprint and billing control placeholders for the Master Platform.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current Plan</p>
          <p className="mt-2 text-2xl font-bold capitalize text-slate-900">{snapshot.accountPlan}</p>
          <p className="mt-2 text-xs text-slate-500">Live data</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Workspace Usage</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{snapshot.workspaces.length} / {snapshot.workspaceLimit === 999 ? 'Unlimited' : snapshot.workspaceLimit}</p>
          <p className="mt-2 text-xs text-slate-500">Live data</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Revenue Summary</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">Coming soon</p>
          <p className="mt-2 text-xs text-slate-500">Not yet connected</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
        <h2 className="text-lg font-semibold text-slate-900">Payment operations</h2>
        <ul className="mt-3 space-y-2">
          <li>Subscription plan tracking is available (live).</li>
          <li>Invoice, payment, and ledger management is coming soon.</li>
          <li>Payment provider sync is not connected in this phase.</li>
        </ul>
      </div>
    </div>
  );
}
