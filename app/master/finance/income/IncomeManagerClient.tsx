'use client';

import { useState } from 'react';
import { INCOME_CATEGORIES } from '@/lib/finance/categories';
import { FINANCE_CURRENCY_OPTIONS, formatFinanceOptionLabel } from '@/lib/finance/options';
import type { FinanceLedgerEntry } from '@/lib/finance/types';

type Props = {
  initialEntries: FinanceLedgerEntry[];
};

export default function IncomeManagerClient({ initialEntries }: Props) {
  const [entries, setEntries] = useState<FinanceLedgerEntry[]>(initialEntries);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({
    category: 'subscriptions',
    subcategory: '',
    amount: '',
    currency: 'USD',
    description: '',
    reference: '',
    source: 'manual_adjustment',
    sourceId: '',
    status: 'pending',
    workspaceId: '',
    clientId: '',
    transactionDate: '',
  });

  const incomeSourceOptions = [
    'manual_adjustment',
    'loan_funding',
    'subscription_paid',
    'workspace_setup_paid',
    'deployment_fee_paid',
    'template_purchase',
    'ai_addon_activated',
    'support_retainer',
    'invoice_paid',
  ] as const;

  async function submit() {
    if (!form.category || !form.currency || !form.status || !form.source) {
      setError('Category, currency, source, and status are required.');
      return;
    }

    if (!Number.isFinite(Number(form.amount)) || Number(form.amount) <= 0) {
      setError('Amount must be greater than zero.');
      return;
    }

    if (!String(form.sourceId || form.reference).trim()) {
      setError('Source ID or reference is required.');
      return;
    }

    setBusy(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/master/finance/income', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          amount: Number(form.amount),
        }),
      });

      const payload = (await res.json().catch(() => null)) as { ok?: boolean; entry?: FinanceLedgerEntry; error?: string } | null;
      if (!res.ok || !payload?.ok || !payload.entry) {
        throw new Error(payload?.error || 'Failed to save income entry');
      }

      setEntries((prev) => [payload.entry as FinanceLedgerEntry, ...prev]);
      setForm((prev) => ({ ...prev, amount: '', description: '', reference: '', sourceId: '', subcategory: '' }));
      setSuccess('Income entry added.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save income entry');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
      {success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div> : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-slate-900">Manual Income Entry</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <select value={form.category} onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))} className="rounded-lg border border-slate-300 px-2 py-2 text-sm" required>
            {INCOME_CATEGORIES.map((category) => <option key={category.key} value={category.key}>{category.label}</option>)}
          </select>
          <input type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))} placeholder="Amount" className="rounded-lg border border-slate-300 px-2 py-2 text-sm" required />
          <select value={form.currency} onChange={(event) => setForm((prev) => ({ ...prev, currency: event.target.value }))} className="rounded-lg border border-slate-300 px-2 py-2 text-sm" required>
            {FINANCE_CURRENCY_OPTIONS.map((currency) => (
              <option key={currency} value={currency}>{currency}</option>
            ))}
          </select>
          <select value={form.source} onChange={(event) => setForm((prev) => ({ ...prev, source: event.target.value }))} className="rounded-lg border border-slate-300 px-2 py-2 text-sm" required>
            {incomeSourceOptions.map((source) => (
              <option key={source} value={source}>{formatFinanceOptionLabel(source)}</option>
            ))}
          </select>
          <select value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))} className="rounded-lg border border-slate-300 px-2 py-2 text-sm" required>
            <option value="pending">pending</option>
            <option value="paid">paid</option>
            <option value="failed">failed</option>
            <option value="refunded">refunded</option>
          </select>
          <input value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} placeholder="Description" className="rounded-lg border border-slate-300 px-2 py-2 text-sm md:col-span-2" />
          <input value={form.reference} onChange={(event) => setForm((prev) => ({ ...prev, reference: event.target.value }))} placeholder="Reference" className="rounded-lg border border-slate-300 px-2 py-2 text-sm" />
          <input value={form.sourceId} onChange={(event) => setForm((prev) => ({ ...prev, sourceId: event.target.value }))} placeholder="Source ID" className="rounded-lg border border-slate-300 px-2 py-2 text-sm" />
          <input value={form.subcategory} onChange={(event) => setForm((prev) => ({ ...prev, subcategory: event.target.value }))} placeholder="Subcategory" className="rounded-lg border border-slate-300 px-2 py-2 text-sm" />
          <input value={form.workspaceId} onChange={(event) => setForm((prev) => ({ ...prev, workspaceId: event.target.value }))} placeholder="Workspace ID (optional)" className="rounded-lg border border-slate-300 px-2 py-2 text-sm" />
          <input value={form.clientId} onChange={(event) => setForm((prev) => ({ ...prev, clientId: event.target.value }))} placeholder="Client ID (optional)" className="rounded-lg border border-slate-300 px-2 py-2 text-sm" />
          <input type="date" value={form.transactionDate} onChange={(event) => setForm((prev) => ({ ...prev, transactionDate: event.target.value }))} className="rounded-lg border border-slate-300 px-2 py-2 text-sm" />
        </div>
        <button type="button" onClick={() => void submit()} disabled={busy} className="mt-3 rounded-full border border-sky-300 bg-sky-50 px-4 py-2 text-xs font-semibold text-sky-700 disabled:opacity-60">{busy ? 'Saving...' : 'Add income entry'}</button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-slate-900">Income Ledger</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="px-2 py-2 font-semibold">Date</th>
                <th className="px-2 py-2 font-semibold">Category</th>
                <th className="px-2 py-2 font-semibold">Amount</th>
                <th className="px-2 py-2 font-semibold">Status</th>
                <th className="px-2 py-2 font-semibold">Reference</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b border-slate-100 last:border-b-0">
                  <td className="px-2 py-2">{entry.transactionDate.slice(0, 10)}</td>
                  <td className="px-2 py-2">{entry.category}</td>
                  <td className="px-2 py-2 font-semibold">{entry.amount.toLocaleString()} {entry.currency}</td>
                  <td className="px-2 py-2">{entry.status}</td>
                  <td className="px-2 py-2">{entry.reference || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {entries.length === 0 ? <p className="mt-2 text-sm text-slate-500">No income entries yet.</p> : null}
        </div>
      </div>
    </div>
  );
}
