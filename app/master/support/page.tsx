'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import SupportCenterTabs from '@/components/SupportCenterTabs';

type SupportStatus = 'UNASSIGNED' | 'ASSIGNED' | 'IN_PROGRESS' | 'WAITING_FOR_CLIENT' | 'COMPLETED';

type SupportAssignment = {
  status: SupportStatus;
  assignedAt?: string;
  assignedBy?: string;
  supportOfficerId?: string;
  supportOfficerName?: string;
  supportOfficerType?: 'CUSTOMER_SUPPORT' | 'TECHNICAL_SUPPORT';
  ticketId?: string;
  technicalSupportOfficerId?: string;
  technicalSupportOfficerName?: string;
  escalationStatus?: 'NONE' | 'REQUESTED' | 'ASSIGNED' | 'RESOLVED';
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
  businessProfile?: Record<string, unknown>;
  collectedBusinessData?: Record<string, unknown>;
  clientOrganizationName?: string;
  assignedClientOrganizationId?: string;
  updatedAt: string;
};

type TeamUserRow = {
  id: string;
  name: string;
  email: string;
  rawAuthRole?: string | null;
  normalizedRole?: string | null;
  normalizedRoles: string[];
  status: 'ACTIVE' | 'INVITED' | 'DISABLED';
};

type SupportOfficerTrack = 'CUSTOMER_SUPPORT' | 'TECHNICAL_SUPPORT';

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
  const classifier = `${user.rawAuthRole || ''} ${user.normalizedRole || ''}`.toUpperCase();
  return roles.includes('CUSTOMER_SUPPORT')
    || roles.includes('TECHNICAL_SUPPORT')
    || classifier.includes('CUSTOMER_SUPPORT')
    || classifier.includes('TECHNICAL_SUPPORT')
    || classifier.includes('TECH_SUPPORT');
}

function getSupportOfficerTrack(user: TeamUserRow): SupportOfficerTrack {
  const classifier = `${user.rawAuthRole || ''} ${user.normalizedRole || ''} ${user.name || ''}`.toUpperCase();
  const roles = Array.isArray(user.normalizedRoles) ? user.normalizedRoles : [];
  if (roles.includes('TECHNICAL_SUPPORT')) {
    return 'TECHNICAL_SUPPORT';
  }
  if (roles.includes('CUSTOMER_SUPPORT')) {
    return 'CUSTOMER_SUPPORT';
  }
  if (classifier.includes('TECHNICAL') || classifier.includes('TECH_SUPPORT') || classifier.includes('TECHNICAL_SUPPORT')) {
    return 'TECHNICAL_SUPPORT';
  }
  if (classifier.includes('DEPLOYMENT_MANAGER')) {
    return 'TECHNICAL_SUPPORT';
  }
  if (classifier.includes('CUSTOMER_SUPPORT') || classifier.includes('CUSTOMER SUPPORT')) {
    return 'CUSTOMER_SUPPORT';
  }
  return 'CUSTOMER_SUPPORT';
}

