'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { copyTextToClipboard } from '@/lib/client/clipboard';

type SupportStatus = 'UNASSIGNED' | 'ASSIGNED' | 'IN_PROGRESS' | 'WAITING_FOR_CLIENT' | 'COMPLETED';

type SupportAssignment = {
  status: SupportStatus;
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
};

type Workspace = {
  id: string;
  clientOrganizationId?: string;
  name: string;
  clientOrganizationName?: string;
  planId?: string;
  websiteType?: 'NEW_WEBSITE' | 'EXISTING_WEBSITE' | 'CUSTOM_HEADLESS';
  onboardingStatus?: string;
  status: string;
  connectorStatus?: string;
  connectorLastVerificationAttempt?: string;
  connectorSiteMetadata?: { platform?: string; siteUrl?: string } | null;
  supportRequired?: boolean;
  supportAssignment?: SupportAssignment;
  businessProfile?: Record<string, unknown>;
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

type SubscriptionRow = {
  id: string;
  ownerEmail: string;
  organizationName: string;
  planId: string;
  billingInterval: string;
  country: string;
  currency: string;
  amount: number;
  status: string;
  trialEndDate: string | null;
  paymentMode: string;
  paymentReference: string | null;
  updatedAt: string;
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
  UNASSIGNED: 'Unassigned',
  ASSIGNED: 'Assigned',
  IN_PROGRESS_SUPPORT: 'In progress',
  WAITING_FOR_CLIENT_SUPPORT: 'Waiting for client',
  COMPLETED: 'Completed',
  NOT_CONNECTED: 'Not connected',
  TOKEN_GENERATED: 'Token generated',
  PENDING_VERIFICATION: 'Pending verification',
  CONNECTED: 'Connected',
  SUPPORT_REQUIRED: 'Support required',
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

function badge(status: string) {
  const key = status.toLowerCase();
  if (key.includes('live') || key.includes('ready') || key.includes('connected')) return 'bg-emerald-100 text-emerald-700';
  if (key.includes('fail') || key.includes('blocked')) return 'bg-red-100 text-red-700';
  if (key.includes('deploy') || key.includes('progress')) return 'bg-blue-100 text-blue-700';
  if (key.includes('pending') || key.includes('wait')) return 'bg-amber-100 text-amber-700';
  return 'bg-slate-100 text-slate-700';
}

function getContactEmail(workspace: Workspace): string {
  const profile = workspace.businessProfile || {};
  const email = String(profile.contactEmail || '').trim().toLowerCase();
  return email;
}

function isSupportTeamMember(user: TeamUserRow): boolean {
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
  if (roles.includes('DEPLOYMENT_MANAGER') || classifier.includes('DEPLOYMENT_MANAGER')) {
    return 'TECHNICAL_SUPPORT';
  }
  if (classifier.includes('CUSTOMER_SUPPORT') || classifier.includes('CUSTOMER SUPPORT')) {
    return 'CUSTOMER_SUPPORT';
  }
  return 'CUSTOMER_SUPPORT';
}

function workspaceMatchesClientFilter(workspace: Workspace, filter: string): boolean {
  if (!filter) return true;
  const normalizedFilter = filter.trim().toLowerCase();
  if (!normalizedFilter) return true;

  const contactEmail = getContactEmail(workspace);
  const organizationId = String(workspace.clientOrganizationId || '').trim().toLowerCase();
  return contactEmail === normalizedFilter || organizationId === normalizedFilter;
}

export default function MasterWorkspacesPage() {
  const searchParams = useSearchParams();
  const clientFilter = (searchParams.get('client') || '').trim().toLowerCase();

  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [officers, setOfficers] = useState<TeamUserRow[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const [draftByWorkspace, setDraftByWorkspace] = useState<Record<string, { officerId: string; technicalOfficerId: string }>>({});

  const subscriptionByEmail = useMemo(() => {
    const map = new Map<string, SubscriptionRow>();
    for (const subscription of subscriptions) {
      const email = subscription.ownerEmail.trim().toLowerCase();
      if (!email) continue;
      const existing = map.get(email);
      if (!existing || subscription.updatedAt > existing.updatedAt) {
        map.set(email, subscription);
      }
    }
    return map;
  }, [subscriptions]);

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return workspaces.filter((workspace) => {
      if (!workspaceMatchesClientFilter(workspace, clientFilter)) return false;
      if (!term) return true;
      const blob = [
        workspace.name,
        workspace.id,
        workspace.clientOrganizationId || '',
        workspace.clientOrganizationName || '',
        getContactEmail(workspace),
        workspace.planId || '',
        workspace.supportAssignment?.ticketId || '',
        workspace.supportAssignment?.supportOfficerName || '',
        workspace.supportAssignment?.technicalSupportOfficerName || '',
      ].join(' ').toLowerCase();
      return blob.includes(term);
    });
  }, [workspaces, clientFilter, searchTerm]);

  const customerSupportOfficers = useMemo(
    () => officers.filter((officer) => getSupportOfficerTrack(officer) === 'CUSTOMER_SUPPORT'),
    [officers],
  );

  const technicalSupportOfficers = useMemo(
    () => officers.filter((officer) => getSupportOfficerTrack(officer) === 'TECHNICAL_SUPPORT'),
    [officers],
  );

  async function loadData() {
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const [workspaceRes, usersRes, billingRes] = await Promise.all([
        fetch('/api/cloud/workspaces', { cache: 'no-store' }),
        fetch('/api/master/users', { cache: 'no-store' }),
        fetch('/api/master/billing/subscriptions', { cache: 'no-store' }),
      ]);

      const workspaceData = (await workspaceRes.json().catch(() => null)) as { workspaces?: Workspace[]; error?: string } | null;
      if (!workspaceRes.ok) throw new Error(workspaceData?.error || 'Failed to load workspaces.');

      const usersData = (await usersRes.json().catch(() => null)) as { users?: TeamUserRow[]; error?: string } | null;
      if (!usersRes.ok) throw new Error(usersData?.error || 'Failed to load master users.');

      const billingData = (await billingRes.json().catch(() => null)) as { subscriptions?: SubscriptionRow[]; error?: string } | null;
      if (!billingRes.ok) throw new Error(billingData?.error || 'Failed to load subscriptions.');

      const nextWorkspaces = Array.isArray(workspaceData?.workspaces) ? workspaceData.workspaces : [];
      const nextOfficers = Array.isArray(usersData?.users) ? usersData.users.filter(isSupportTeamMember).filter((u) => u.status === 'ACTIVE') : [];
      const nextSubscriptions = Array.isArray(billingData?.subscriptions) ? billingData.subscriptions : [];

      setWorkspaces(nextWorkspaces);
      setOfficers(nextOfficers);
      setSubscriptions(nextSubscriptions);

      setDraftByWorkspace((current) => {
        const next = { ...current };
        for (const ws of nextWorkspaces) {
          if (next[ws.id]) continue;
          next[ws.id] = {
            officerId: ws.supportAssignment?.supportOfficerId || '',
            technicalOfficerId: ws.supportAssignment?.technicalSupportOfficerId || '',
          };
        }
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workspace operations.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function copyWorkspaceId(workspaceId: string) {
    try {
      const copied = await copyTextToClipboard(workspaceId);
      if (!copied) {
        throw new Error('copy-failed');
      }
      setMessage('Workspace ID copied.');
      window.setTimeout(() => setMessage(''), 1500);
    } catch {
      setError('Could not copy workspace ID. Click inside the page and try again.');
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
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Failed to update supportRequired');
      setMessage(`Support required: ${supportRequired ? 'enabled' : 'disabled'}.`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update supportRequired.');
    } finally {
      setBusyId(null);
    }
  }

  async function assignSupportOfficer(workspace: Workspace) {
    const draft = draftByWorkspace[workspace.id];
    if (!draft || !draft.officerId) {
      setError('Select a support officer first.');
      return;
    }

    setBusyId(workspace.id);
    setError('');
    setMessage('');

    try {
      const officer = officers.find((user) => user.id === draft.officerId) || null;
      const officerName = officer ? officer.name : draft.officerId;

      const hasExisting = Boolean(workspace.supportAssignment);
      if (!hasExisting) {
        const setupType = workspace.websiteType || 'NEW_WEBSITE';
        const res = await fetch(`/api/cloud/workspaces/${encodeURIComponent(workspace.id)}/support-assignment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId: workspace.id,
            priority: 'MEDIUM',
            reason: 'Assigned from /master/workspaces',
            setupType,
            requiredSkills: ['Onboarding'],
            initialNotes: 'Created via Master Workspaces',
            supportOfficerId: draft.officerId,
            supportOfficerName: officerName,
            supportOfficerType: 'CUSTOMER_SUPPORT',
          }),
        });
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        if (!res.ok) throw new Error(data?.error || 'Support assignment create failed.');
      } else {
        const res = await fetch(`/api/cloud/workspaces/${encodeURIComponent(workspace.id)}/support-assignment`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'ASSIGNED',
            supportOfficerId: draft.officerId,
            supportOfficerName: officerName,
            supportOfficerType: 'CUSTOMER_SUPPORT',
          }),
        });
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        if (!res.ok) throw new Error(data?.error || 'Support assignment update failed.');
      }

      setMessage(`Assigned support officer for ${workspace.name}.`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign support officer.');
    } finally {
      setBusyId(null);
    }
  }

  async function escalateToTechnicalSupport(workspace: Workspace) {
    const draft = draftByWorkspace[workspace.id];
    if (!draft || !draft.technicalOfficerId) {
      setError('Select a technical support officer first.');
      return;
    }

    setBusyId(workspace.id);
    setError('');
    setMessage('');

    try {
      const officer = technicalSupportOfficers.find((user) => user.id === draft.technicalOfficerId) || null;
      const officerName = officer ? officer.name : draft.technicalOfficerId;

      const res = await fetch(`/api/cloud/workspaces/${encodeURIComponent(workspace.id)}/support-assignment`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: workspace.supportAssignment?.status === 'COMPLETED' ? 'IN_PROGRESS' : (workspace.supportAssignment?.status || 'IN_PROGRESS'),
          technicalSupportOfficerId: draft.technicalOfficerId,
          technicalSupportOfficerName: officerName,
          escalationStatus: 'ASSIGNED',
        }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error || 'Technical escalation failed.');

      setMessage(`Escalated ${workspace.name} to technical support.`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to escalate to technical support.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Workspaces</h1>
          <p className="mt-2 text-sm text-slate-600">Operational workspace list (real data) with safe control actions.</p>
          {clientFilter ? (
            <p className="mt-2 text-xs text-slate-500">Filtered by client email: {clientFilter}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            Refresh
          </button>
          <Link href="/master/mvp-deployments" className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900">
            Open deployment queue
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Filter workspaces</label>
        <input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by workspace, client, email, ticket, or officer"
          className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
          <p className="text-sm font-semibold">Workspace operations unavailable</p>
          <p className="mt-1 text-sm">{error}</p>
        </div>
      ) : null}

      {message ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
          <p className="text-sm">{message}</p>
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        {loading ? (
          <div className="p-2 text-sm text-slate-600">Loading workspaces...</div>
        ) : filtered.length === 0 ? (
          <div className="p-2 text-sm text-slate-600">No workspaces found.</div>
        ) : (
          <div className="space-y-3">
            {filtered.map((workspace) => {
              const busy = busyId === workspace.id;
              const email = getContactEmail(workspace);
              const subscription = email ? subscriptionByEmail.get(email) : undefined;
              const supportStatus = workspace.supportAssignment?.status || 'UNASSIGNED';
              const connectorStatus = workspace.connectorStatus || 'NOT_CONNECTED';
              const readinessBlocked = (workspace.status || '').toLowerCase() === 'blocked' || (supportStatus !== 'ASSIGNED' && workspace.supportRequired);

              return (
                <div key={workspace.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{workspace.name}</p>
                      <p className="text-xs text-slate-500">{workspace.id}</p>
                      <p className="mt-1 text-sm text-slate-700">{workspace.clientOrganizationName || '—'}{email ? ` · ${email}` : ''}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className={`rounded-full px-2 py-1 font-semibold ${badge(workspace.onboardingStatus || workspace.status)}`}>{prettyValue(workspace.onboardingStatus || workspace.status)}</span>
                      <span className={`rounded-full px-2 py-1 font-semibold ${badge(connectorStatus)}`}>{prettyValue(connectorStatus)}</span>
                      <span className={`rounded-full px-2 py-1 font-semibold ${readinessBlocked ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{readinessBlocked ? 'Needs review' : 'Ready'}</span>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 text-sm text-slate-700 md:grid-cols-2 xl:grid-cols-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Plan</p>
                      <p>{workspace.planId || subscription?.planId || 'starter'}</p>
                      {subscription ? <p className="text-xs text-slate-500">{subscription.currency} {subscription.amount} · {subscription.billingInterval}</p> : null}
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Support Ticket</p>
                      <p>{workspace.supportAssignment?.ticketId || 'Not created'}</p>
                      <p className="text-xs text-slate-500">{prettyValue(supportStatus)}{workspace.supportAssignment?.escalationStatus ? ` · Escalation ${prettyValue(workspace.supportAssignment.escalationStatus)}` : ''}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Assigned Officers</p>
                      <p>Customer: {workspace.supportAssignment?.supportOfficerName || 'Unassigned'}</p>
                      <p className="text-xs text-slate-500">Technical: {workspace.supportAssignment?.technicalSupportOfficerName || 'Unassigned'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Updated</p>
                      <p>{new Date(workspace.updatedAt).toLocaleString()}</p>
                      <label className="mt-1 inline-flex items-center gap-2 text-xs text-slate-700">
                        <input
                          type="checkbox"
                          checked={Boolean(workspace.supportRequired)}
                          onChange={(e) => void setSupportRequired(workspace.id, e.target.checked)}
                          disabled={busy}
                        />
                        Support required
                      </label>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <select
                      value={draftByWorkspace[workspace.id]?.officerId || ''}
                      onChange={(e) => setDraftByWorkspace((prev) => ({
                        ...prev,
                        [workspace.id]: {
                          officerId: e.target.value,
                          technicalOfficerId: prev[workspace.id]?.technicalOfficerId || '',
                        },
                      }))}
                      className="rounded-xl border border-slate-300 px-2 py-1 text-xs"
                      disabled={busy}
                      title="Assign customer support officer"
                    >
                      <option value="">Customer support…</option>
                      {customerSupportOfficers.map((officer) => (
                        <option key={`${workspace.id}-customer-${officer.id}`} value={officer.id}>
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
                      Assign Customer Support
                    </button>

                    <select
                      value={draftByWorkspace[workspace.id]?.technicalOfficerId || ''}
                      onChange={(e) => setDraftByWorkspace((prev) => ({
                        ...prev,
                        [workspace.id]: {
                          officerId: prev[workspace.id]?.officerId || '',
                          technicalOfficerId: e.target.value,
                        },
                      }))}
                      className="rounded-xl border border-slate-300 px-2 py-1 text-xs"
                      disabled={busy}
                      title="Escalate to technical support"
                    >
                      <option value="">Technical support…</option>
                      {technicalSupportOfficers.map((officer) => (
                        <option key={`${workspace.id}-technical-${officer.id}`} value={officer.id}>
                          {officer.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => void escalateToTechnicalSupport(workspace)}
                      disabled={busy}
                      className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-900 disabled:opacity-60"
                    >
                      Escalate Technical
                    </button>

                    <Link
                      href={`/master/mvp-deployments/${workspace.id}`}
                      className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-800 text-center"
                    >
                      View
                    </Link>
                    <Link
                      href={`/master/mvp-deployments/${workspace.id}`}
                      className="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-900 text-center"
                    >
                      Launch checklist
                    </Link>
                    <button
                      type="button"
                      onClick={() => void copyWorkspaceId(workspace.id)}
                      className="rounded-full bg-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-800"
                    >
                      Copy ID
                    </button>
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
