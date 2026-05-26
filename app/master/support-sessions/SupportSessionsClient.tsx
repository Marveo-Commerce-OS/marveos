'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import SupportCenterTabs from '@/components/SupportCenterTabs';

type SupportSessionRow = {
  id: string;
  workspaceId: string;
  workspaceName: string;
  supportUserId: string;
  clientUserId?: string;
  clientEmail: string;
  reason: string;
  issuedAt: string;
  expiresAt: string;
  revokedAt?: string;
};

type SessionsResponse = {
  ok?: boolean;
  sessions?: SupportSessionRow[];
  error?: string;
};

function formatDate(iso: string | undefined): string {
  if (!iso) return '-';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}

function resolveStatus(session: SupportSessionRow): 'revoked' | 'expired' | 'active' {
  if (session.revokedAt) return 'revoked';
  if (new Date(session.expiresAt).getTime() <= Date.now()) return 'expired';
  return 'active';
}

export default function SupportSessionsClient() {
  const [sessions, setSessions] = useState<SupportSessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busySessionId, setBusySessionId] = useState<string | null>(null);
  const [includeRevoked, setIncludeRevoked] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const activeCount = useMemo(
    () => sessions.filter((session) => resolveStatus(session) === 'active').length,
    [sessions],
  );

  const revokedCount = useMemo(
    () => sessions.filter((session) => resolveStatus(session) === 'revoked').length,
    [sessions],
  );

  const loadSessions = useCallback(async (showSpinner: boolean) => {
    if (showSpinner) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    setError('');

    try {
      const query = new URLSearchParams({ includeRevoked: String(includeRevoked) });
      const res = await fetch(`/api/master/support/sessions?${query.toString()}`, { cache: 'no-store' });
      const payload = (await res.json().catch(() => null)) as SessionsResponse | null;
      if (!res.ok || !payload?.ok) {
        throw new Error(payload?.error || 'Failed to load support sessions.');
      }
      setSessions(Array.isArray(payload.sessions) ? payload.sessions : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load support sessions.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [includeRevoked]);

  useEffect(() => {
    void loadSessions(true);
  }, [loadSessions]);

  async function revokeSession(session: SupportSessionRow) {
    setBusySessionId(session.id);
    setError('');
    setMessage('');

    try {
      const res = await fetch('/api/master/support/revoke-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id }),
      });
      const payload = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !payload?.ok) {
        throw new Error(payload?.error || 'Failed to revoke support session.');
      }
      setMessage(`Session ${session.id} revoked.`);
      await loadSessions(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke support session.');
    } finally {
      setBusySessionId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Master Support Center</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Support Sessions</h1>
        <p className="mt-2 text-sm text-slate-600">Track issued support-access sessions and revoke when needed.</p>
      </div>

      <SupportCenterTabs active="sessions" />

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Sessions</h2>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{sessions.length}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Active</h2>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{activeCount}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Revoked</h2>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{revokedCount}</p>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={includeRevoked}
              onChange={(event) => setIncludeRevoked(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
            />
            Include revoked sessions
          </label>

          <button
            type="button"
            onClick={() => void loadSessions(false)}
            disabled={loading || refreshing}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {error ? <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
        {message ? <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p> : null}

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-3 py-2">Workspace</th>
                <th className="px-3 py-2">Client</th>
                <th className="px-3 py-2">Support User</th>
                <th className="px-3 py-2">Issued</th>
                <th className="px-3 py-2">Expires</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-slate-500">Loading sessions…</td>
                </tr>
              ) : sessions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-slate-500">No support sessions found.</td>
                </tr>
              ) : (
                sessions.map((session) => {
                  const status = resolveStatus(session);
                  const canRevoke = status === 'active';
                  return (
                    <tr key={session.id} className="align-top">
                      <td className="px-3 py-3">
                        <div className="font-medium text-slate-900">{session.workspaceName}</div>
                        <div className="text-xs text-slate-500">{session.workspaceId}</div>
                        <Link
                          href={`/master/support?workspaceId=${encodeURIComponent(session.workspaceId)}`}
                          className="mt-1 inline-block text-xs font-semibold text-slate-700 underline"
                        >
                          Open queue
                        </Link>
                      </td>
                      <td className="px-3 py-3">
                        <div className="text-slate-800">{session.clientEmail}</div>
                        <div className="text-xs text-slate-500">{session.clientUserId || 'n/a'}</div>
                      </td>
                      <td className="px-3 py-3 text-slate-800">{session.supportUserId}</td>
                      <td className="px-3 py-3 text-slate-700">{formatDate(session.issuedAt)}</td>
                      <td className="px-3 py-3 text-slate-700">{formatDate(session.expiresAt)}</td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                          status === 'active'
                            ? 'bg-emerald-100 text-emerald-700'
                            : status === 'expired'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-200 text-slate-700'
                        }`}>
                          {status}
                        </span>
                        {session.revokedAt ? <div className="mt-1 text-xs text-slate-500">Revoked: {formatDate(session.revokedAt)}</div> : null}
                      </td>
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => void revokeSession(session)}
                          disabled={!canRevoke || busySessionId === session.id}
                          className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-60"
                        >
                          {busySessionId === session.id ? 'Revoking...' : 'Revoke'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
