'use client';

import { useState } from 'react';
import { EXPENSE_CATEGORIES } from '@/lib/finance/categories';
import { FINANCE_CURRENCY_OPTIONS, FINANCE_PAYMENT_METHOD_OPTIONS, formatFinanceOptionLabel } from '@/lib/finance/options';
import type { FinanceLedgerEntry } from '@/lib/finance/types';

type Props = {
  initialEntries: FinanceLedgerEntry[];
};

export default function ExpensesManagerClient({ initialEntries }: Props) {
  const [entries, setEntries] = useState<FinanceLedgerEntry[]>(initialEntries);
  const [busy, setBusy] = useState(false);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({
    vendor: '',
    category: 'operations',
    subcategory: '',
    amount: '',
    currency: 'USD',
    paymentMethod: '',
    receipt: '',
    notes: '',
    description: '',
    reference: '',
    status: 'pending',
    workspaceId: '',
    clientId: '',
    incurredDate: '',
  });

  async function uploadReceipt(file: File | null) {
    if (!file) return;

    setUploadingReceipt(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/media/upload', {
        method: 'POST',
        body: formData,
      });

      const payload = (await res.json().catch(() => null)) as { ok?: boolean; source_url?: string; error?: string } | null;
      if (!res.ok || !payload?.ok || !payload.source_url) {
        throw new Error(payload?.error || 'Failed to upload receipt');
      }

      setForm((prev) => ({ ...prev, receipt: String(payload.source_url) }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload receipt');
    } finally {
      setUploadingReceipt(false);
    }
  }

  async function submit() {
    if (!form.vendor.trim()) {
      setError('Vendor is required.');
      return;
    }

    if (!form.category || !form.currency || !form.paymentMethod || !form.status) {
      setError('Category, currency, payment method, and status are required.');
      return;
    }

    if (!Number.isFinite(Number(form.amount)) || Number(form.amount) <= 0) {
      setError('Amount must be greater than zero.');
      return;
    }

    if (!form.incurredDate) {
      setError('Incurred date is required.');
      return;
    }

    if (!form.receipt) {
      setError('Receipt upload is required.');
      return;
    }

    setBusy(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/master/finance/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          amount: Number(form.amount),
        }),
      });

      const payload = (await res.json().catch(() => null)) as { ok?: boolean; entry?: FinanceLedgerEntry; error?: string } | null;
      if (!res.ok || !payload?.ok || !payload.entry) {
        throw new Error(payload?.error || 'Failed to save expense entry');
      }

      setEntries((prev) => [payload.entry as FinanceLedgerEntry, ...prev]);
      setForm((prev) => ({
        ...prev,
        vendor: '',
        amount: '',
        paymentMethod: '',
        notes: '',
        description: '',
        reference: '',
        receipt: '',
      }));
      setSuccess('Expense entry added.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save expense entry');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
      {success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div> : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-slate-900">Expense Entry</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input value={form.vendor} onChange={(event) => setForm((prev) => ({ ...prev, vendor: event.target.value }))} placeholder="Vendor" className="rounded-lg border border-slate-300 px-2 py-2 text-sm" />
          <select value={form.category} onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))} className="rounded-lg border border-slate-300 px-2 py-2 text-sm">
            {EXPENSE_CATEGORIES.map((category) => <option key={category.key} value={category.key}>{category.label}</option>)}
          </select>
          <input type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))} placeholder="Amount" className="rounded-lg border border-slate-300 px-2 py-2 text-sm" />
          <select value={form.currency} onChange={(event) => setForm((prev) => ({ ...prev, currency: event.target.value }))} className="rounded-lg border border-slate-300 px-2 py-2 text-sm" required>
            {FINANCE_CURRENCY_OPTIONS.map((currency) => (
              <option key={currency} value={currency}>{currency}</option>
            ))}
          </select>
          <select value={form.paymentMethod} onChange={(event) => setForm((prev) => ({ ...prev, paymentMethod: event.target.value }))} className="rounded-lg border border-slate-300 px-2 py-2 text-sm" required>
            <option value="">Select payment method</option>
            {FINANCE_PAYMENT_METHOD_OPTIONS.map((method) => (
              <option key={method} value={method}>{formatFinanceOptionLabel(method)}</option>
            ))}
          </select>
          <select value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))} className="rounded-lg border border-slate-300 px-2 py-2 text-sm">
            <option value="pending">pending</option>
            <option value="approved">approved</option>
            <option value="paid">paid</option>
            <option value="cancelled">cancelled</option>
          </select>
          <input type="date" value={form.incurredDate} onChange={(event) => setForm((prev) => ({ ...prev, incurredDate: event.target.value }))} className="rounded-lg border border-slate-300 px-2 py-2 text-sm" />
          <input value={form.subcategory} onChange={(event) => setForm((prev) => ({ ...prev, subcategory: event.target.value }))} placeholder="Subcategory" className="rounded-lg border border-slate-300 px-2 py-2 text-sm" />
          <input value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} placeholder="Description" className="rounded-lg border border-slate-300 px-2 py-2 text-sm md:col-span-2" />
          <input value={form.reference} onChange={(event) => setForm((prev) => ({ ...prev, reference: event.target.value }))} placeholder="Reference" className="rounded-lg border border-slate-300 px-2 py-2 text-sm" />
          <div className="rounded-lg border border-slate-300 px-2 py-2 text-sm">
            <label className="text-xs font-medium text-slate-600">Receipt Upload</label>
            <input type="file" accept=".pdf,image/*" onChange={(event) => void uploadReceipt(event.target.files?.[0] ?? null)} className="mt-1 block w-full text-xs" />
            <p className="mt-1 text-[11px] text-slate-500">Upload only. Direct URL input is disabled.</p>
            {uploadingReceipt ? <p className="mt-1 text-[11px] text-sky-700">Uploading receipt...</p> : null}
            {form.receipt ? <p className="mt-1 truncate text-[11px] text-emerald-700">Receipt attached</p> : null}
          </div>
          <input value={form.workspaceId} onChange={(event) => setForm((prev) => ({ ...prev, workspaceId: event.target.value }))} placeholder="Workspace ID (optional)" className="rounded-lg border border-slate-300 px-2 py-2 text-sm" />
          <input value={form.clientId} onChange={(event) => setForm((prev) => ({ ...prev, clientId: event.target.value }))} placeholder="Client ID (optional)" className="rounded-lg border border-slate-300 px-2 py-2 text-sm" />
          <textarea value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} placeholder="Notes" rows={2} className="rounded-lg border border-slate-300 px-2 py-2 text-sm md:col-span-2 xl:col-span-4" />
        </div>
        <button type="button" onClick={() => void submit()} disabled={busy || uploadingReceipt} className="mt-3 rounded-full border border-rose-300 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700 disabled:opacity-60">{busy ? 'Saving...' : 'Add expense entry'}</button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-slate-900">Expense Ledger</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="px-2 py-2 font-semibold">Date</th>
                <th className="px-2 py-2 font-semibold">Vendor</th>
                <th className="px-2 py-2 font-semibold">Category</th>
                <th className="px-2 py-2 font-semibold">Amount</th>
                <th className="px-2 py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b border-slate-100 last:border-b-0">
                  <td className="px-2 py-2">{entry.transactionDate.slice(0, 10)}</td>
                  <td className="px-2 py-2">{entry.vendor || '-'}</td>
                  <td className="px-2 py-2">{entry.category}</td>
                  <td className="px-2 py-2 font-semibold">{entry.amount.toLocaleString()} {entry.currency}</td>
                  <td className="px-2 py-2">{entry.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {entries.length === 0 ? <p className="mt-2 text-sm text-slate-500">No expense entries yet.</p> : null}
        </div>
      </div>
    </div>
  );
}
