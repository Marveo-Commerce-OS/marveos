'use client';

import { useEffect, useMemo, useState } from 'react';

export type ReportRow = {
  id: string;
  name: string;
  country: string;
  incidentType: 'Incident' | 'Complaint';
  severity: 'high' | 'medium' | 'low';
  status: string;
  supportStatus: string;
  updatedAt: string;
};

type ScheduleConfig = {
  scheduleEnabled: boolean;
  frequency: 'WEEKLY' | 'MONTHLY';
  dayOfWeek: number;
  dayOfMonth: number;
  hourUTC: number;
  recipients: string[];
  includeIncidents: boolean;
  includeComplaints: boolean;
  includeAnalytics: boolean;
  updatedAt: string;
};

type Props = {
  rows: ReportRow[];
  snapshotMetrics: {
    failedDeployments: number;
    openSupportAssignments: number;
    launchBlockers: number;
    connectedWebsites: number;
    systemStatus: string;
    plansSold: number;
    plansAvailable: number;
  };
};

function toneClass(level: 'high' | 'medium' | 'low') {
  if (level === 'high') return 'border-red-200 bg-red-50 text-red-900';
  if (level === 'medium') return 'border-amber-200 bg-amber-50 text-amber-900';
  return 'border-emerald-200 bg-emerald-50 text-emerald-900';
}

