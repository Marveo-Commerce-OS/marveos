export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { getControlCenterSnapshot } from '../_lib/controlCenter';

export default async function MasterConnectorsPage() {
  const snapshot = await getControlCenterSnapshot();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Connectors</h1>
        <p className="mt-2 text-sm text-slate-600">Connector operational status across all workspaces and upcoming integration tracks.</p>
        <p className="mt-3 inline-flex rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
          Read-only scaffold for non-WordPress connectors
        </p>
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

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Connected workspaces and connector telemetry</h2>
          <p className="mt-1 text-xs text-slate-600">Live workspace connector state (read-only).</p>
        </div>
        {snapshot.workspaces.filter((workspace) => workspace.websiteType === 'EXISTING_WEBSITE').length === 0 ? (
          <div className="p-6 text-sm text-slate-600">No existing-website workspaces registered yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px]">
              <thead className="border-b border-slate-200 bg-white">
                <tr>
                  {['Workspace', 'Connector status', 'Detected platform', 'Site URL', 'WooCommerce', 'Last verification', 'Discovered at'].map((header) => (
                    <th key={header} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {snapshot.workspaces
                  .filter((workspace) => workspace.websiteType === 'EXISTING_WEBSITE')
                  .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
                  .map((workspace) => (
                    <tr key={workspace.id} className="border-b border-slate-100">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">{workspace.name}</p>
                        <p className="text-xs text-slate-500">{workspace.id}</p>
                        <Link href={`/master/mvp-deployments/${workspace.id}`} className="mt-2 inline-block text-xs font-semibold text-slate-700 underline">
                          View workspace
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">{workspace.connectorStatus || 'NOT_CONNECTED'}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{workspace.connectorSiteMetadata?.platform || 'Unknown'}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{workspace.connectorSiteMetadata?.siteUrl || '—'}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {typeof workspace.connectorSiteMetadata?.woocommerceEnabled === 'boolean'
                          ? (workspace.connectorSiteMetadata.woocommerceEnabled ? 'Enabled' : 'Not detected')
                          : 'Unknown'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">{workspace.connectorLastVerificationAttempt ? new Date(workspace.connectorLastVerificationAttempt).toLocaleString() : '—'}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{workspace.connectorSiteMetadata?.discoveredAt ? new Date(workspace.connectorSiteMetadata.discoveredAt).toLocaleString() : '—'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
