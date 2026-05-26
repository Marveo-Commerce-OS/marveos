import Link from 'next/link';
import { listLedgerEntries } from '@/lib/finance/ledger';
import { requireFinancePageAccess } from '../_lib/access';

export const dynamic = 'force-dynamic';

export default async function MasterFinanceLedgerPage() {
  await requireFinancePageAccess();
  const entries = await listLedgerEntries({ limit: 500 });

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Ledger</h1>
          <p className="mt-1 text-sm text-slate-600">Unified operational ledger for Marveo income and expenses.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="/api/master/finance/ledger/export?format=csv" className="rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700">Export CSV</a>
          <a href="/api/master/finance/ledger/export?format=pdf" className="rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700">PDF Placeholder</a>
          <Link href="/master/finance" className="rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700">Back to Finance</Link>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="px-2 py-2 font-semibold">Date</th>
                <th className="px-2 py-2 font-semibold">Type</th>
                <th className="px-2 py-2 font-semibold">Category</th>
                <th className="px-2 py-2 font-semibold">Description</th>
                <th className="px-2 py-2 font-semibold">Amount</th>
                <th className="px-2 py-2 font-semibold">Status</th>
                <th className="px-2 py-2 font-semibold">Reference</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b border-slate-100 last:border-b-0">
                  <td className="px-2 py-2 text-slate-600">{entry.transactionDate.slice(0, 10)}</td>
                  <td className="px-2 py-2 capitalize text-slate-700">{entry.type}</td>
                  <td className="px-2 py-2 text-slate-700">{entry.category}</td>
                  <td className="px-2 py-2 text-slate-700">{entry.description}</td>
                  <td className="px-2 py-2 font-semibold text-slate-900">{entry.amount.toLocaleString()} {entry.currency}</td>
                  <td className="px-2 py-2 text-slate-600">{entry.status}</td>
                  <td className="px-2 py-2 text-slate-600">{entry.reference || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {entries.length === 0 ? <p className="mt-2 text-sm text-slate-500">No ledger entries yet.</p> : null}
        </div>
      </div>
    </div>
  );
}