function formatTimestampUTC(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Invalid date';

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} UTC`;
}

export default function ReportsBoard({ rows, snapshotMetrics }: Props) {
  const [typeFilter, setTypeFilter] = useState<'all' | 'Incident' | 'Complaint'>('all');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [windowDays, setWindowDays] = useState<'7' | '30' | '90' | 'all'>('30');
  const [schedule, setSchedule] = useState<ScheduleConfig | null>(null);
  const [recipientsInput, setRecipientsInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [scheduleNotice, setScheduleNotice] = useState('');
  const [scheduleError, setScheduleError] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/master/reports/schedule', { cache: 'no-store' });
        const body = (await res.json().catch(() => null)) as { ok?: boolean; schedule?: ScheduleConfig; error?: string } | null;
        if (!res.ok || !body?.schedule || cancelled) return;
        setSchedule(body.schedule);
        setRecipientsInput(body.schedule.recipients.join('\n'));
      } catch {
        if (!cancelled) setScheduleError('Failed to load schedule controls.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredRows = useMemo(() => {
    const now = Date.now();
    const maxAge = windowDays === 'all' ? Number.POSITIVE_INFINITY : Number(windowDays) * 24 * 60 * 60 * 1000;

    return rows.filter((row) => {
      if (typeFilter !== 'all' && row.incidentType !== typeFilter) return false;
      if (severityFilter !== 'all' && row.severity !== severityFilter) return false;
      const updated = new Date(row.updatedAt).getTime();
      if (Number.isNaN(updated)) return false;
      if (now - updated > maxAge) return false;
      return true;
    });
  }, [rows, typeFilter, severityFilter, windowDays]);

  const incidents = filteredRows.filter((row) => row.incidentType === 'Incident').length;
  const complaints = filteredRows.filter((row) => row.incidentType === 'Complaint').length;
  const resolvedRate = filteredRows.length === 0
    ? 100
    : Math.max(0, Math.round(((filteredRows.length - complaints) / filteredRows.length) * 100));

  const subscriptionHealth = {
    sold: snapshotMetrics.plansSold,
    available: snapshotMetrics.plansAvailable,
    conversionProxy: snapshotMetrics.plansAvailable > 0
      ? Math.round((snapshotMetrics.plansSold / snapshotMetrics.plansAvailable) * 100)
      : 0,
  };

  async function saveSchedule(e: React.FormEvent) {
    e.preventDefault();
    if (!schedule) return;

    setSaving(true);
    setScheduleError('');
    setScheduleNotice('');

    try {
      const recipients = recipientsInput
        .split(/[\n,;]+/)
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean);

      const res = await fetch('/api/master/reports/schedule', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...schedule, recipients }),
      });

      const body = (await res.json().catch(() => null)) as { ok?: boolean; schedule?: ScheduleConfig; error?: string } | null;
      if (!res.ok || !body?.ok || !body.schedule) {
        throw new Error(body?.error || 'Failed to save schedule controls.');
      }

      setSchedule(body.schedule);
      setRecipientsInput(body.schedule.recipients.join('\n'));
      setScheduleNotice('Report schedule saved. Automation remains controlled by this setting.');
    } catch (err) {
      setScheduleError(err instanceof Error ? err.message : 'Failed to save schedule controls.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-2">
          <h2 className="text-lg font-semibold text-slate-900">Filters</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <label className="text-sm text-slate-700">
              Incident type
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as 'all' | 'Incident' | 'Complaint')} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
                <option value="all">All</option>
                <option value="Incident">Incidents</option>
                <option value="Complaint">Complaints</option>
              </select>
            </label>
            <label className="text-sm text-slate-700">
              Severity
              <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value as 'all' | 'high' | 'medium' | 'low')} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
                <option value="all">All</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </label>
            <label className="text-sm text-slate-700">
              Date range
              <select value={windowDays} onChange={(e) => setWindowDays(e.target.value as '7' | '30' | '90' | 'all')} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
                <option value="all">All time</option>
              </select>
            </label>
          </div>
        </div>

        <form onSubmit={saveSchedule} className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">Controlled Scheduling</h2>
          <p className="mt-1 text-xs text-slate-500">Leadership reports only run when enabled here by super admin.</p>

          {scheduleError ? <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{scheduleError}</p> : null}
          {scheduleNotice ? <p className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{scheduleNotice}</p> : null}

          {schedule ? (
            <div className="mt-3 space-y-3 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={schedule.scheduleEnabled} onChange={(e) => setSchedule((prev) => prev ? { ...prev, scheduleEnabled: e.target.checked } : prev)} />
                Enable scheduled leadership report
              </label>

              <label className="block">
                Frequency
                <select value={schedule.frequency} onChange={(e) => setSchedule((prev) => prev ? { ...prev, frequency: e.target.value as 'WEEKLY' | 'MONTHLY' } : prev)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
                  <option value="WEEKLY">Weekly</option>
                  <option value="MONTHLY">Monthly</option>
                </select>
              </label>

              {schedule.frequency === 'WEEKLY' ? (
                <label className="block">
                  Weekday
                  <select value={schedule.dayOfWeek} onChange={(e) => setSchedule((prev) => prev ? { ...prev, dayOfWeek: Number(e.target.value) } : prev)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
                    <option value={0}>Sunday</option>
                    <option value={1}>Monday</option>
                    <option value={2}>Tuesday</option>
                    <option value={3}>Wednesday</option>
                    <option value={4}>Thursday</option>
                    <option value={5}>Friday</option>
                    <option value={6}>Saturday</option>
                  </select>
                </label>
              ) : (
                <label className="block">
                  Day of month
                  <input type="number" min={1} max={28} value={schedule.dayOfMonth} onChange={(e) => setSchedule((prev) => prev ? { ...prev, dayOfMonth: Number(e.target.value) } : prev)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                </label>
              )}

              <label className="block">
                Hour (UTC)
                <input type="number" min={0} max={23} value={schedule.hourUTC} onChange={(e) => setSchedule((prev) => prev ? { ...prev, hourUTC: Number(e.target.value) } : prev)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
              </label>

              <label className="block">
                Recipients
                <textarea value={recipientsInput} onChange={(e) => setRecipientsInput(e.target.value)} rows={4} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" placeholder="ceo@company.com\nops@company.com" />
              </label>

              <div className="space-y-1">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={schedule.includeIncidents} onChange={(e) => setSchedule((prev) => prev ? { ...prev, includeIncidents: e.target.checked } : prev)} />
                  Include incidents
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={schedule.includeComplaints} onChange={(e) => setSchedule((prev) => prev ? { ...prev, includeComplaints: e.target.checked } : prev)} />
                  Include complaints
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={schedule.includeAnalytics} onChange={(e) => setSchedule((prev) => prev ? { ...prev, includeAnalytics: e.target.checked } : prev)} />
                  Include analytics summary
                </label>
              </div>

              <button type="submit" disabled={saving} className="w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                {saving ? 'Saving...' : 'Save schedule controls'}
              </button>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">Loading schedule settings...</p>
          )}
        </form>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Incidents</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{incidents}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <p className="text-xs font-semibold uppercase tracking-wide">Open Complaints</p>
          <p className="mt-2 text-2xl font-bold">{complaints}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
          <p className="text-xs font-semibold uppercase tracking-wide">Resolution Rate</p>
          <p className="mt-2 text-2xl font-bold">{resolvedRate}%</p>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-blue-900">
          <p className="text-xs font-semibold uppercase tracking-wide">Plan Sales Signal</p>
          <p className="mt-2 text-2xl font-bold">{subscriptionHealth.sold} / {subscriptionHealth.available}</p>
          <p className="mt-1 text-xs opacity-80">{subscriptionHealth.conversionProxy}% sold/available proxy</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-2">
          <h2 className="text-lg font-semibold text-slate-900">Incident and Complaint Register</h2>
          {filteredRows.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
              No active incidents or complaints for current filters.
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[860px]">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    {['Workspace', 'Type', 'Severity', 'Country', 'Status', 'Support', 'Updated'].map((header) => (
                      <th key={header} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr key={`${row.id}-${row.updatedAt}`} className="border-b border-slate-100">
                      <td className="px-3 py-2">
                        <p className="text-sm font-semibold text-slate-900">{row.name}</p>
                        <p className="text-xs text-slate-500">{row.id}</p>
                      </td>
                      <td className="px-3 py-2 text-sm text-slate-700">{row.incidentType}</td>
                      <td className="px-3 py-2 text-sm">
                        <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${toneClass(row.severity)}`}>
                          {row.severity.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-sm text-slate-700">{row.country || 'n/a'}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{row.status}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{row.supportStatus}</td>
                      <td className="px-3 py-2 text-xs text-slate-500">{formatTimestampUTC(row.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">Executive Summary</h2>
          <ul className="mt-4 space-y-2 text-sm text-slate-700">
            <li>Failed deployments: {snapshotMetrics.failedDeployments}</li>
            <li>Open support assignments: {snapshotMetrics.openSupportAssignments}</li>
            <li>Launch blockers: {snapshotMetrics.launchBlockers}</li>
            <li>Connected websites: {snapshotMetrics.connectedWebsites}</li>
            <li>System status: {snapshotMetrics.systemStatus}</li>
          </ul>
          <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            Use this page during weekly leadership review to monitor risk, customer pressure, and delivery throughput.
          </p>
        </div>
      </div>
    </div>
  );
}
