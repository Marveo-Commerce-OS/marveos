import Link from 'next/link';
import { listLedgerEntries } from '@/lib/finance/ledger';
import { requireFinancePageAccess } from '../_lib/access';
import ExpensesManagerClient from './ExpensesManagerClient';

export const dynamic = 'force-dynamic';

export default async function MasterFinanceExpensesPage() {
  await requireFinancePageAccess();
  const entries = await listLedgerEntries({ type: 'expense', limit: 300 });

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Expenses</h1>
          <p className="mt-1 text-sm text-slate-600">Operational expense tracking for Marveo Master.</p>
        </div>
        <Link href="/master/finance" className="rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700">Back to Finance</Link>
      </div>

      <ExpensesManagerClient initialEntries={entries} />
    </div>
  );
}
