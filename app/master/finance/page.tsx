import Link from 'next/link';
import { listLedgerEntries } from '@/lib/finance/ledger';
import { buildFinanceDashboardMetrics, buildInvestorReadinessMetrics, buildOperationalFinanceReports } from '@/lib/finance/metrics';
import { requireFinancePageAccess } from './_lib/access';
import FinanceOverviewClient from './FinanceOverviewClient';
import { FINANCE_CURRENCY_OPTIONS } from '@/lib/finance/options';

export const dynamic = 'force-dynamic';

type FinancePageSearchParams = {
  period?: string;
  currency?: string;
};

function resolvePeriodLabel(period: string): string {
  if (period === 'week') return 'Weekly';
  if (period === 'month') return 'Monthly';
  if (period === 'year') return 'Annual';
  return 'All-time';
}

export default async function MasterFinancePage({ searchParams }: { searchParams?: Promise<FinancePageSearchParams> }) {
  await requireFinancePageAccess();

  const params = (await searchParams) || {};
  const periodRaw = String(params.period || 'month').trim().toLowerCase();
  const period = periodRaw === 'week' || periodRaw === 'month' || periodRaw === 'year' || periodRaw === 'all'
    ? periodRaw as 'week' | 'month' | 'year' | 'all'
    : 'month';

  const currencyRaw = String(params.currency || FINANCE_CURRENCY_OPTIONS[0]).trim().toUpperCase();
  const currency = FINANCE_CURRENCY_OPTIONS.includes(currencyRaw as (typeof FINANCE_CURRENCY_OPTIONS)[number])
    ? currencyRaw
    : FINANCE_CURRENCY_OPTIONS[0];

  const dashboard = await buildFinanceDashboardMetrics({ period, currency });
  const investor = await buildInvestorReadinessMetrics({ period, currency });
  const reports = await buildOperationalFinanceReports({ period, currency });
  const recent = await listLedgerEntries({ limit: 8 });
  const periodLabel = resolvePeriodLabel(period);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Operational Finance</h1>
          <p className="mt-1 text-sm text-slate-600">Lightweight platform ledger for revenue and expense visibility.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/master/finance/ledger" className="rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700">Ledger</Link>
          <Link href="/master/finance/income" className="rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700">Income</Link>
          <Link href="/master/finance/expenses" className="rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700">Expenses</Link>
          <Link href={`/master/finance/reports?period=${period}&currency=${currency}`} className="rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700">Reports</Link>
          <Link href={`/master/finance/funding?period=${period}&currency=${currency}`} className="rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700">Funding & Liabilities</Link>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Overview Filters</span>
          <div className="flex flex-wrap gap-2">
            {(['week', 'month', 'year', 'all'] as const).map((value) => (
              <Link
                key={value}
                href={`/master/finance?period=${value}&currency=${currency}`}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${period === value ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-slate-300 bg-white text-slate-700'}`}
              >
                {value === 'week' ? 'Weekly' : value === 'month' ? 'Monthly' : value === 'year' ? 'Annual' : 'All-time'}
              </Link>
            ))}
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            {FINANCE_CURRENCY_OPTIONS.map((code) => (
              <Link
                key={code}
                href={`/master/finance?period=${period}&currency=${code}`}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${currency === code ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-300 bg-white text-slate-700'}`}
              >
                {code}
              </Link>
            ))}
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-500">All summary values below are normalized to {dashboard.reportCurrency} using platform FX settings.</p>
        <p className="mt-1 text-xs text-slate-500">FX snapshot: {dashboard.fxSnapshotVersion} at {new Date(dashboard.fxSnapshotAt).toLocaleString()}.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Revenue ({periodLabel})</p>
          <p className="mt-2 text-2xl font-bold text-emerald-900">{dashboard.totalRevenue.toLocaleString()} {dashboard.reportCurrency}</p>
        </div>
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Window Revenue</p>
          <p className="mt-2 text-2xl font-bold text-sky-900">{dashboard.monthlyRevenue.toLocaleString()} {dashboard.reportCurrency}</p>
        </div>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Window Expenses</p>
          <p className="mt-2 text-2xl font-bold text-rose-900">{dashboard.monthlyExpenses.toLocaleString()} {dashboard.reportCurrency}</p>
        </div>
        <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Net Position</p>
          <p className="mt-2 text-2xl font-bold text-violet-900">{dashboard.netPosition.toLocaleString()} {dashboard.reportCurrency}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Active Subscriptions Revenue</p>
          <p className="mt-2 text-xl font-bold text-slate-900">{dashboard.activeSubscriptionsRevenue.toLocaleString()} {dashboard.reportCurrency}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pending Payments</p>
          <p className="mt-2 text-xl font-bold text-slate-900">{dashboard.pendingPayments.toLocaleString()} {dashboard.reportCurrency}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Refunds</p>
          <p className="mt-2 text-xl font-bold text-slate-900">{dashboard.refunds.toLocaleString()} {dashboard.reportCurrency}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Loan Inflows (Non-Revenue)</p>
          <p className="mt-2 text-xl font-bold text-amber-900">{dashboard.loanInflows.toLocaleString()} {dashboard.reportCurrency}</p>
        </div>
      </div>

      <FinanceOverviewClient
        revenueByCategory={dashboard.revenueByCategory}
        revenueByMonth={reports.revenueByMonth}
        reportCurrency={dashboard.reportCurrency}
        periodLabel={periodLabel}
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-lg font-semibold text-slate-900">Investor Readiness Foundations</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm"><span className="text-slate-500">MRR</span><p className="font-semibold text-slate-900">{investor.mrr.toLocaleString()} {dashboard.reportCurrency}</p></div>
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm"><span className="text-slate-500">ARR</span><p className="font-semibold text-slate-900">{investor.arr.toLocaleString()} {dashboard.reportCurrency}</p></div>
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm"><span className="text-slate-500">Burn Rate</span><p className="font-semibold text-slate-900">{investor.burnRate.toLocaleString()} {dashboard.reportCurrency}</p></div>
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm"><span className="text-slate-500">Revenue Growth %</span><p className="font-semibold text-slate-900">{investor.revenueGrowth.toLocaleString()}</p></div>
          </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-slate-900">Recent Ledger Activity</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="px-2 py-2 font-semibold">Date</th>
                <th className="px-2 py-2 font-semibold">Type</th>
                <th className="px-2 py-2 font-semibold">Category</th>
                <th className="px-2 py-2 font-semibold">Amount</th>
                <th className="px-2 py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((entry) => (
                <tr key={entry.id} className="border-b border-slate-100 last:border-b-0">
                  <td className="px-2 py-2 text-slate-600">{entry.transactionDate.slice(0, 10)}</td>
                  <td className="px-2 py-2 capitalize text-slate-700">{entry.type}</td>
                  <td className="px-2 py-2 text-slate-700">{entry.category}</td>
                  <td className="px-2 py-2 font-semibold text-slate-900">{entry.amount.toLocaleString()} {entry.currency}</td>
                  <td className="px-2 py-2 text-slate-600">{entry.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {recent.length === 0 ? <p className="mt-2 text-sm text-slate-500">No ledger entries available.</p> : null}
        </div>
      </div>
    </div>
  );
}
