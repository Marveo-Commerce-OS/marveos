'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import AuditLogActions from './AuditLogActions';

type AuditRecord = {
  id: string;
  at: string;
  actorEmail: string;
  action: string;
  target: string;
  details?: string;
};

type ApiResponse = {
  logs: AuditRecord[];
  totalCount: number;
  page: number;
  totalPages: number;
  pageSize: number;
  availableYears: string[];
  retention: {
    lastPurgeAt: string | null;
    lastReminderAt: string | null;
    lastBackupAt: string | null;
  };
  canPurge: boolean;
  error?: string;
};

function toLabel(raw: string): string {
  return raw
    .replace(/[._-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function prettyAction(value: string): string {
  const segments = value.trim().split('.').filter(Boolean);
  if (segments.length <= 1) return toLabel(value);
  return segments.slice(1).map(toLabel).join(' › ');
}

function prettyDetails(value: string | undefined): string {
  if (!value) return '—';
  return value
    .split(';')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const [k, v] = p.split('=');
      return v !== undefined ? `${toLabel(k)}: ${v}` : toLabel(p);
    })
    .join(' · ');
}

function retentionDate(iso: string | null): string {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function buildQuery(params: {
  page: number;
  origin: string;
  from: string;
  to: string;
  year: string;
  search: string;
}) {
  const sp = new URLSearchParams();
  sp.set('page', String(params.page));
  if (params.origin !== 'all') sp.set('origin', params.origin);
  if (params.from) sp.set('from', params.from);
  if (params.to) sp.set('to', params.to);
  if (params.year) sp.set('year', params.year);
  if (params.search) sp.set('search', params.search);
  return `/api/master/audit-logs?${sp.toString()}`;
}

export default function AuditLogsClient() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState('');

  // ── Filters ────────────────────────────────────────────────────────────────
  const [origin, setOrigin] = useState<'all' | 'client' | 'internal'>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [year, setYear] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(async (params: {
    page: number;
    origin: string;
    from: string;
    to: string;
    year: string;
    search: string;
  }) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(buildQuery(params), { cache: 'no-store' });
      const body = (await res.json().catch(() => null)) as ApiResponse | null;
      if (!res.ok || !body) throw new Error(body?.error || 'Failed to load audit logs.');
      setData(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit logs.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load({ page, origin, from, to, year, search });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyFilters() {
    setPage(1);
    void load({ page: 1, origin, from, to, year, search });
  }

  function clearFilters() {
    setOrigin('all');
    setFrom('');
    setTo('');
    setYear('');
    setSearch('');
    setPage(1);
    void load({ page: 1, origin: 'all', from: '', to: '', year: '', search: '' });
  }

  function goToPage(next: number) {
    setPage(next);
    void load({ page: next, origin, from, to, year, search });
  }

  const years = useMemo(() => data?.availableYears ?? [], [data]);

  return (
    <div className="space-y-6">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Audit Logs</h1>
        <p className="mt-2 text-sm text-slate-600">
          Sensitive action history and operational audit stream.
        </p>
      </div>

      {/* ── Retention status card ─────────────────────────────────────────── */}
      {data ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: 'Last backup', value: retentionDate(data.retention.lastBackupAt) },
            { label: 'Last purge', value: retentionDate(data.retention.lastPurgeAt) },
            { label: 'Last 30-day reminder', value: retentionDate(data.retention.lastReminderAt) },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{item.value}</p>
            </div>
          ))}
        </div>
      ) : null}

      {/* ── Total count ──────────────────────────────────────────────────── */}
      {data ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-600">Total log entries</p>
          <p className="text-2xl font-bold text-slate-900">{data.totalCount}</p>
          <p className="mt-1 text-xs text-slate-500">
            Showing {data.pageSize} per page · Page {data.page} of {data.totalPages}
          </p>
        </div>
      ) : null}

      {/* ── Backup / purge controls ────────────────────────────────────────── */}
      {data ? (
        <AuditLogActions
          canPurge={data.canPurge}
          logCount={data.totalCount}
          onPurgeComplete={() => void load({ page: 1, origin, from, to, year, search })}
        />
      ) : null}

      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4">
        <h2 className="text-base font-semibold text-slate-900">Filter logs</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Origin */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Origin</label>
            <select
              value={origin}
              onChange={(e) => {
                const next = e.target.value as typeof origin;
                setOrigin(next);
                setPage(1);
                void load({ page: 1, origin: next, from, to, year, search });
              }}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="all">All</option>
              <option value="client">Client activity</option>
              <option value="internal">Internal (us)</option>
            </select>
          </div>

          {/* Year */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Year</label>
            <select
              value={year}
              onChange={(e) => {
                const next = e.target.value;
                setYear(next);
                setPage(1);
                void load({ page: 1, origin, from, to, year: next, search });
              }}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">All years</option>
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* From */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">From</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          {/* To */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">To</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        {/* Search */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Search</label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Client ID, name, email, action, target…"
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            onKeyDown={(e) => { if (e.key === 'Enter') applyFilters(); }}
          />
          <p className="mt-1 text-[11px] text-slate-400">Searches actor email, action, target, details — and looks up client ID, name or registered email.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={applyFilters}
            disabled={loading}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            Apply filters
          </button>
          <button
            type="button"
            onClick={clearFilters}
            disabled={loading}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Clear
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : null}

      {/* ── Log table ────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-slate-600">Loading logs…</div>
        ) : !data || data.logs.length === 0 ? (
          <div className="p-6 text-sm text-slate-600">No log entries match the current filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px]">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  {['Time', 'Origin', 'Actor', 'Action', 'Target', 'Details'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.logs.map((log) => {
                  const isClient = log.action.toLowerCase().match(
                    /client|workspace|onboarding|billing|subscription|payment|connector|ticket|complaint|support\.access/,
                  );
                  return (
                    <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                        {new Date(log.at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                          isClient
                            ? 'bg-indigo-100 text-indigo-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {isClient ? 'Client' : 'Internal'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">{log.actorEmail}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-900">{prettyAction(log.action)}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{log.target}</td>
                      <td className="px-4 py-3 text-sm text-slate-500">{prettyDetails(log.details)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Pagination ───────────────────────────────────────────────────── */}
      {data && data.totalPages > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            Page {data.page} of {data.totalPages} · {data.totalCount} entries
          </p>
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              disabled={data.page <= 1 || loading}
              onClick={() => goToPage(1)}
              className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              ««
            </button>
            <button
              type="button"
              disabled={data.page <= 1 || loading}
              onClick={() => goToPage(data.page - 1)}
              className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              ‹ Prev
            </button>

            {Array.from({ length: data.totalPages }, (_, i) => i + 1)
              .filter((p) => Math.abs(p - data.page) <= 2)
              .map((p) => (
                <button
                  key={p}
                  type="button"
                  disabled={loading}
                  onClick={() => goToPage(p)}
                  className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium disabled:opacity-40 ${
                    p === data.page
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {p}
                </button>
              ))}

            <button
              type="button"
              disabled={data.page >= data.totalPages || loading}
              onClick={() => goToPage(data.page + 1)}
              className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              Next ›
            </button>
            <button
              type="button"
              disabled={data.page >= data.totalPages || loading}
              onClick={() => goToPage(data.totalPages)}
              className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              »»
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
