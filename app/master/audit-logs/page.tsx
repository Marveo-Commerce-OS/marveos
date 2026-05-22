export const dynamic = 'force-dynamic';

import { getControlCenterSnapshot } from '../_lib/controlCenter';

function toLabel(raw: string): string {
  return raw
    .replace(/[._-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function prettyAuditAction(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return 'Unknown action';
  const segments = trimmed.split('.').filter(Boolean);
  if (segments.length === 0) return toLabel(trimmed);
  if (segments.length === 1) return toLabel(segments[0]);
  return segments.slice(1).map((part) => toLabel(part)).join(' - ');
}

function prettyAuditDetails(value: string | undefined): string {
  if (!value) return 'No additional details.';
  return value
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [key, raw] = part.split('=');
      if (!raw) return toLabel(part);
      return `${toLabel(key)}: ${toLabel(raw)}`;
    })
    .join('; ');
}

export default async function MasterAuditLogsPage() {
  const snapshot = await getControlCenterSnapshot();
  const logs = snapshot.audit.slice(0, 100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Audit Logs</h1>
        <p className="mt-2 text-sm text-slate-600">Sensitive action history and operational audit stream for internal review.</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-600">Log entries available</p>
        <p className="text-2xl font-bold text-slate-900">{snapshot.audit.length}</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        {logs.length === 0 ? (
          <div className="p-6 text-sm text-slate-600">No audit entries found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px]">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  {['Time', 'Actor', 'Action', 'Target', 'Details'].map((header) => (
                    <th key={header} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-slate-100">
                    <td className="px-4 py-3 text-sm text-slate-700">{new Date(log.at).toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{log.actorEmail}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900">{prettyAuditAction(log.action)}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{log.target}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{prettyAuditDetails(log.details)}</td>
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
