'use client';

import { useMemo, useState } from 'react';

type WorkspaceStatus = 'draft' | 'onboarding' | 'ready_for_launch' | 'launched' | 'blocked';
type WebsiteType = 'NEW_WEBSITE' | 'EXISTING_WEBSITE' | 'CUSTOM_HEADLESS' | undefined;
type ConnectorStatus = 'NOT_CONNECTED' | 'TOKEN_GENERATED' | 'PENDING_VERIFICATION' | 'CONNECTED' | 'FAILED' | 'SUPPORT_REQUIRED' | undefined;
type SupportStatus = 'UNASSIGNED' | 'ASSIGNED' | 'IN_PROGRESS' | 'WAITING_FOR_CLIENT' | 'COMPLETED' | undefined;

export type OverviewWorkspaceAnalyticsRow = {
  id: string;
  country: string;
  state?: string;
  websiteType?: WebsiteType;
  status: WorkspaceStatus;
  connectorStatus?: ConnectorStatus;
  supportRequired?: boolean;
  supportAssignmentStatus?: SupportStatus;
  createdAt: string;
};

type Props = {
  workspaces: OverviewWorkspaceAnalyticsRow[];
  countryCatalog?: string[];
};

const STATUS_ORDER: WorkspaceStatus[] = ['draft', 'onboarding', 'ready_for_launch', 'launched', 'blocked'];

function toTitle(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key: string): string {
  const [year, month] = key.split('-');
  return `${month}/${year.slice(-2)}`;
}

