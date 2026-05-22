export const dynamic = 'force-dynamic';

import { getControlCenterSnapshot } from '../_lib/controlCenter';

const STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: 'Not started',
  IN_PROGRESS: 'In progress',
  WAITING_FOR_CLIENT: 'Waiting for client',
  WAITING_FOR_SUPPORT: 'Waiting for support',
  DEPLOYING: 'Deploying',
  READY_FOR_REVIEW: 'Ready for review',
  READY_FOR_LAUNCH: 'Ready for launch',
  LIVE: 'Live',
  FAILED: 'Failed',
  ONBOARDING: 'Onboarding',
  BLOCKED: 'Blocked',
};

function toLabel(raw: string): string {
  return raw
    .replace(/[._-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeToken(value: string): string {
  return value.trim().replace(/\s+/g, '_').toUpperCase();
}

function prettyStatus(value: string): string {
  const key = normalizeToken(value);
  return STATUS_LABELS[key] || toLabel(value);
}

export default async function MasterClientsPage() {
  const snapshot = await getControlCenterSnapshot();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Clients</h1>
        <p className="mt-2 text-sm text-slate-600">
          Client organizations represented across active workspaces. If Marveo needs to manage its own website, it should exist here as a client workspace.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-600">Total client accounts</p>
        <p className="text-2xl font-bold text-slate-900">{snapshot.clients.length}</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        {snapshot.clients.length === 0 ? (
          <div className="p-6 text-sm text-slate-600">No clients discovered yet. Create a workspace to register the first client account.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  {['Client', 'Email', 'Workspaces', 'Countries', 'Workspace Status Mix'].map((header) => (
                    <th key={header} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {snapshot.clients.map((client) => (
                  <tr key={client.id} className="border-b border-slate-100">
                    <td className="px-4 py-3 font-semibold text-slate-900">{client.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{client.email}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{client.workspaceCount}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{client.countries.join(', ')}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{client.statuses.map((status) => prettyStatus(status)).join(', ')}</td>
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
