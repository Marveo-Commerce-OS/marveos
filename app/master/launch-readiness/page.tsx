'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type Workspace = {
  id: string;
  name: string;
  websiteType?: 'NEW_WEBSITE' | 'EXISTING_WEBSITE' | 'CUSTOM_HEADLESS';
  selectedTemplateId?: string;
  connectorStatus?: string;
  missingRequirements?: string[];
  onboardingStatus?: string;
  status: string;
  supportRequired?: boolean;
  supportAssignment?: { status: string; supportOfficerId?: string; supportOfficerName?: string };
  updatedAt: string;
};

type TeamUserRow = {
  id: string;
  name: string;
  normalizedRoles: string[];
  status: 'ACTIVE' | 'INVITED' | 'DISABLED';
};

type ChecklistResponse = {
  blockers: string[];
  generatedAt: string;
  readyForLaunch: boolean;
};

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
  NEW_WEBSITE: 'New website',
  EXISTING_WEBSITE: 'Existing website',
  CUSTOM_HEADLESS: 'Custom / headless',
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

function prettyValue(value: string): string {
  const key = normalizeToken(value);
  return STATUS_LABELS[key] || toLabel(value);
}

function statusTone(ready: boolean) {
  return ready ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700';
}

function isConnectorScopedRequirement(requirement: string): boolean {
  const text = requirement.toLowerCase();
  return text.includes('connector')
    || text.includes('site connection token')
    || text.includes('website connection');
}

function isSupportOfficer(user: TeamUserRow): boolean {
  const roles = Array.isArray(user.normalizedRoles) ? user.normalizedRoles : [];
  return roles.includes('CUSTOMER_SUPPORT')
    || roles.includes('TECHNICAL_SUPPORT')
    || roles.includes('ADMIN')
    || roles.includes('SUPER_ADMIN');
}