function LineChart({ values }: { values: number[] }) {
  const width = 760;
  const height = 180;
  const padding = 20;
  const max = Math.max(1, ...values);

  const points = values
    .map((value, index) => {
      const x = padding + (index * (width - padding * 2)) / Math.max(1, values.length - 1);
      const y = height - padding - (value / max) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-44 w-full">
      <defs>
        <linearGradient id="analyticsLineFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(30 64 175 / 0.35)" />
          <stop offset="100%" stopColor="rgb(30 64 175 / 0.04)" />
        </linearGradient>
      </defs>
      <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="rgb(226 232 240)" strokeWidth="1" />
      <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="rgb(226 232 240)" strokeWidth="1" />
      <polyline fill="none" stroke="rgb(30 64 175)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" points={points} />
      {points ? (
        <polygon
          points={`${padding},${height - padding} ${points} ${width - padding},${height - padding}`}
          fill="url(#analyticsLineFill)"
        />
      ) : null}
    </svg>
  );
}

const PINNED_COUNTRIES = [
  'Nigeria',
  'United Arab Emirates',
  'United Kingdom',
  'United States',
  'Canada',
  'Kenya',
  'South Africa',
];

export default function OverviewAnalytics({ workspaces, countryCatalog = [] }: Props) {
  const [period, setPeriod] = useState<'30' | '90' | '180' | 'all'>('90');
  const [country, setCountry] = useState<string>('all');
  const [state, setState] = useState<string>('all');
  const [websiteType, setWebsiteType] = useState<'all' | 'NEW_WEBSITE' | 'EXISTING_WEBSITE' | 'CUSTOM_HEADLESS'>('all');
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const [pdfNotice, setPdfNotice] = useState('');

  // Pinned countries always appear first in the dropdown.
  const countryOptions = useMemo(() => {
    const allNames = new Set<string>(PINNED_COUNTRIES);
    for (const countryName of countryCatalog) {
      const n = String(countryName || '').trim();
      if (n) allNames.add(n);
    }
    for (const ws of workspaces) {
      const n = String(ws.country || '').trim();
      if (n) allNames.add(n);
    }
    const pinnedSet = new Set(PINNED_COUNTRIES);
    const rest = Array.from(allNames)
      .filter((n) => !pinnedSet.has(n))
      .sort((a, b) => a.localeCompare(b));
    return [...PINNED_COUNTRIES, ...rest];
  }, [workspaces, countryCatalog]);

  const stateOptions = useMemo(() => {
    const set = new Set<string>();
    for (const ws of workspaces) {
      const n = String(ws.state || '').trim();
      if (n) set.add(n);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [workspaces]);

  const filtered = useMemo(() => {
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now();
    const windowMs = period === 'all' ? Number.POSITIVE_INFINITY : Number(period) * 24 * 60 * 60 * 1000;

    return workspaces.filter((ws) => {
      const createdAt = new Date(ws.createdAt).getTime();
      if (Number.isNaN(createdAt)) return false;
      if (now - createdAt > windowMs) return false;
      if (country !== 'all' && ws.country !== country) return false;
      if (state !== 'all' && ws.state !== state) return false;
      if (websiteType !== 'all' && ws.websiteType !== websiteType) return false;
      return true;
    });
  }, [workspaces, period, country, state, websiteType]);

  const statusCounts = useMemo(() => {
    const base: Record<WorkspaceStatus, number> = {
      draft: 0,
      onboarding: 0,
      ready_for_launch: 0,
      launched: 0,
      blocked: 0,
    };

    for (const ws of filtered) {
      base[ws.status] += 1;
    }

    return base;
  }, [filtered]);

  const connectorCounts = useMemo(() => {
    const counts = {
      connected: 0,
      pending: 0,
      failed: 0,
      notConnected: 0,
    };

    for (const ws of filtered) {
      if (ws.connectorStatus === 'CONNECTED') counts.connected += 1;
      else if (ws.connectorStatus === 'PENDING_VERIFICATION' || ws.connectorStatus === 'TOKEN_GENERATED') counts.pending += 1;
      else if (ws.connectorStatus === 'FAILED') counts.failed += 1;
      else counts.notConnected += 1;
    }

    return counts;
  }, [filtered]);

  const timeline = useMemo(() => {
    const counts = new Map<string, number>();
    for (const ws of filtered) {
      const d = new Date(ws.createdAt);
      if (Number.isNaN(d.getTime())) continue;
      const key = monthKey(d);
      counts.set(key, (counts.get(key) || 0) + 1);
    }

    const sorted = Array.from(counts.entries()).sort(([a], [b]) => a.localeCompare(b));
    const labels = sorted.map(([key]) => monthLabel(key));
    const values = sorted.map(([, count]) => count);
    return { labels, values };
  }, [filtered]);

  const supportLoad = useMemo(() => {
    const requiringSupport = filtered.filter((ws) => ws.supportRequired).length;
    const unresolved = filtered.filter((ws) => ws.supportRequired && ws.supportAssignmentStatus !== 'ASSIGNED').length;
    return { requiringSupport, unresolved };
  }, [filtered]);

  const launchReadinessRate = filtered.length === 0
    ? 0
    : Math.round((filtered.filter((ws) => ws.status === 'ready_for_launch' || ws.status === 'launched').length / filtered.length) * 100);

  function exportCsv() {
    const header = [
      'workspace_id',
      'country',
      'state',
      'website_type',
      'status',
      'connector_status',
      'support_required',
      'support_assignment_status',
      'created_at',
    ];

    const rows = filtered.map((ws) => [
      ws.id,
      ws.country,
      ws.state || '',
      ws.websiteType || '',
      ws.status,
      ws.connectorStatus || '',
      ws.supportRequired ? 'true' : 'false',
      ws.supportAssignmentStatus || '',
      ws.createdAt,
    ]);

    const csv = [header, ...rows]
      .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `control-center-analytics-${Date.now()}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function exportPdf() {
    setPdfBusy(true);
    setPdfError('');
    setPdfNotice('');

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 45000);

    try {
      const payload = {
        generatedAt: new Date().toISOString(),
        filters: {
          period,
          country,
          state,
          websiteType,
        },
        totalWorkspaces: filtered.length,
        launchReadinessRate,
        statusCounts,
        connectorCounts,
        supportLoad,
        timeline,
      };

      const res = await fetch('/api/master/decision-dashboard-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || 'Failed to generate PDF report.');
      }

      const blob = await res.blob();
      const disposition = res.headers.get('content-disposition') ?? '';
      const match = disposition.match(/filename="([^"]+)"/i);
      const fileName = match?.[1] ?? `decision-dashboard-${Date.now()}.pdf`;

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      setPdfNotice('PDF report downloaded.');
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        setPdfError('PDF generation timed out. Please reduce filters and try again.');
      } else {
        setPdfError(error instanceof Error ? error.message : 'Failed to generate PDF report.');
      }
    } finally {
      window.clearTimeout(timeout);
      setPdfBusy(false);
    }
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Global Analytics</p>
          <h2 className="mt-1 text-xl font-bold text-slate-900">Decision Dashboard</h2>
          <p className="mt-1 text-sm text-slate-600">Filter operations signals to evaluate growth, delivery health, and risk exposure.</p>
          {pdfError ? <p className="mt-2 text-xs font-semibold text-rose-700">{pdfError}</p> : null}
          {pdfNotice ? <p className="mt-2 text-xs font-semibold text-emerald-700">{pdfNotice}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={exportCsv}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => void exportPdf()}
            disabled={pdfBusy}
            className="rounded-xl border border-indigo-300 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-60"
          >
            {pdfBusy ? 'Generating PDF…' : 'Download PDF Report'}
          </button>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as '30' | '90' | '180' | 'all')}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
          >
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="180">Last 180 days</option>
            <option value="all">All time</option>
          </select>
          <select
            value={country}
            onChange={(e) => { setCountry(e.target.value); setState('all'); }}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
          >
            <option value="all">All countries</option>
            {countryOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          {stateOptions.length > 0 && (
            <select
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
            >
              <option value="all">All states</option>
              {stateOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          )}
          <select
            value={websiteType}
            onChange={(e) => setWebsiteType(e.target.value as 'all' | 'NEW_WEBSITE' | 'EXISTING_WEBSITE' | 'CUSTOM_HEADLESS')}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
          >
            <option value="all">All website types</option>
            <option value="NEW_WEBSITE">New website</option>
            <option value="EXISTING_WEBSITE">Existing website</option>
            <option value="CUSTOM_HEADLESS">Custom / Headless</option>
          </select>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Filtered Workspaces</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{filtered.length}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
          <p className="text-xs font-semibold uppercase tracking-wide">Launch Readiness Rate</p>
          <p className="mt-2 text-3xl font-bold">{launchReadinessRate}%</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <p className="text-xs font-semibold uppercase tracking-wide">Unresolved Support</p>
          <p className="mt-2 text-3xl font-bold">{supportLoad.unresolved}</p>
          <p className="mt-1 text-xs opacity-80">Out of {supportLoad.requiringSupport} support-required workspaces</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 xl:col-span-3">
          <p className="text-sm font-semibold text-slate-900">Workspace Creation Trend</p>
          <p className="mt-1 text-xs text-slate-500">Monthly trend for the current filter selection</p>
          {timeline.values.length > 0 ? (
            <>
              <LineChart values={timeline.values} />
              <div className="grid grid-cols-6 gap-2 text-[11px] text-slate-500">
                {timeline.labels.slice(-6).map((label) => (
                  <span key={label} className="truncate">{label}</span>
                ))}
              </div>
            </>
          ) : (
            <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
              No data in current filter window.
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 xl:col-span-2">
          <p className="text-sm font-semibold text-slate-900">Status Mix</p>
          <p className="mt-1 text-xs text-slate-500">Distribution of delivery pipeline stages</p>
          <div className="mt-4 space-y-3">
            {STATUS_ORDER.map((status) => {
              const value = statusCounts[status];
              const pct = filtered.length === 0 ? 0 : Math.round((value / filtered.length) * 100);
              return (
                <div key={status}>
                  <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
                    <span>{toTitle(status)}</span>
                    <span>{value} ({pct}%)</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div className="h-2 rounded-full bg-slate-700" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-4">
        {[
          { label: 'Connector Connected', value: connectorCounts.connected, tone: 'border-emerald-200 bg-emerald-50 text-emerald-900' },
          { label: 'Connector Pending', value: connectorCounts.pending, tone: 'border-amber-200 bg-amber-50 text-amber-900' },
          { label: 'Connector Failed', value: connectorCounts.failed, tone: 'border-red-200 bg-red-50 text-red-900' },
          { label: 'Not Connected', value: connectorCounts.notConnected, tone: 'border-slate-200 bg-slate-50 text-slate-900' },
        ].map((item) => (
          <div key={item.label} className={`rounded-2xl border p-4 ${item.tone}`}>
            <p className="text-xs font-semibold uppercase tracking-wide">{item.label}</p>
            <p className="mt-2 text-2xl font-bold">{item.value}</p>
          </div>
        ))}
      </div>

      <CountryStateBreakdown workspaces={filtered} />
    </section>
  );
}

// ─── Country + State Breakdown ────────────────────────────────────────────────

function barW(value: number, max: number): string {
  if (max <= 0 || value <= 0) return '0%';
  return `${Math.max(4, Math.round((value / max) * 100))}%`;
}

function CountryStateBreakdown({ workspaces }: { workspaces: OverviewWorkspaceAnalyticsRow[] }) {
  const countryData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const ws of workspaces) {
      const key = (ws.country || 'Unknown').trim() || 'Unknown';
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    // Pinned countries always shown first (even with 0), then dynamic remainder
    const pinnedSet = new Set(PINNED_COUNTRIES);
    const pinned = PINNED_COUNTRIES.map((name) => [name, counts.get(name) || 0] as [string, number]);
    const dynamic = Array.from(counts.entries())
      .filter(([name]) => !pinnedSet.has(name))
      .sort((a, b) => b[1] - a[1]);
    return [...pinned, ...dynamic];
  }, [workspaces]);

  const stateData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const ws of workspaces) {
      const s = (ws.state || '').trim();
      if (!s) continue;
      counts.set(s, (counts.get(s) || 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 15);
  }, [workspaces]);

  const countryMax = Math.max(1, ...countryData.map(([, v]) => v));
  const stateMax = Math.max(1, ...stateData.map(([, v]) => v));

  return (
    <div className="mt-4 grid gap-4 xl:grid-cols-2">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-900">Usage by Country</p>
        <p className="mt-1 text-xs text-slate-500">Pinned markets always shown · dynamic additions below</p>
        <div className="mt-4 space-y-3">
          {countryData.map(([name, value], idx) => {
            const isPinned = idx < PINNED_COUNTRIES.length;
            return (
              <div key={name}>
                {isPinned && idx === 0 && (
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Priority Markets</p>
                )}
                {!isPinned && idx === PINNED_COUNTRIES.length && stateData.length > 0 && (
                  <p className="mb-2 mt-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Other</p>
                )}
                <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
                  <span className={isPinned ? 'font-medium text-slate-800' : ''}>{name}</span>
                  <span>{value}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div
                    className={`h-2 rounded-full ${isPinned ? 'bg-blue-700' : 'bg-slate-500'}`}
                    style={{ width: barW(value, countryMax) }}
                  />
                </div>
              </div>
            );
          })}
          {countryData.every(([, v]) => v === 0) && (
            <p className="text-sm text-slate-400">No workspace data yet — pinned markets are pre-seeded.</p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-semibold text-slate-900">Usage by State / Region</p>
        <p className="mt-1 text-xs text-slate-500">Top 15 states across filtered workspaces</p>
        <div className="mt-4 space-y-3">
          {stateData.length === 0 ? (
            <p className="text-sm text-slate-400">No state data yet. State is captured from workspace business profiles.</p>
          ) : stateData.map(([name, value]) => (
            <div key={name}>
              <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
                <span>{name}</span>
                <span>{value}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-indigo-600" style={{ width: barW(value, stateMax) }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
