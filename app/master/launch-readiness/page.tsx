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
  ASSIGNED: 'Assigned',
  UNASSIGNED: 'Unassigned',
  NOT_CONNECTED: 'Not connected',
  TOKEN_GENERATED: 'Token generated',
  PENDING_VERIFICATION: 'Pending verification',
  CONNECTED: 'Connected',
  SUPPORT_REQUIRED: 'Support required',
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

function statusTone(ready: boolean) {
  return ready ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700';
}

function isConnectorScopedRequirement(requirement: string): boolean {
  const text = requirement.toLowerCase();
  return text.includes('connector') || text.includes('site connection token');
}

export default async function MasterLaunchReadinessPage() {
  const snapshot = await getControlCenterSnapshot();

  const rows = snapshot.workspaces.map((workspace) => {
    const websiteType = String(workspace.websiteType || '');
    const scopedMissingRequirements = workspace.missingRequirements.filter((item) => {
      if (websiteType === 'EXISTING_WEBSITE') return true;
      return !isConnectorScopedRequirement(item);
    });

    const supportPending = workspace.supportRequired && workspace.supportAssignment?.status !== 'ASSIGNED';
    const connectorPending = workspace.websiteType === 'EXISTING_WEBSITE' && workspace.connectorStatus !== 'CONNECTED';
    const blockedByRequirements = scopedMissingRequirements.length > 0;
    const ready = !supportPending && !connectorPending && !blockedByRequirements && workspace.status !== 'blocked';

    const blockers = [
      ...scopedMissingRequirements,
      ...(supportPending ? ['Support assignment pending'] : []),
                      ...(connectorPending ? ['Connector not verified'] : []),
    ];

    return { workspace, ready, blockers };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Launch Readiness</h1>
        <p className="mt-2 text-sm text-slate-600">Cross-workspace launch checklist aggregation from orchestration and connector state.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-600">Workspaces reviewed</p>
          <p className="text-2xl font-bold text-slate-900">{rows.length}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
          <p className="text-sm">Ready for launch</p>
          <p className="text-2xl font-bold">{rows.filter((row) => row.ready).length}</p>
        </div>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-900">
          <p className="text-sm">Blocked</p>
          <p className="text-2xl font-bold">{rows.filter((row) => !row.ready).length}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-6 text-sm text-slate-600">No workspaces to evaluate.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px]">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  {['Workspace', 'Onboarding', 'Support', 'Connector', 'Readiness', 'Top blockers'].map((header) => (
                    <th key={header} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ workspace, ready, blockers }) => (
                  <tr key={workspace.id} className="border-b border-slate-100">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{workspace.name}</p>
                      <p className="text-xs text-slate-500">{workspace.id}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{prettyValue(workspace.onboardingStatus || workspace.status)}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{prettyValue(workspace.supportAssignment?.status || 'UNASSIGNED')}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{prettyValue(workspace.connectorStatus || 'NOT_CONNECTED')}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusTone(ready)}`}>
                        {ready ? 'Ready' : 'Blocked'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{blockers.length ? blockers.slice(0, 2).map((item) => toLabel(item)).join('; ') : 'No blockers'}</td>
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
