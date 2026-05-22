export const dynamic = 'force-dynamic';

import { getControlCenterSnapshot } from '../_lib/controlCenter';

const STATUS_LABELS: Record<string, string> = {
  ASSIGNED: 'Assigned',
  UNASSIGNED: 'Unassigned',
  NEW_WEBSITE: 'New Website',
  EXISTING_WEBSITE: 'Existing Website',
  CUSTOM_HEADLESS: 'Custom / Headless',
};

function toLabel(raw: string): string {
  return raw
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeToken(value: string): string {
  return value.trim().replace(/\s+/g, '_').toUpperCase();
}

function prettyValue(value: string): string {
  const key = normalizeToken(value);
  return STATUS_LABELS[key] || toLabel(value);
}

export default async function MasterSupportPage() {
  const snapshot = await getControlCenterSnapshot();
  const queue = snapshot.workspaces
    .filter((workspace) => workspace.supportRequired || workspace.supportAssignment)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Support Queue</h1>
        <p className="mt-2 text-sm text-slate-600">Queue of workspaces requiring onboarding or launch support assignment.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-600">Queue size</p>
          <p className="text-2xl font-bold text-slate-900">{queue.length}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <p className="text-sm">Open assignments</p>
          <p className="text-2xl font-bold">{snapshot.metrics.openSupportAssignments}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
          <p className="text-sm">Assigned</p>
          <p className="text-2xl font-bold">{queue.filter((workspace) => workspace.supportAssignment?.status === 'ASSIGNED').length}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        {queue.length === 0 ? (
          <div className="p-6 text-sm text-slate-600">No support items in queue.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px]">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  {['Workspace', 'Assignment', 'Priority', 'Setup Type', 'Reason', 'Officer', 'Updated'].map((header) => (
                    <th key={header} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {queue.map((workspace) => (
                  <tr key={workspace.id} className="border-b border-slate-100">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{workspace.name}</p>
                      <p className="text-xs text-slate-500">{workspace.id}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{prettyValue(workspace.supportAssignment?.status || 'UNASSIGNED')}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{prettyValue(workspace.supportAssignment?.priority || 'MEDIUM')}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{prettyValue(workspace.supportAssignment?.setupType || workspace.websiteType || 'n/a')}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{workspace.supportAssignment?.reason || 'Awaiting queue triage'}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{workspace.supportAssignment?.supportOfficerName || 'Not assigned'}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{new Date(workspace.updatedAt).toLocaleString()}</td>
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
