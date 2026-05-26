import Link from 'next/link';
import { buildOperationalFinanceReports, buildInvestorReadinessMetrics } from '@/lib/finance/metrics';
import { requireFinancePageAccess } from '../_lib/access';
import { FINANCE_CURRENCY_OPTIONS } from '@/lib/finance/options';

export const dynamic = 'force-dynamic';

function rows(data: Record<string, number>) {
  return Object.entries(data).sort((a, b) => b[1] - a[1]);
}

type FinanceReportSearchParams = {
  period?: string;
  currency?: string;
};

function resolvePeriodLabel(period: string): string {
  if (period === 'week') return 'Weekly';
  if (period === 'month') return 'Monthly';
  if (period === 'year') return 'Annual';
  return 'All-time';
}

export default async function MasterFinanceReportsPage({ searchParams }: { searchParams?: Promise<FinanceReportSearchParams> }) {
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

  const reports = await buildOperationalFinanceReports({ period, currency });
  const investor = await buildInvestorReadinessMetrics({ period, currency });
  const periodLabel = resolvePeriodLabel(period);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Finance Reports</h1>
          <p className="mt-1 text-sm text-slate-600">Operational reports for revenue and expense visibility.</p>
        </div>
        <div className="flex gap-2">
          <a href="/api/master/finance/ledger/export?format=csv" className="rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700">Export CSV</a>
          <Link href={`/master/finance?period=${period}&currency=${currency}`} className="rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700">Back to Finance</Link>
          <Link href={`/master/finance/funding?period=${period}&currency=${currency}`} className="rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700">Funding & Liabilities</Link>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Report Filters</span>
          <div className="flex flex-wrap gap-2">
            {(['week', 'month', 'year', 'all'] as const).map((value) => (
              <Link
                key={value}
                href={`/master/finance/reports?period=${value}&currency=${currency}`}
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
                href={`/master/finance/reports?period=${period}&currency=${code}`}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${currency === code ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-300 bg-white text-slate-700'}`}
              >
                {code}
              </Link>
            ))}
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-500">{periodLabel} view · normalized to {reports.reportCurrency} using platform FX rates.</p>
        <p className="mt-1 text-xs text-slate-500">FX snapshot: {reports.fxSnapshotVersion} at {new Date(reports.fxSnapshotAt).toLocaleString()}.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">MRR</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{investor.mrr.toLocaleString()} {reports.reportCurrency}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">ARR</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{investor.arr.toLocaleString()} {reports.reportCurrency}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Average Revenue / Workspace</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{investor.averageRevenuePerWorkspace.toLocaleString()} {reports.reportCurrency}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-lg font-semibold text-slate-900">Revenue by Month</h2>
          <div className="mt-3 space-y-2">
            {rows(reports.revenueByMonth).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span>{key}</span>
                <span className="font-semibold">{value.toLocaleString()} {reports.reportCurrency}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-lg font-semibold text-slate-900">Revenue by Category</h2>
          <div className="mt-3 space-y-2">
            {rows(reports.revenueByCategory).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span>{key}</span>
                <span className="font-semibold">{value.toLocaleString()} {reports.reportCurrency}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-lg font-semibold text-slate-900">Expenses by Category</h2>
          <div className="mt-3 space-y-2">
            {rows(reports.expensesByCategory).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span>{key}</span>
                <span className="font-semibold">{value.toLocaleString()} {reports.reportCurrency}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-lg font-semibold text-slate-900">Revenue by Workspace</h2>
          <div className="mt-3 space-y-2">
            {rows(reports.revenueByWorkspace).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span>{key}</span>
                <span className="font-semibold">{value.toLocaleString()} {reports.reportCurrency}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <h2 className="text-lg font-semibold text-amber-900">Loan Inflows (Non-Revenue)</h2>
        <p className="mt-1 text-xs text-amber-800">Loan inflows are tracked separately and excluded from operational revenue metrics.</p>
        <div className="mt-3 space-y-2">
          {rows(reports.loanInflowsByPeriod).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900">
              <span>{key}</span>
              <span className="font-semibold">{value.toLocaleString()} {reports.reportCurrency}</span>
            </div>
          ))}
          {Object.keys(reports.loanInflowsByPeriod).length === 0 ? <p className="text-sm text-amber-800">No loan funding entries in this period.</p> : null}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-lg font-semibold text-slate-900">Revenue by Profession</h2>
          <div className="mt-3 space-y-2">
            {rows(reports.revenueByProfession).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span>{key}</span>
                <span className="font-semibold">{value.toLocaleString()} {reports.reportCurrency}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-lg font-semibold text-slate-900">Revenue by Country</h2>
          <div className="mt-3 space-y-2">
            {rows(reports.revenueByCountry).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span>{key}</span>
                <span className="font-semibold">{value.toLocaleString()} {reports.reportCurrency}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
