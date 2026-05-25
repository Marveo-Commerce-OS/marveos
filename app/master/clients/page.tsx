'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type Workspace = {
  id: string;
  name: string;
  clientOrganizationId?: string;
  clientOrganizationName?: string;
  clientSubscriptionId?: string;
  country: string;
  supportRequired?: boolean;
  supportAssignment?: { status: string };
  businessProfile?: Record<string, unknown>;
  status: string;
  onboardingStatus?: string;
  updatedAt: string;
};

type SubscriptionRow = {
  id: string;
  ownerEmail: string;
  organizationId: string;
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

type TeamUserRow = {
  id: string;
  name: string;
  email: string;
  normalizedRoles: string[];
  status: 'ACTIVE' | 'INVITED' | 'DISABLED';
};

type ClientRow = {
  key: string;
  organization: string;
  ownerEmail: string;
  country: string;
  currency: string;
  subscriptionStatus: string;
  trialEndDate: string | null;
  planId: string | null;
  workspaceCount: number;
  supportOpenCount: number;
  latestUpdatedAt: string;
  subscriptionId: string | null;
};

function toLabel(raw: string): string {
  return raw
    .replace(/[._-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getContactEmail(workspace: Workspace): string {
  const profile = workspace.businessProfile || {};
  return String(profile.contactEmail || '').trim().toLowerCase();
}

function getBusinessName(workspace: Workspace): string {
  const profile = workspace.businessProfile || {};
  return String(profile.businessName || workspace.name || '').trim();
}

function isSupportOfficer(user: TeamUserRow): boolean {
  const roles = Array.isArray(user.normalizedRoles) ? user.normalizedRoles : [];
  return roles.includes('SUPPORT_OFFICER') || roles.includes('ADMIN') || roles.includes('SUPER_ADMIN');
}

export default function MasterClientsPage() {
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [officers, setOfficers] = useState<TeamUserRow[]>([]);

  const [officerByClient, setOfficerByClient] = useState<Record<string, string>>({});

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

  const subscriptionById = useMemo(() => {
    const map = new Map<string, SubscriptionRow>();
    for (const subscription of subscriptions) {
      if (!subscription.id) continue;
      map.set(subscription.id, subscription);
    }
    return map;
  }, [subscriptions]);

  const clients = useMemo(() => {
    const rows = new Map<string, ClientRow>();

    for (const workspace of workspaces) {
      const email = getContactEmail(workspace);
      const subscription = (workspace.clientSubscriptionId ? subscriptionById.get(workspace.clientSubscriptionId) : undefined)
        || (email ? subscriptionByEmail.get(email) : undefined);
      const ownerEmail = email || subscription?.ownerEmail || '';
      const fallbackKey = ownerEmail || workspace.clientOrganizationId || subscription?.organizationId || workspace.id;
      const key = workspace.clientOrganizationId || subscription?.organizationId || fallbackKey;
      const existing = rows.get(key);

      const organization = workspace.clientOrganizationName
        || subscription?.organizationName
        || getBusinessName(workspace)
        || ownerEmail
        || key;
      const planId = subscription?.planId || null;

      const supportOpen = Boolean(workspace.supportRequired) && (workspace.supportAssignment?.status || 'UNASSIGNED') !== 'ASSIGNED';

      if (!existing) {
        rows.set(key, {
          key,
          organization,
          ownerEmail,
          country: subscription?.country || workspace.country || '—',
          currency: subscription?.currency || '—',
          subscriptionStatus: subscription?.status || 'UNLINKED',
          trialEndDate: subscription?.trialEndDate || null,
          planId,
          workspaceCount: 1,
          supportOpenCount: supportOpen ? 1 : 0,
          latestUpdatedAt: workspace.updatedAt,
          subscriptionId: subscription?.id || null,
        });
        continue;
      }

      existing.workspaceCount += 1;
      if (supportOpen) existing.supportOpenCount += 1;
      if (workspace.updatedAt > existing.latestUpdatedAt) existing.latestUpdatedAt = workspace.updatedAt;
    }

    return Array.from(rows.values()).sort((a, b) => b.latestUpdatedAt.localeCompare(a.latestUpdatedAt));
  }, [workspaces, subscriptionByEmail, subscriptionById]);

  async function load() {
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const [workspaceRes, billingRes, usersRes] = await Promise.all([
        fetch('/api/cloud/workspaces', { cache: 'no-store' }),
        fetch('/api/master/billing/subscriptions', { cache: 'no-store' }),
        fetch('/api/master/users', { cache: 'no-store' }),
      ]);

      const workspaceData = (await workspaceRes.json().catch(() => null)) as { workspaces?: Workspace[]; error?: string } | null;
      if (!workspaceRes.ok) throw new Error(workspaceData?.error || 'Failed to load workspaces');

      const billingData = (await billingRes.json().catch(() => null)) as { subscriptions?: SubscriptionRow[]; error?: string } | null;
      if (!billingRes.ok) throw new Error(billingData?.error || 'Failed to load subscriptions');

      const usersData = (await usersRes.json().catch(() => null)) as { users?: TeamUserRow[]; error?: string } | null;
      if (!usersRes.ok) throw new Error(usersData?.error || 'Failed to load team directory');

      setWorkspaces(Array.isArray(workspaceData?.workspaces) ? workspaceData.workspaces : []);
      setSubscriptions(Array.isArray(billingData?.subscriptions) ? billingData.subscriptions : []);
      setOfficers(Array.isArray(usersData?.users) ? usersData.users.filter(isSupportOfficer).filter((u) => u.status === 'ACTIVE') : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load clients');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function assignSupportForClient(clientKey: string, clientEmail: string) {
    const officerId = officerByClient[clientKey] || '';
    const officer = officers.find((user) => user.id === officerId) || null;
    if (!officerId || !officer) {
      setError('Select a support officer first.');
      return;
    }

    setBusyKey(clientKey);
    setError('');
    setMessage('');

    try {
      const res = await fetch('/api/master/clients/assign-support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientEmail,
          supportOfficerId: officerId,
          supportOfficerName: officer.name,
        }),
      });

      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; updated?: number } | null;
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Failed to assign support');

      setMessage(`Assigned support officer for ${data.updated || 0} workspace(s).`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign support');
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Clients</h1>
          <p className="mt-2 text-sm text-slate-600">Client organizations inferred from persisted onboarding + workspace data.</p>
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
          <p className="text-sm font-semibold">Client operations unavailable</p>
          <p className="mt-1 text-sm">{error}</p>
        </div>
      ) : null}

      {message ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
          <p className="text-sm">{message}</p>
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-600">Total client accounts</p>
        <p className="text-2xl font-bold text-slate-900">{clients.length}</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-slate-600">Loading clients...</div>
        ) : clients.length === 0 ? (
          <div className="p-6 text-sm text-slate-600">No clients discovered yet. Create a workspace to register the first client account.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px]">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  {['Organization', 'Owner/contact', 'Country/currency', 'Plan', 'Subscription status', 'Trial end', 'Workspaces', 'Open support items', 'Actions'].map((header) => (
                    <th key={header} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => {
                  const busy = busyKey === client.key;
                  const hasOpenSupport = client.supportOpenCount > 0;
                  const canAssignSupport = hasOpenSupport && Boolean(client.ownerEmail);

                  return (
                    <tr key={client.key} className="border-b border-slate-100 align-top">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">{client.organization}</p>
                        <p className="text-xs text-slate-500">{client.ownerEmail || client.key}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">{client.ownerEmail || '—'}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{client.country} / {client.currency}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{client.planId || '—'}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{toLabel(client.subscriptionStatus)}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{client.trialEndDate ? new Date(client.trialEndDate).toLocaleDateString() : '—'}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{client.workspaceCount}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${hasOpenSupport ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {hasOpenSupport ? `${client.supportOpenCount} open` : 'None'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-2">
                          <div className="flex flex-wrap gap-2">
                            <Link href={`/master/workspaces?client=${encodeURIComponent(client.key)}`} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-800 text-center">
                              View workspaces
                            </Link>
                            {client.subscriptionId ? (
                              <Link href={`/master/billing?subscription=${encodeURIComponent(client.subscriptionId)}`} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-800 text-center">
                                View subscription
                              </Link>
                            ) : (
                              <span className="rounded-full bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-500" title="No linked subscription found.">
                                Subscription: n/a
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              value={officerByClient[client.key] || ''}
                              onChange={(e) => setOfficerByClient((prev) => ({ ...prev, [client.key]: e.target.value }))}
                              className="rounded-xl border border-slate-300 px-2 py-1 text-xs"
                              disabled={busy || !canAssignSupport}
                              title={!hasOpenSupport ? 'No open support items for this client.' : !client.ownerEmail ? 'Contact email missing for this client.' : 'Select support officer to assign'}
                            >
                              <option value="">Assign officer…</option>
                              {officers.map((officer) => (
                                <option key={`${client.key}-${officer.id}`} value={officer.id}>
                                  {officer.name}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => void assignSupportForClient(client.key, client.ownerEmail)}
                              disabled={busy || !canAssignSupport}
                              className="rounded-full bg-indigo-100 px-3 py-1.5 text-xs font-semibold text-indigo-900 disabled:opacity-60"
                              title={!hasOpenSupport ? 'No open support items to assign.' : !client.ownerEmail ? 'Contact email missing for this client.' : 'Assign officer to unassigned support-required workspaces'}
                            >
                              Assign support
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
