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

export default function MasterConnectorsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyWorkspace, setBusyWorkspace] = useState('');
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);

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

  const connectorRows = useMemo(() => workspaces, [workspaces]);

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
          <p className="mt-2 text-sm text-slate-600">Operational connector state, token management, and verification across WordPress and Next.js workspaces.</p>
        </div>
        <button
          onClick={() => loadWorkspaces()}
          disabled={loading}
          className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          Refresh connectors
        </button>
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

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Connector operations</h2>
        </div>

        {loading ? (
          <div className="p-6 text-sm text-slate-600">Loading connector workspaces...</div>
        ) : connectorRows.length === 0 ? (
          <div className="p-6 text-sm text-slate-600">
            No workspaces found. Create a workspace to enable connector operations.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1320px]">
              <thead className="border-b border-slate-200 bg-white">
                <tr>
                  {['Workspace', 'Source', 'Status', 'Token', 'Site URL', 'Detected platform', 'WooCommerce', 'Last verification', 'Error', 'Actions'].map((header) => (
                    <th key={header} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {connectorRows.map((workspace) => (
                  <tr key={workspace.id} className="border-b border-slate-100 align-top">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{workspace.name}</p>
                      <p className="text-xs text-slate-500">{workspace.id}</p>
                      <Link href={`/master/mvp-deployments/${workspace.id}`} className="mt-2 inline-block text-xs font-semibold text-slate-700 underline">
                        View workspace
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold uppercase text-slate-700">
                        {workspace.contentSource || 'unknown'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${badge(workspace.connectorStatus)}`}>
                        {workspace.connectorStatus || 'NOT_CONNECTED'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{shortToken(workspace.connectorToken)}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{workspace.connectorSiteMetadata?.siteUrl || workspace.contentBaseUrl || '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{workspace.connectorSiteMetadata?.platform || 'Unknown'}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {typeof workspace.connectorSiteMetadata?.woocommerceEnabled === 'boolean'
                        ? (workspace.connectorSiteMetadata.woocommerceEnabled ? 'Enabled' : 'Not detected')
                        : 'Unknown'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {workspace.connectorLastVerificationAttempt
                        ? new Date(workspace.connectorLastVerificationAttempt).toLocaleString()
                        : 'Never'}
                    </td>
                    <td className="px-4 py-3 text-xs text-red-700 max-w-[260px]">
                      {workspace.connectorVerificationError || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-2">
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
                          Verify connector
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
                          Mark support required
                        </button>
                        <button
                          onClick={() => refreshConnectorState(workspace.id)}
                          disabled={busyWorkspace === workspace.id}
                          className="rounded-full bg-indigo-100 px-3 py-1.5 text-xs font-semibold text-indigo-800 hover:bg-indigo-200 disabled:opacity-60"
                        >
                          Refresh state
                        </button>
                      </div>
                    </td>
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
