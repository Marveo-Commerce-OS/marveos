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
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  reason?: string;
  setupType?: 'NEW_WEBSITE' | 'EXISTING_WEBSITE' | 'CUSTOM_HEADLESS';
};

type Workspace = {
  id: string;
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
  normalizedRoles: string[];
  status: 'ACTIVE' | 'INVITED' | 'DISABLED';
};

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

function isSupportOfficer(user: TeamUserRow): boolean {
  const roles = Array.isArray(user.normalizedRoles) ? user.normalizedRoles : [];
  return roles.includes('SUPPORT_OFFICER') || roles.includes('ADMIN') || roles.includes('SUPER_ADMIN');
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

  const [draftByWorkspace, setDraftByWorkspace] = useState<Record<string, { officerId: string }>>({});

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
    if (!clientFilter) return workspaces;
    return workspaces.filter((workspace) => getContactEmail(workspace) === clientFilter);
  }, [workspaces, clientFilter]);

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
      const nextOfficers = Array.isArray(usersData?.users) ? usersData.users.filter(isSupportOfficer).filter((u) => u.status === 'ACTIVE') : [];
      const nextSubscriptions = Array.isArray(billingData?.subscriptions) ? billingData.subscriptions : [];

      setWorkspaces(nextWorkspaces);
      setOfficers(nextOfficers);
      setSubscriptions(nextSubscriptions);

      setDraftByWorkspace((current) => {
        const next = { ...current };
        for (const ws of nextWorkspaces) {
          if (next[ws.id]) continue;
          next[ws.id] = { officerId: ws.supportAssignment?.supportOfficerId || '' };
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

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-slate-600">Loading workspaces...</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-sm text-slate-600">No workspaces found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1400px]">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  {[
                    'Workspace',
                    'Client org',
                    'Plan',
                    'Subscription',
                    'Website type',
                    'Onboarding',
                    'Connector',
                    'Launch readiness',
                    'Support',
                    'Support required',
                    'Updated',
                    'Actions',
                  ].map((header) => (
                    <th key={header} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((workspace) => {
                  const busy = busyId === workspace.id;
                  const email = getContactEmail(workspace);
                  const subscription = email ? subscriptionByEmail.get(email) : undefined;
                  const supportStatus = workspace.supportAssignment?.status || 'UNASSIGNED';
                  const connectorStatus = workspace.connectorStatus || 'NOT_CONNECTED';
                  const readinessBlocked = (workspace.status || '').toLowerCase() === 'blocked' || supportStatus !== 'ASSIGNED' && workspace.supportRequired;

                  return (
                    <tr key={workspace.id} className="border-b border-slate-100 align-top">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">{workspace.name}</p>
                        <p className="text-xs text-slate-500">{workspace.id}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {workspace.clientOrganizationName || '—'}
                        {email ? <p className="mt-1 text-xs text-slate-500">{email}</p> : null}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">{workspace.planId || subscription?.planId || 'starter'}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {subscription ? (
                          <div>
                            <span className={`rounded-full px-2 py-1 text-xs font-semibold ${badge(subscription.status)}`}>{prettyValue(subscription.status)}</span>
                            <p className="mt-1 text-xs text-slate-500">{subscription.currency} {subscription.amount} · {subscription.billingInterval}</p>
                            {subscription.trialEndDate ? <p className="mt-1 text-xs text-slate-500">Trial ends {new Date(subscription.trialEndDate).toLocaleDateString()}</p> : null}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500">Not linked</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">{prettyValue(workspace.websiteType || 'Not set')}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${badge(workspace.onboardingStatus || workspace.status)}`}>
                          {prettyValue(workspace.onboardingStatus || workspace.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {prettyValue(connectorStatus)}
                        {workspace.connectorSiteMetadata?.platform ? (
                          <p className="mt-1 text-xs text-slate-500">{workspace.connectorSiteMetadata.platform}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${readinessBlocked ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {readinessBlocked ? 'Blocked / Needs review' : 'Clear'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">{prettyValue(supportStatus)}</td>
                      <td className="px-4 py-3">
                        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={Boolean(workspace.supportRequired)}
                            onChange={(e) => void setSupportRequired(workspace.id, e.target.checked)}
                            disabled={busy}
                          />
                          <span className="text-xs">{workspace.supportRequired ? 'Yes' : 'No'}</span>
                        </label>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">{new Date(workspace.updatedAt).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              value={draftByWorkspace[workspace.id]?.officerId || ''}
                              onChange={(e) => setDraftByWorkspace((prev) => ({
                                ...prev,
                                [workspace.id]: { officerId: e.target.value },
                              }))}
                              className="rounded-xl border border-slate-300 px-2 py-1 text-xs"
                              disabled={busy}
                              title="Assign support officer"
                            >
                              <option value="">Select officer…</option>
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

                          <div className="flex flex-wrap gap-2">
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
                            <button
                              type="button"
                              disabled
                              className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500"
                              title="Archiving is disabled until pilot-safe retention rules are finalized."
                            >
                              Archive (coming soon)
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
