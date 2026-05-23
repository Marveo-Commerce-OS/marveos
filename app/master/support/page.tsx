'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type SupportStatus = 'UNASSIGNED' | 'ASSIGNED' | 'IN_PROGRESS' | 'WAITING_FOR_CLIENT' | 'COMPLETED';

type SupportAssignment = {
  status: SupportStatus;
  assignedAt?: string;
  assignedBy?: string;
  supportOfficerId?: string;
  supportOfficerName?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  reason?: string;
  setupType?: 'NEW_WEBSITE' | 'EXISTING_WEBSITE' | 'CUSTOM_HEADLESS';
  requiredSkills?: string[];
  initialNotes?: string;
};

type Workspace = {
  id: string;
  name: string;
  websiteType?: 'NEW_WEBSITE' | 'EXISTING_WEBSITE' | 'CUSTOM_HEADLESS';
  supportRequired?: boolean;
  supportAssignment?: SupportAssignment;
  updatedAt: string;
};

type TeamUserRow = {
  id: string;
  name: string;
  email: string;
  normalizedRoles: string[];
  status: 'ACTIVE' | 'INVITED' | 'DISABLED';
};

type UsersApiResponse = {
  users: TeamUserRow[];
  error?: string;
};

const STATUS_LABELS: Record<string, string> = {
  UNASSIGNED: 'Unassigned',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In progress',
  WAITING_FOR_CLIENT: 'Waiting for client',
  COMPLETED: 'Completed',
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
  NEW_WEBSITE: 'New website',
  EXISTING_WEBSITE: 'Existing website',
  CUSTOM_HEADLESS: 'Custom / headless',
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

function isSupportOfficer(user: TeamUserRow): boolean {
  const roles = Array.isArray(user.normalizedRoles) ? user.normalizedRoles : [];
  return roles.includes('SUPPORT_OFFICER') || roles.includes('ADMIN') || roles.includes('SUPER_ADMIN');
}

export default function MasterSupportPage() {
  const [loading, setLoading] = useState(true);
  const [busyWorkspaceId, setBusyWorkspaceId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [officers, setOfficers] = useState<TeamUserRow[]>([]);
  const [draftByWorkspace, setDraftByWorkspace] = useState<Record<string, { status: SupportStatus; officerId: string }>>({});

  const queue = useMemo(() => {
    return workspaces
      .filter((workspace) => workspace.supportRequired || workspace.supportAssignment)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [workspaces]);

  const metrics = useMemo(() => {
    const openAssignments = queue.filter((workspace) => {
      if (!workspace.supportRequired) return false;
      return workspace.supportAssignment?.status !== 'ASSIGNED';
    }).length;

    const assigned = queue.filter((workspace) => workspace.supportAssignment?.status === 'ASSIGNED').length;

    return {
      queueSize: queue.length,
      openAssignments,
      assigned,
    };
  }, [queue]);

  async function loadData() {
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const [workspaceRes, userRes] = await Promise.all([
        fetch('/api/cloud/workspaces', { cache: 'no-store' }),
        fetch('/api/master/users', { cache: 'no-store' }),
      ]);

      const workspaceData = (await workspaceRes.json().catch(() => null)) as { workspaces?: Workspace[]; error?: string } | null;
      if (!workspaceRes.ok) throw new Error(workspaceData?.error || 'Failed to load workspaces.');

      const usersData = (await userRes.json().catch(() => null)) as UsersApiResponse | null;
      if (!userRes.ok) throw new Error(usersData?.error || 'Failed to load team directory.');

      const nextWorkspaces = Array.isArray(workspaceData?.workspaces) ? workspaceData.workspaces : [];
      const nextOfficers = Array.isArray(usersData?.users) ? usersData.users.filter(isSupportOfficer).filter((u) => u.status === 'ACTIVE') : [];

      setWorkspaces(nextWorkspaces);
      setOfficers(nextOfficers);

      setDraftByWorkspace((current) => {
        const next = { ...current };
        for (const ws of nextWorkspaces) {
          if (next[ws.id]) continue;
          next[ws.id] = {
            status: ws.supportAssignment?.status || 'UNASSIGNED',
            officerId: ws.supportAssignment?.supportOfficerId || '',
          };
        }
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load support queue.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  function officerLabel(officerId: string): string {
    if (!officerId) return 'Unassigned';
    const match = officers.find((user) => user.id === officerId);
    return match ? `${match.name}${match.email ? ` (${match.email})` : ''}` : officerId;
  }

  async function saveAssignment(workspace: Workspace) {
    const draft = draftByWorkspace[workspace.id];
    if (!draft) return;

    setBusyWorkspaceId(workspace.id);
    setError('');
    setMessage('');

    try {
      const officer = officers.find((user) => user.id === draft.officerId) || null;
      const officerName = officer ? officer.name : draft.officerId ? draft.officerId : 'Unassigned';

      const hasExisting = Boolean(workspace.supportAssignment);

      if (!hasExisting && (draft.status !== 'UNASSIGNED' || draft.officerId)) {
        const setupType = workspace.websiteType || 'NEW_WEBSITE';
        const res = await fetch(`/api/cloud/workspaces/${encodeURIComponent(workspace.id)}/support-assignment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId: workspace.id,
            priority: 'MEDIUM',
            reason: 'Assigned from /master/support queue',
            setupType,
            requiredSkills: ['Onboarding'],
            initialNotes: 'Created via Master Support queue',
            supportOfficerId: draft.officerId || 'support-queue',
            supportOfficerName: draft.officerId ? officerName : 'Marveo Support Queue',
          }),
        });
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        if (!res.ok) throw new Error(data?.error || 'Support assignment create failed.');
      } else {
        const res = await fetch(`/api/cloud/workspaces/${encodeURIComponent(workspace.id)}/support-assignment`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: draft.status,
            supportOfficerId: draft.officerId || undefined,
            supportOfficerName: draft.officerId ? officerName : undefined,
            reason: workspace.supportAssignment?.reason || (workspace.supportRequired ? 'Support required flagged' : undefined),
          }),
        });
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        if (!res.ok) throw new Error(data?.error || 'Support assignment update failed.');
      }

      setMessage(`Saved support assignment for ${workspace.name}.`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update support assignment.');
    } finally {
      setBusyWorkspaceId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Support Queue</h1>
          <p className="mt-2 text-sm text-slate-600">Queue of workspaces requiring onboarding or launch support assignment.</p>
        </div>
        <button
          type="button"
          onClick={() => void loadData()}
          disabled={loading}
          className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          Refresh
        </button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
          <p className="text-sm font-semibold">Support queue unavailable</p>
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
          <p className="text-sm text-slate-600">Queue size</p>
          <p className="text-2xl font-bold text-slate-900">{metrics.queueSize}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <p className="text-sm">Open assignments</p>
          <p className="text-2xl font-bold">{metrics.openAssignments}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
          <p className="text-sm">Assigned</p>
          <p className="text-2xl font-bold">{metrics.assigned}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-slate-600">Loading support queue...</div>
        ) : queue.length === 0 ? (
          <div className="p-6 text-sm text-slate-600">No support items in queue.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px]">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  {['Workspace', 'Status', 'Priority', 'Setup Type', 'Reason', 'Officer', 'Updated', 'Actions'].map((header) => (
                    <th key={header} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {queue.map((workspace) => {
                  const draft = draftByWorkspace[workspace.id] || { status: 'UNASSIGNED' as const, officerId: '' };
                  const busy = busyWorkspaceId === workspace.id;

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
                      <td className="px-4 py-3">
                        <select
                          value={draft.status}
                          onChange={(e) => setDraftByWorkspace((prev) => ({
                            ...prev,
                            [workspace.id]: { ...draft, status: e.target.value as SupportStatus },
                          }))}
                          className="rounded-xl border border-slate-300 px-2 py-1 text-xs"
                          disabled={busy}
                        >
                          {(['UNASSIGNED', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_FOR_CLIENT', 'COMPLETED'] as const).map((status) => (
                            <option key={`${workspace.id}-${status}`} value={status}>
                              {prettyValue(status)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">{prettyValue(workspace.supportAssignment?.priority || 'MEDIUM')}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{prettyValue(workspace.supportAssignment?.setupType || workspace.websiteType || 'NEW_WEBSITE')}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{workspace.supportAssignment?.reason || (workspace.supportRequired ? 'Support required' : 'Awaiting queue triage')}</td>
                      <td className="px-4 py-3">
                        <select
                          value={draft.officerId}
                          onChange={(e) => setDraftByWorkspace((prev) => ({
                            ...prev,
                            [workspace.id]: { ...draft, officerId: e.target.value },
                          }))}
                          className="rounded-xl border border-slate-300 px-2 py-1 text-xs"
                          disabled={busy}
                        >
                          <option value="">Unassigned</option>
                          {officers.map((officer) => (
                            <option key={`${workspace.id}-${officer.id}`} value={officer.id}>
                              {officer.name}
                            </option>
                          ))}
                        </select>
                        <p className="mt-1 text-[11px] text-slate-500">{draft.officerId ? officerLabel(draft.officerId) : '—'}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">{new Date(workspace.updatedAt).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => void saveAssignment(workspace)}
                          disabled={busy}
                          className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                        >
                          {busy ? 'Saving…' : 'Save'}
                        </button>
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
