'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type Workspace = {
  id: string;
  name: string;
  contentBaseUrl: string;
  contentSource: 'wordpress' | 'nextjs';
  websiteType?: 'NEW_WEBSITE' | 'EXISTING_WEBSITE' | 'CUSTOM_HEADLESS';
  connectorStatus?: 'NOT_CONNECTED' | 'TOKEN_GENERATED' | 'PENDING_VERIFICATION' | 'CONNECTED' | 'FAILED' | 'SUPPORT_REQUIRED';
  connectorToken?: string;
  connectorLastVerificationAttempt?: string;
  connectorConnectedAt?: string;
  connectorVerificationError?: string;
  connectorSiteMetadata?: {
    platform?: string;
    siteUrl?: string;
    woocommerceEnabled?: boolean;
    discoveredAt?: string;
  };
  updatedAt: string;
};

type ConnectorStateResponse = {
  workspaceId: string;
  connectorStatus: Workspace['connectorStatus'];
  connectorToken: string | null;
  connectorConnectedAt: string | null;
  connectorLastVerificationAttempt: string | null;
  connectorVerificationError: string | null;
  connectorSiteMetadata: Workspace['connectorSiteMetadata'] | null;
};

function badge(status?: string) {
  const normalized = String(status || 'NOT_CONNECTED').toUpperCase();
  if (normalized === 'CONNECTED') return 'bg-emerald-100 text-emerald-700';
  if (normalized === 'FAILED' || normalized === 'SUPPORT_REQUIRED') return 'bg-red-100 text-red-700';
  if (normalized === 'PENDING_VERIFICATION') return 'bg-amber-100 text-amber-700';
  if (normalized === 'TOKEN_GENERATED') return 'bg-indigo-100 text-indigo-700';
  return 'bg-slate-100 text-slate-700';
}