export default function MasterLaunchReadinessPage() {
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [officers, setOfficers] = useState<TeamUserRow[]>([]);
  const [draftOfficerByWorkspace, setDraftOfficerByWorkspace] = useState<Record<string, string>>({});

  const [refreshedBlockersByWorkspace, setRefreshedBlockersByWorkspace] = useState<Record<string, { blockers: string[]; at: string }>>({});

  const rows = useMemo(() => {
    return workspaces.map((workspace) => {
      const websiteType = String(workspace.websiteType || '');
      const missing = Array.isArray(workspace.missingRequirements) ? workspace.missingRequirements : [];
      const scopedMissingRequirements = missing.filter((item) => {
        if (websiteType === 'EXISTING_WEBSITE') return true;
        return !isConnectorScopedRequirement(item);
      });

      const supportPending = Boolean(workspace.supportRequired) && (workspace.supportAssignment?.status || 'UNASSIGNED') !== 'ASSIGNED';
      const connectorPending = workspace.websiteType === 'EXISTING_WEBSITE'
        && !workspace.supportRequired
        && workspace.connectorStatus !== 'CONNECTED';
      const blockedByRequirements = scopedMissingRequirements.length > 0;
      const ready = !supportPending && !connectorPending && !blockedByRequirements && workspace.status !== 'blocked';

      const blockers = [
        ...scopedMissingRequirements,
        ...(supportPending ? ['Support assignment pending'] : []),
        ...(connectorPending ? ['Connector not verified'] : []),
      ];

      const refreshed = refreshedBlockersByWorkspace[workspace.id];
      const renderedBlockers = refreshed?.blockers?.length ? refreshed.blockers : blockers;

      return { workspace, ready, blockers: renderedBlockers, refreshedAt: refreshed?.at || null };
    });
  }, [workspaces, refreshedBlockersByWorkspace]);

  const stats = useMemo(() => {
    return {
      reviewed: rows.length,
      ready: rows.filter((row) => row.ready).length,
      blocked: rows.filter((row) => !row.ready).length,
    };
  }, [rows]);

  async function load() {
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const [workspaceRes, usersRes] = await Promise.all([
        fetch('/api/cloud/workspaces', { cache: 'no-store' }),
        fetch('/api/master/users', { cache: 'no-store' }),
      ]);

      const workspaceData = (await workspaceRes.json().catch(() => null)) as { workspaces?: Workspace[]; error?: string } | null;
      if (!workspaceRes.ok) throw new Error(workspaceData?.error || 'Failed to load workspaces');

      const usersData = (await usersRes.json().catch(() => null)) as { users?: TeamUserRow[]; error?: string } | null;
      if (!usersRes.ok) throw new Error(usersData?.error || 'Failed to load team directory');

      const nextWorkspaces = Array.isArray(workspaceData?.workspaces) ? workspaceData.workspaces : [];
      const nextOfficers = Array.isArray(usersData?.users) ? usersData.users.filter(isSupportOfficer).filter((u) => u.status === 'ACTIVE') : [];

      setWorkspaces(nextWorkspaces);
      setOfficers(nextOfficers);
      setDraftOfficerByWorkspace((prev) => {
        const next = { ...prev };
        for (const ws of nextWorkspaces) {
          if (next[ws.id]) continue;
          next[ws.id] = ws.supportAssignment?.supportOfficerId || '';
        }
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load launch readiness');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function refreshChecklist(workspaceId: string) {
    setBusyId(workspaceId);
    setError('');
    setMessage('');

    try {
      const res = await fetch(`/api/cloud/workspaces/${encodeURIComponent(workspaceId)}/launch-checklist`, { cache: 'no-store' });
      const data = (await res.json().catch(() => null)) as ChecklistResponse | null;
      if (!res.ok || !data) throw new Error('Checklist refresh failed');

      setRefreshedBlockersByWorkspace((prev) => ({
        ...prev,
        [workspaceId]: {
          blockers: Array.isArray(data.blockers) ? data.blockers : [],
          at: new Date().toISOString(),
        },
      }));

      setMessage(`Refreshed checklist for ${workspaceId}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checklist refresh failed');
    } finally {
      setBusyId(null);
    }
  }

  async function setSupportRequired(workspaceId: string, supportRequired: boolean) {
    setBusyId(workspaceId);
    setError('');
    setMessage('');

    try {
      const res = await fetch(`/api/cloud/workspaces/${encodeURIComponent(workspaceId)}/support-required`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supportRequired }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Support required update failed');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Support required update failed');
    } finally {
      setBusyId(null);
    }
  }

  async function assignSupportOfficer(workspace: Workspace) {
    const officerId = draftOfficerByWorkspace[workspace.id] || '';
    const officer = officers.find((user) => user.id === officerId) || null;
    if (!officerId || !officer) {
      setError('Select a support officer first.');
      return;
    }

    setBusyId(workspace.id);
    setError('');
    setMessage('');

    try {
      const hasExisting = Boolean(workspace.supportAssignment);
      if (!hasExisting) {
        const setupType = workspace.websiteType || 'NEW_WEBSITE';
        const res = await fetch(`/api/cloud/workspaces/${encodeURIComponent(workspace.id)}/support-assignment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId: workspace.id,
            priority: 'MEDIUM',
            reason: 'Assigned from /master/launch-readiness',
            setupType,
            requiredSkills: ['Launch review'],
            initialNotes: 'Created via Launch Readiness',
            supportOfficerId: officerId,
            supportOfficerName: officer.name,
          }),
        });
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        if (!res.ok) throw new Error(data?.error || 'Support assignment create failed');
      } else {
        const res = await fetch(`/api/cloud/workspaces/${encodeURIComponent(workspace.id)}/support-assignment`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'ASSIGNED',
            supportOfficerId: officerId,
            supportOfficerName: officer.name,
          }),
        });
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        if (!res.ok) throw new Error(data?.error || 'Support assignment update failed');
      }

      setMessage(`Assigned support officer for ${workspace.name}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Support assignment failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Launch Readiness</h1>
          <p className="mt-2 text-sm text-slate-600">Cross-workspace launch checklist aggregation from orchestration and connector state.</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          Refresh
        </button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
          <p className="text-sm font-semibold">Launch readiness unavailable</p>
          <p className="mt-1 text-sm">{error}</p>
        </div>
      ) : null}

      {message ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
          <p className="text-sm">{message}</p>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-600">Workspaces reviewed</p>
          <p className="text-2xl font-bold text-slate-900">{stats.reviewed}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
          <p className="text-sm">Ready for launch</p>
          <p className="text-2xl font-bold">{stats.ready}</p>
        </div>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-900">
          <p className="text-sm">Blocked</p>
          <p className="text-2xl font-bold">{stats.blocked}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-slate-600">Loading launch readiness...</div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-sm text-slate-600">No workspaces to evaluate.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1400px]">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  {['Workspace', 'Website type', 'Connector / Template', 'Support', 'Readiness', 'Top blockers', 'Manual review', 'Actions'].map((header) => (
                    <th key={header} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ workspace, ready, blockers, refreshedAt }) => {
                  const busy = busyId === workspace.id;
                  const supportStatus = workspace.supportAssignment?.status || 'UNASSIGNED';

                  return (
                    <tr key={workspace.id} className="border-b border-slate-100 align-top">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">{workspace.name}</p>
                        <p className="text-xs text-slate-500">{workspace.id}</p>
                        <div className="mt-2">
                          <Link href={`/master/mvp-deployments/${workspace.id}`} className="text-xs font-semibold text-slate-700 underline">
                            View workspace
                          </Link>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">{prettyValue(workspace.websiteType || 'Not set')}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {workspace.websiteType === 'EXISTING_WEBSITE' ? (
                          <div>
                            <div>{prettyValue(workspace.connectorStatus || 'NOT_CONNECTED')}</div>
                            <div className="text-xs text-slate-500">Connector-driven</div>
                          </div>
                        ) : (
                          <div>
                            <div>{workspace.selectedTemplateId ? workspace.selectedTemplateId : 'Template not selected'}</div>
                            <div className="text-xs text-slate-500">Template-driven</div>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">{prettyValue(supportStatus)}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusTone(ready)}`}>
                          {ready ? 'Ready' : 'Blocked'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {blockers.length ? blockers.slice(0, 2).map((item) => toLabel(item)).join('; ') : 'No blockers'}
                        {refreshedAt ? <p className="mt-1 text-[11px] text-slate-500">Checklist refreshed {new Date(refreshedAt).toLocaleTimeString()}</p> : null}
                      </td>
                      <td className="px-4 py-3">
                        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={Boolean(workspace.supportRequired)}
                            onChange={(e) => void setSupportRequired(workspace.id, e.target.checked)}
                            disabled={busy}
                          />
                          <span className="text-xs">{workspace.supportRequired ? 'Required' : 'Not required'}</span>
                        </label>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-2">
                          <button
                            type="button"
                            onClick={() => void refreshChecklist(workspace.id)}
                            disabled={busy}
                            className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-800 disabled:opacity-60"
                          >
                            Refresh checklist
                          </button>

                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              value={draftOfficerByWorkspace[workspace.id] || ''}
                              onChange={(e) => setDraftOfficerByWorkspace((prev) => ({ ...prev, [workspace.id]: e.target.value }))}
                              className="rounded-xl border border-slate-300 px-2 py-1 text-xs"
                              disabled={busy}
                            >
                              <option value="">Assign officer…</option>
                              {officers.map((officer) => (
                                <option key={`${workspace.id}-${officer.id}`} value={officer.id}>
                                  {officer.name}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => void assignSupportOfficer(workspace)}
                              disabled={busy}
                              className="rounded-full bg-indigo-100 px-3 py-1.5 text-xs font-semibold text-indigo-900 disabled:opacity-60"
                            >
                              Assign
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