export default function MasterSupportPage() {
  const [loading, setLoading] = useState(true);
  const [busyWorkspaceId, setBusyWorkspaceId] = useState<string | null>(null);
  const [sessionRequestWorkspaceId, setSessionRequestWorkspaceId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [officers, setOfficers] = useState<TeamUserRow[]>([]);
  const [draftByWorkspace, setDraftByWorkspace] = useState<Record<string, { status: SupportStatus; officerId: string; technicalOfficerId: string }>>({});
  const [searchTerm, setSearchTerm] = useState('');

  const customerSupportOfficers = useMemo(
    () => officers.filter((officer) => getSupportOfficerTrack(officer) === 'CUSTOMER_SUPPORT'),
    [officers],
  );

  const technicalSupportOfficers = useMemo(
    () => officers.filter((officer) => getSupportOfficerTrack(officer) === 'TECHNICAL_SUPPORT'),
    [officers],
  );

  const queue = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const list = workspaces
      .filter((workspace) => workspace.supportRequired || workspace.supportAssignment)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    if (!term) return list;
    return list.filter((workspace) => {
      const blob = [
        workspace.name,
        workspace.id,
        workspace.supportAssignment?.ticketId || '',
        workspace.supportAssignment?.supportOfficerName || '',
        workspace.supportAssignment?.technicalSupportOfficerName || '',
        workspace.supportAssignment?.reason || '',
      ].join(' ').toLowerCase();
      return blob.includes(term);
    });
  }, [workspaces, searchTerm]);

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
            technicalOfficerId: ws.supportAssignment?.technicalSupportOfficerId || '',
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

  function resolveWorkspaceClientEmail(workspace: Workspace): string {
    const profile = workspace.businessProfile || {};
    const collected = workspace.collectedBusinessData || {};

    const email = String(
      profile.contactEmail
        || profile.email
        || collected.contactEmail
        || collected.email
        || '',
    ).trim().toLowerCase();

    return email;
  }

  async function requestSupportAccess(workspace: Workspace) {
    const clientEmail = resolveWorkspaceClientEmail(workspace);
    if (!clientEmail) {
      setError(`No client email found for ${workspace.name}. Add contact email before requesting support access.`);
      return;
    }

    setSessionRequestWorkspaceId(workspace.id);
    setError('');
    setMessage('');

    try {
      const res = await fetch('/api/master/support/request-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: workspace.id,
          reason: `Support Queue request for workspace ${workspace.name}`,
          clientEmail,
        }),
      });
      const payload = (await res.json().catch(() => null)) as { challengeId?: string; error?: string } | null;
      if (!res.ok) {
        throw new Error(payload?.error || 'Failed to request support access session.');
      }

      setMessage(`Support access request sent for ${workspace.name}. Challenge ID: ${payload?.challengeId || 'n/a'}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request support access session.');
    } finally {
      setSessionRequestWorkspaceId(null);
    }
  }

  async function saveAssignment(
    workspace: Workspace,
    draftOverride?: { status: SupportStatus; officerId: string; technicalOfficerId: string },
  ) {
    const draft = draftOverride || draftByWorkspace[workspace.id];
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
            supportOfficerType: 'CUSTOMER_SUPPORT',
            technicalSupportOfficerId: draft.technicalOfficerId || undefined,
            technicalSupportOfficerName: draft.technicalOfficerId ? technicalSupportOfficers.find((user) => user.id === draft.technicalOfficerId)?.name : undefined,
            escalationStatus: draft.technicalOfficerId ? 'ASSIGNED' : 'NONE',
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
            supportOfficerType: 'CUSTOMER_SUPPORT',
            technicalSupportOfficerId: draft.technicalOfficerId || undefined,
            technicalSupportOfficerName: draft.technicalOfficerId ? technicalSupportOfficers.find((user) => user.id === draft.technicalOfficerId)?.name : undefined,
            escalationStatus: draft.technicalOfficerId ? 'ASSIGNED' : undefined,
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

  async function resetSupport(target: 'support_db' | 'support_queue') {
    const label = target === 'support_db' ? 'support database sessions and OTP challenges' : 'support queue assignments';
    const confirmed = window.confirm(`Reset ${label}? This action cannot be undone.`);
    if (!confirmed) return;

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const res = await fetch('/api/master/support/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target }),
      });

      const payload = (await res.json().catch(() => null)) as {
        error?: string;
        clearedOtpChallenges?: number;
        clearedSessions?: number;
        clearedQueueAssignments?: number;
      } | null;

      if (!res.ok) {
        throw new Error(payload?.error || 'Support reset failed.');
      }

      const statusMessage = target === 'support_db'
        ? `Support database reset complete. Cleared ${payload?.clearedOtpChallenges || 0} OTP challenges and ${payload?.clearedSessions || 0} sessions.`
        : `Support queue reset complete. Cleared ${payload?.clearedQueueAssignments || 0} workspace assignments.`;

      setMessage(statusMessage);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Support reset failed.');
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Master Support Center</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Support Queue</h1>
          <p className="mt-2 text-sm text-slate-600">Internal onboarding/support assignment workflow by workspace.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/master/tickets/new" className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">
            Create Ticket
          </Link>
          <button
            type="button"
            onClick={() => void resetSupport('support_db')}
            disabled={loading}
            className="rounded-full border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 disabled:opacity-60"
          >
            Reset Support DB
          </button>
          <button
            type="button"
            onClick={() => void resetSupport('support_queue')}
            disabled={loading}
            className="rounded-full border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-700 disabled:opacity-60"
          >
            Reset Support Queue
          </button>
          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            Refresh
          </button>
        </div>
      </div>

      <SupportCenterTabs active="queue" />

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

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Filter support queue</label>
        <input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by workspace, ticket, officer, reason"
          className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

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

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        {loading ? (
          <div className="p-6 text-sm text-slate-600">Loading support queue...</div>
        ) : queue.length === 0 ? (
          <div className="p-6 text-sm text-slate-600">No support items in queue.</div>
        ) : (
          <div className="space-y-3">
            {queue.map((workspace) => {
              const draft = draftByWorkspace[workspace.id] || { status: 'UNASSIGNED' as const, officerId: '', technicalOfficerId: '' };
              const busy = busyWorkspaceId === workspace.id;
              const busySession = sessionRequestWorkspaceId === workspace.id;
              const clientEmail = resolveWorkspaceClientEmail(workspace);

              return (
                <div key={workspace.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{workspace.name}</p>
                      <p className="text-xs text-slate-500">{workspace.id}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Link href={`/master/mvp-deployments/${workspace.id}`} className="text-xs font-semibold text-slate-700 underline">
                          View workspace
                        </Link>
                        <Link href={`/master/tickets?workspaceId=${encodeURIComponent(workspace.id)}`} className="text-xs font-semibold text-slate-700 underline">
                          View related tickets
                        </Link>
                        {workspace.supportAssignment?.ticketId ? (
                          <Link href={`/master/tickets/${workspace.supportAssignment.ticketId}`} className="text-xs font-semibold text-slate-700 underline">
                            View
                          </Link>
                        ) : null}
                      </div>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{workspace.supportAssignment?.ticketId || 'Ticket pending'}</span>
                  </div>

                  <div className="mt-3 grid gap-3 text-sm text-slate-700 md:grid-cols-2 xl:grid-cols-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p>
                      <select
                        value={draft.status}
                        onChange={(e) => setDraftByWorkspace((prev) => ({
                          ...prev,
                          [workspace.id]: { ...draft, status: e.target.value as SupportStatus },
                        }))}
                        className="mt-1 rounded-xl border border-slate-300 px-2 py-1 text-xs"
                        disabled={busy}
                      >
                        {(['UNASSIGNED', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_FOR_CLIENT', 'COMPLETED'] as const).map((status) => (
                          <option key={`${workspace.id}-${status}`} value={status}>
                            {prettyValue(status)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Priority / Setup</p>
                      <p>{prettyValue(workspace.supportAssignment?.priority || 'MEDIUM')}</p>
                      <p className="text-xs text-slate-500">{prettyValue(workspace.supportAssignment?.setupType || workspace.websiteType || 'NEW_WEBSITE')}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reason</p>
                      <p>{workspace.supportAssignment?.reason || (workspace.supportRequired ? 'Support required' : 'Awaiting queue triage')}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Updated</p>
                      <p>{new Date(workspace.updatedAt).toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <select
                      value={draft.officerId}
                      onChange={(e) => setDraftByWorkspace((prev) => ({
                        ...prev,
                        [workspace.id]: { ...draft, officerId: e.target.value },
                      }))}
                      className="rounded-xl border border-slate-300 px-2 py-1 text-xs"
                      disabled={busy}
                    >
                      <option value="">Customer support</option>
                      {customerSupportOfficers.map((officer) => (
                        <option key={`${workspace.id}-customer-${officer.id}`} value={officer.id}>
                          {officer.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={draft.technicalOfficerId}
                      onChange={(e) => setDraftByWorkspace((prev) => ({
                        ...prev,
                        [workspace.id]: { ...draft, technicalOfficerId: e.target.value },
                      }))}
                      className="rounded-xl border border-slate-300 px-2 py-1 text-xs"
                      disabled={busy}
                    >
                      <option value="">Technical support</option>
                      {technicalSupportOfficers.map((officer) => (
                        <option key={`${workspace.id}-technical-${officer.id}`} value={officer.id}>
                          {officer.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => void saveAssignment(workspace)}
                      disabled={busy}
                      className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                    >
                      {busy ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const completedDraft = {
                          ...draft,
                          status: 'COMPLETED' as const,
                        };
                        setDraftByWorkspace((prev) => ({
                          ...prev,
                          [workspace.id]: completedDraft,
                        }));
                        void saveAssignment(workspace, completedDraft);
                      }}
                      disabled={busy}
                      className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-60"
                    >
                      Mark Stage Complete
                    </button>
                    <button
                      type="button"
                      onClick={() => void requestSupportAccess(workspace)}
                      disabled={busySession || !clientEmail}
                      className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-60"
                      title={clientEmail ? 'Request support access session' : 'Client email missing for this workspace'}
                    >
                      {busySession ? 'Requesting...' : 'Request Support Access'}
                    </button>
                    {!clientEmail ? <span className="text-xs text-amber-700">Client email missing</span> : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
