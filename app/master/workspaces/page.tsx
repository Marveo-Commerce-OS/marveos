export const dynamic = 'force-dynamic';

import Link from 'next/link';
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

function badge(status: string) {
  const key = status.toLowerCase();
  if (key.includes('live') || key.includes('ready')) return 'bg-emerald-100 text-emerald-700';
  if (key.includes('fail') || key.includes('blocked')) return 'bg-red-100 text-red-700';
  if (key.includes('deploy') || key.includes('progress')) return 'bg-blue-100 text-blue-700';
  return 'bg-slate-100 text-slate-700';
}

export default async function MasterWorkspacesPage() {
  const snapshot = await getControlCenterSnapshot();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Workspaces</h1>
          <p className="mt-2 text-sm text-slate-600">All orchestrated workspaces across clients and onboarding paths.</p>
        </div>
        <Link href="/master/mvp-deployments" className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
          Open deployment queue
        </Link>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-600">Workspace footprint</p>
        <p className="text-2xl font-bold text-slate-900">
          {snapshot.workspaces.length} / {snapshot.workspaceLimit === 999 ? 'Unlimited' : snapshot.workspaceLimit}
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        {snapshot.workspaces.length === 0 ? (
          <div className="p-6 text-sm text-slate-600">No workspaces found yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px]">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  {['Workspace', 'Website Type', 'Plan', 'Onboarding Status', 'Connector', 'Platform', 'Support', 'Updated'].map((header) => (
                    <th key={header} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {snapshot.workspaces.map((workspace) => (
                  <tr key={workspace.id} className="border-b border-slate-100">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{workspace.name}</p>
                      <p className="text-xs text-slate-500">{workspace.id}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{snapshot.websiteTypeLabel(workspace.websiteType)}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{workspace.planId || snapshot.accountPlan}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${badge(workspace.onboardingStatus || workspace.status)}`}>
                        {prettyValue(workspace.onboardingStatus || workspace.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{prettyValue(workspace.connectorStatus || 'NOT_CONNECTED')}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {workspace.connectorSiteMetadata?.platform || String((workspace.collectedBusinessData as Record<string, unknown> | undefined)?.currentPlatform || '').trim() || 'Unknown'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{prettyValue(workspace.supportAssignment?.status || 'UNASSIGNED')}</td>
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
