export const dynamic = 'force-dynamic';

import { getControlCenterSnapshot } from '../_lib/controlCenter';

export default async function MasterConnectorsPage() {
  const snapshot = await getControlCenterSnapshot();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Connectors</h1>
        <p className="mt-2 text-sm text-slate-600">Connector operational status across all workspaces and upcoming integration tracks.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
          <p className="text-xs font-semibold uppercase tracking-wide">Connected</p>
          <p className="mt-2 text-2xl font-bold">{snapshot.connectorCounts.connected}</p>
          <p className="mt-2 text-xs">Live data</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <p className="text-xs font-semibold uppercase tracking-wide">Pending verification</p>
          <p className="mt-2 text-2xl font-bold">{snapshot.connectorCounts.pending}</p>
          <p className="mt-2 text-xs">Live data</p>
        </div>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-900">
          <p className="text-xs font-semibold uppercase tracking-wide">Failed</p>
          <p className="mt-2 text-2xl font-bold">{snapshot.connectorCounts.failed}</p>
          <p className="mt-2 text-xs">Live data</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Not connected</p>
          <p className="mt-2 text-2xl font-bold">{snapshot.connectorCounts.unconfigured}</p>
          <p className="mt-2 text-xs text-slate-500">Live data</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">Platform availability</h2>
          <div className="mt-4 space-y-3 text-sm text-slate-700">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
              <p className="font-semibold text-emerald-900">WordPress</p>
              <p className="text-xs text-emerald-800">Connected to current MVP orchestration (live).</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
              <p className="font-semibold text-emerald-900">WooCommerce</p>
              <p className="text-xs text-emerald-800">Connected via WordPress connector capability (live).</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="font-semibold text-slate-900">Shopify</p>
              <p className="text-xs text-slate-600">Coming soon. Not yet connected.</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="font-semibold text-slate-900">Laravel</p>
              <p className="text-xs text-slate-600">Coming soon. Not yet connected.</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="font-semibold text-slate-900">Custom API</p>
              <p className="text-xs text-slate-600">Coming soon. Not yet connected.</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
          <h2 className="text-lg font-semibold text-slate-900">Connector notes</h2>
          <ul className="mt-4 space-y-2">
            <li>Website connector status values are sourced from workspace orchestration state.</li>
            <li>Connection verification success/failure is reflected in overview and launch readiness.</li>
            <li>Upcoming connector tracks are placeholders in this phase and intentionally non-operational.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
