'use client';

import { useState } from 'react';

type BackupFormat = 'json' | 'csv' | 'xlsx';

type Props = {
  canPurge: boolean;
  logCount: number;
  onPurgeComplete?: () => void;
};

export default function AuditLogActions({ canPurge, logCount, onPurgeComplete }: Props) {
  const [backupBusy, setBackupBusy] = useState(false);
  const [purgeBusy, setPurgeBusy] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [format, setFormat] = useState<BackupFormat>('json');

  async function backupLogs() {
    setBackupBusy(true);
    setError('');
    setNotice('');

    try {
      const res = await fetch(`/api/master/audit-logs/backup?format=${format}`, {
        method: 'GET',
        cache: 'no-store',
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || 'Failed to create audit backup.');
      }

      const blob = await res.blob();
      const disposition = res.headers.get('content-disposition') || '';
      const fileNameMatch = disposition.match(/filename="([^"]+)"/i);
      const fileName = fileNameMatch?.[1] || `audit-logs-${new Date().toISOString().slice(0, 10)}.${format}`;

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      setNotice(`Audit backup downloaded as ${format.toUpperCase()}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create audit backup.');
    } finally {
      setBackupBusy(false);
    }
  }

  async function purgeLogs() {
    if (confirmText.trim().toUpperCase() !== 'PURGE') {
      setError('Type PURGE to confirm.');
      return;
    }

    setPurgeBusy(true);
    setError('');
    setNotice('');

    try {
      const res = await fetch('/api/master/audit-logs/purge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmText: 'PURGE' }),
      });

      const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; deletedCount?: number } | null;
      if (!res.ok || !body?.ok) {
        throw new Error(body?.error || 'Failed to purge audit logs.');
      }

      setNotice(`Audit logs purged. Removed ${body.deletedCount || 0} entries.`);
      setConfirmText('');
      if (onPurgeComplete) onPurgeComplete(); else window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to purge audit logs.');
    } finally {
      setPurgeBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Retention Controls</h2>
          <p className="mt-1 text-xs text-slate-500">
            Back up logs before optional purge. Monthly reminder email is sent to operations@getmarveo.com.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as BackupFormat)}
            disabled={backupBusy || purgeBusy}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 disabled:opacity-60"
            aria-label="Download format"
          >
            <option value="json">JSON</option>
            <option value="csv">CSV</option>
            <option value="xlsx">Excel (XLSX)</option>
          </select>
          <button
            type="button"
            onClick={() => void backupLogs()}
            disabled={backupBusy || purgeBusy}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {backupBusy ? 'Preparing backup...' : 'Backup logs'}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
        <p className="text-sm font-semibold text-rose-900">Optional purge</p>
        <p className="mt-1 text-xs text-rose-800">
          Purge is destructive. Super Admin approval is required unless you are logged in as Super Admin.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="Type PURGE"
            className="rounded-xl border border-rose-300 bg-white px-3 py-2 text-sm"
            disabled={purgeBusy || backupBusy || !canPurge || logCount === 0}
          />
          <button
            type="button"
            onClick={() => void purgeLogs()}
            disabled={purgeBusy || backupBusy || !canPurge || logCount === 0 || confirmText.trim().toUpperCase() !== 'PURGE'}
            className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {purgeBusy ? 'Purging...' : 'Purge logs'}
          </button>
          {!canPurge ? (
            <span className="text-xs font-semibold text-rose-700">Super Admin approval required.</span>
          ) : null}
        </div>
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {notice ? <p className="text-sm text-emerald-700">{notice}</p> : null}
    </div>
  );
}