function shortToken(value?: string | null) {
  if (!value) return 'Not generated';
  if (value.length < 12) return value;
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

const PAGE_SIZE = 12;

export default function MasterConnectorsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyWorkspace, setBusyWorkspace] = useState('');
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | NonNullable<Workspace['connectorStatus']>>('ALL');
  const [sourceFilter, setSourceFilter] = useState<'ALL' | Workspace['contentSource']>('ALL');
  const [page, setPage] = useState(1);

  useEffect(() => {
    void loadWorkspaces();
  }, []);

  async function loadWorkspaces() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/cloud/workspaces', { cache: 'no-store' });
      const data = (await res.json().catch(() => null)) as { workspaces?: Workspace[]; error?: string } | null;
      if (!res.ok || !data?.workspaces) {
        throw new Error(data?.error || 'Failed to load connector workspaces.');
      }
      const sorted = [...data.workspaces].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      setWorkspaces(sorted);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load connector workspaces.');
    } finally {
      setLoading(false);
    }
  }

  async function refreshConnectorState(workspaceId: string) {
    setBusyWorkspace(workspaceId);
    setError('');
    try {
      const res = await fetch(`/api/cloud/workspaces/${workspaceId}/connector`, { cache: 'no-store' });
      const data = (await res.json().catch(() => null)) as ConnectorStateResponse & { error?: string };
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to refresh connector state.');
      }

      setWorkspaces((prev) => prev.map((workspace) => (
        workspace.id === workspaceId
          ? {
              ...workspace,
              connectorStatus: data.connectorStatus || 'NOT_CONNECTED',
              connectorToken: data.connectorToken || undefined,
              connectorConnectedAt: data.connectorConnectedAt || undefined,
              connectorLastVerificationAttempt: data.connectorLastVerificationAttempt || undefined,
              connectorVerificationError: data.connectorVerificationError || undefined,
              connectorSiteMetadata: data.connectorSiteMetadata || undefined,
            }
          : workspace
      )));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh connector state.');
    } finally {
      setBusyWorkspace('');
    }
  }

  async function generateToken(workspaceId: string) {
    setBusyWorkspace(workspaceId);
    setError('');
    try {
      const res = await fetch(`/api/cloud/workspaces/${workspaceId}/connector`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_token' }),
      });
      const data = (await res.json().catch(() => null)) as { connectorToken?: string; connectorStatus?: Workspace['connectorStatus']; error?: string } | null;
      if (!res.ok || !data) {
        throw new Error(data?.error || 'Failed to generate connector token.');
      }

      setWorkspaces((prev) => prev.map((workspace) => (
        workspace.id === workspaceId
          ? {
              ...workspace,
              connectorToken: data.connectorToken,
              connectorStatus: data.connectorStatus || 'TOKEN_GENERATED',
            }
          : workspace
      )));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate connector token.');
    } finally {
      setBusyWorkspace('');
    }
  }

  async function verifyConnector(workspace: Workspace) {
    setBusyWorkspace(workspace.id);
    setError('');
    try {
      const res = await fetch(`/api/cloud/workspaces/${workspace.id}/connector/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: workspace.contentBaseUrl,
          connectorToken: workspace.connectorToken,
        }),
      });

      const data = (await res.json().catch(() => null)) as {
        connectorStatus?: Workspace['connectorStatus'];
        error?: string;
        siteMetadata?: Workspace['connectorSiteMetadata'];
        attemptedAt?: string;
        connectedAt?: string;
      } | null;

      if (!res.ok || !data) {
        throw new Error(data?.error || 'Connector verification failed.');
      }

      setWorkspaces((prev) => prev.map((row) => (
        row.id === workspace.id
          ? {
              ...row,
              connectorStatus: data.connectorStatus || row.connectorStatus,
              connectorLastVerificationAttempt: data.attemptedAt || row.connectorLastVerificationAttempt,
              connectorConnectedAt: data.connectedAt || row.connectorConnectedAt,
              connectorSiteMetadata: data.siteMetadata || row.connectorSiteMetadata,
              connectorVerificationError: data.error || undefined,
            }
          : row
      )));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connector verification failed.');
    } finally {
      setBusyWorkspace('');
    }
  }

  async function updateConnectorStatus(
    workspaceId: string,
    connectorStatus: 'CONNECTED' | 'SUPPORT_REQUIRED',
  ) {
    setBusyWorkspace(workspaceId);
    setError('');
    try {
      const res = await fetch(`/api/cloud/workspaces/${workspaceId}/connector`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_status',
          connectorStatus,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        connectorStatus?: Workspace['connectorStatus'];
        error?: string;
      } | null;

      if (!res.ok || !data) {
        throw new Error(data?.error || 'Failed to update connector status.');
      }

      setWorkspaces((prev) => prev.map((workspace) => (
        workspace.id === workspaceId
          ? {
              ...workspace,
              connectorStatus: data.connectorStatus || connectorStatus,
              connectorVerificationError: connectorStatus === 'SUPPORT_REQUIRED'
                ? 'Support follow-up required for this connector.'
                : undefined,
            }
          : workspace
      )));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update connector status.');
    } finally {
      setBusyWorkspace('');
    }
  }

  const connectorRows = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return workspaces.filter((workspace) => {
      if (statusFilter !== 'ALL' && (workspace.connectorStatus || 'NOT_CONNECTED') !== statusFilter) return false;
      if (sourceFilter !== 'ALL' && workspace.contentSource !== sourceFilter) return false;
      if (!needle) return true;

      const blob = [
        workspace.name,
        workspace.id,
        workspace.contentBaseUrl,
        workspace.connectorSiteMetadata?.siteUrl,
        workspace.connectorSiteMetadata?.platform,
      ]
        .map((item) => String(item || '').toLowerCase())
        .join(' ');

      return blob.includes(needle);
    });
  }, [workspaces, search, statusFilter, sourceFilter]);

  const totalPages = Math.max(1, Math.ceil(connectorRows.length / PAGE_SIZE));

  const pagedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return connectorRows.slice(start, start + PAGE_SIZE);
  }, [connectorRows, page]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, sourceFilter]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const counts = useMemo(() => {
    return {
      connected: connectorRows.filter((workspace) => workspace.connectorStatus === 'CONNECTED').length,
      pending: connectorRows.filter((workspace) => workspace.connectorStatus === 'PENDING_VERIFICATION' || workspace.connectorStatus === 'TOKEN_GENERATED').length,
      failed: connectorRows.filter((workspace) => workspace.connectorStatus === 'FAILED' || workspace.connectorStatus === 'SUPPORT_REQUIRED').length,
      notConnected: connectorRows.filter((workspace) => !workspace.connectorStatus || workspace.connectorStatus === 'NOT_CONNECTED').length,
      wordpress: connectorRows.filter((workspace) => workspace.contentSource === 'wordpress').length,
      nextjs: connectorRows.filter((workspace) => workspace.contentSource === 'nextjs').length,
      woocommerce: connectorRows.filter((workspace) => workspace.connectorSiteMetadata?.woocommerceEnabled === true).length,
    };
  }, [connectorRows]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Connectors</h1>
          <p className="mt-2 text-sm text-slate-600">Operational connector state, token management, and verification across all workspaces.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadWorkspaces()}
            disabled={loading}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            Refresh connectors
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
          <p className="text-xs font-semibold uppercase tracking-wide">Connected</p>
          <p className="mt-2 text-2xl font-bold">{counts.connected}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <p className="text-xs font-semibold uppercase tracking-wide">Pending verification</p>
          <p className="mt-2 text-2xl font-bold">{counts.pending}</p>
        </div>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-900">
          <p className="text-xs font-semibold uppercase tracking-wide">Failed or support required</p>
          <p className="mt-2 text-2xl font-bold">{counts.failed}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Not connected</p>
          <p className="mt-2 text-2xl font-bold">{counts.notConnected}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">WordPress workspaces</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{counts.wordpress}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Next.js workspaces</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{counts.nextjs}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">Operational note</p>
          <p className="mt-2">WordPress supports live verification from this screen. Next.js connectors use token/state operations with manual status controls.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">WooCommerce detected (WordPress)</p>
        <p className="mt-2 text-2xl font-bold text-slate-900">{counts.woocommerce}</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="grid gap-3 md:grid-cols-4">
          <label className="text-sm text-slate-700 md:col-span-2">
            Search workspace
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name, workspace ID, URL, platform"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="text-sm text-slate-700">
            Status
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as 'ALL' | NonNullable<Workspace['connectorStatus']>)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
            >
              <option value="ALL">All statuses</option>
              <option value="NOT_CONNECTED">Not connected</option>
              <option value="TOKEN_GENERATED">Token generated</option>
              <option value="PENDING_VERIFICATION">Pending verification</option>
              <option value="CONNECTED">Connected</option>
              <option value="FAILED">Failed</option>
              <option value="SUPPORT_REQUIRED">Support required</option>
            </select>
          </label>

          <label className="text-sm text-slate-700">
            Source
            <select
              value={sourceFilter}
              onChange={(event) => setSourceFilter(event.target.value as 'ALL' | Workspace['contentSource'])}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
            >
              <option value="ALL">All sources</option>
              <option value="wordpress">WordPress</option>
              <option value="nextjs">Next.js</option>
            </select>
          </label>
        </div>

        <div className="mt-3 text-xs text-slate-500">
          Showing {connectorRows.length} workspace{connectorRows.length === 1 ? '' : 's'}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Connector operations</h2>
        </div>

        {loading ? (
          <div className="p-6 text-sm text-slate-600">Loading connector workspaces...</div>
        ) : connectorRows.length === 0 ? (
          <div className="p-6 text-sm text-slate-600">
            No matching workspaces. Adjust filters or create more workspaces.
          </div>
        ) : (
          <div className="space-y-4 p-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {pagedRows.map((workspace) => (
                <article key={workspace.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-slate-900">{workspace.name}</p>
                      <p className="text-xs text-slate-500">{workspace.id}</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${badge(workspace.connectorStatus)}`}>
                      {workspace.connectorStatus || 'NOT_CONNECTED'}
                    </span>
                  </div>

                  <div className="mt-3 grid gap-2 text-xs text-slate-600">
                    <p><span className="font-semibold text-slate-700">Source:</span> {workspace.contentSource}</p>
                    <p><span className="font-semibold text-slate-700">Token:</span> {shortToken(workspace.connectorToken)}</p>
                    <p className="break-all"><span className="font-semibold text-slate-700">Site:</span> {workspace.connectorSiteMetadata?.siteUrl || workspace.contentBaseUrl || '—'}</p>
                    <p><span className="font-semibold text-slate-700">Platform:</span> {workspace.connectorSiteMetadata?.platform || 'Unknown'}</p>
                    <p><span className="font-semibold text-slate-700">WooCommerce:</span> {typeof workspace.connectorSiteMetadata?.woocommerceEnabled === 'boolean' ? (workspace.connectorSiteMetadata.woocommerceEnabled ? 'Enabled' : 'Not detected') : 'Unknown'}</p>
                    <p><span className="font-semibold text-slate-700">Last verification:</span> {workspace.connectorLastVerificationAttempt ? new Date(workspace.connectorLastVerificationAttempt).toLocaleString() : 'Never'}</p>
                    {workspace.connectorVerificationError ? (
                      <p className="rounded-xl border border-red-200 bg-red-50 px-2 py-1 text-red-700">
                        {workspace.connectorVerificationError}
                      </p>
                    ) : null}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={() => generateToken(workspace.id)}
                      disabled={busyWorkspace === workspace.id}
                      className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-200 disabled:opacity-60"
                    >
                      Generate token
                    </button>
                    <button
                      onClick={() => verifyConnector(workspace)}
                      disabled={busyWorkspace === workspace.id || workspace.contentSource !== 'wordpress'}
                      className="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-200 disabled:opacity-60"
                    >
                      Verify
                    </button>
                    {workspace.contentSource !== 'wordpress' ? (
                      <button
                        onClick={() => updateConnectorStatus(workspace.id, 'CONNECTED')}
                        disabled={busyWorkspace === workspace.id}
                        className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                      >
                        Mark connected
                      </button>
                    ) : null}
                    <button
                      onClick={() => updateConnectorStatus(workspace.id, 'SUPPORT_REQUIRED')}
                      disabled={busyWorkspace === workspace.id}
                      className="rounded-full bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-200 disabled:opacity-60"
                    >
                      Support required
                    </button>
                    <button
                      onClick={() => refreshConnectorState(workspace.id)}
                      disabled={busyWorkspace === workspace.id}
                      className="rounded-full bg-indigo-100 px-3 py-1.5 text-xs font-semibold text-indigo-800 hover:bg-indigo-200 disabled:opacity-60"
                    >
                      Refresh
                    </button>
                    <Link
                      href={`/master/mvp-deployments/${workspace.id}`}
                      className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
                    >
                      Open workspace
                    </Link>
                  </div>
                </article>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3">
              <p className="text-xs text-slate-500">Page {page} of {totalPages}</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page <= 1}
                  className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-60"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={page >= totalPages}
                  className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-60"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
