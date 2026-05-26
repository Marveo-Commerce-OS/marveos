import Link from 'next/link';
import { requireFinancePageAccess } from '../_lib/access';
import { FINANCE_CURRENCY_OPTIONS } from '@/lib/finance/options';
import { buildFundingLiabilitiesReport } from '@/lib/finance/metrics';

export const dynamic = 'force-dynamic';

type FundingSearchParams = {
  period?: string;
  currency?: string;
};

function rows(data: Record<string, number>) {
  return Object.entries(data).sort((a, b) => a[0].localeCompare(b[0]));
}

function resolvePeriodLabel(period: string): string {
  if (period === 'week') return 'Weekly';
  if (period === 'month') return 'Monthly';
  if (period === 'year') return 'Annual';
  return 'All-time';
}

export default async function MasterFinanceFundingPage({ searchParams }: { searchParams?: Promise<FundingSearchParams> }) {
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

  const funding = await buildFundingLiabilitiesReport({ period, currency });
  const periodLabel = resolvePeriodLabel(period);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Funding & Liabilities</h1>
          <p className="mt-1 text-sm text-slate-600">Track loan principal inflows, repayments, and outstanding balance separately from operations.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/master/finance?period=${period}&currency=${currency}`} className="rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700">Finance Overview</Link>
          <Link href={`/master/finance/reports?period=${period}&currency=${currency}`} className="rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700">Finance Reports</Link>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Filters</span>
          <div className="flex flex-wrap gap-2">
            {(['week', 'month', 'year', 'all'] as const).map((value) => (
              <Link
                key={value}
                href={`/master/finance/funding?period=${value}&currency=${currency}`}
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
                href={`/master/finance/funding?period=${period}&currency=${code}`}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${currency === code ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-300 bg-white text-slate-700'}`}
              >
                {code}
              </Link>
            ))}
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-500">{periodLabel} view · normalized to {funding.reportCurrency} using FX snapshot {funding.fxSnapshotVersion} at {new Date(funding.fxSnapshotAt).toLocaleString()}.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Loan Principal Inflows</p>
          <p className="mt-2 text-2xl font-bold text-emerald-900">{funding.principal.toLocaleString()} {funding.reportCurrency}</p>
        </div>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Loan Repayments</p>
          <p className="mt-2 text-2xl font-bold text-rose-900">{funding.repayments.toLocaleString()} {funding.reportCurrency}</p>
        </div>
        <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Outstanding Liability</p>
          <p className="mt-2 text-2xl font-bold text-violet-900">{funding.outstanding.toLocaleString()} {funding.reportCurrency}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-lg font-semibold text-slate-900">Principal by Period</h2>
          <div className="mt-3 space-y-2">
            {rows(funding.principalByPeriod).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span>{key}</span>
                <span className="font-semibold">{value.toLocaleString()} {funding.reportCurrency}</span>
              </div>
            ))}
            {Object.keys(funding.principalByPeriod).length === 0 ? <p className="text-sm text-slate-500">No loan principal entries for this period.</p> : null}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-lg font-semibold text-slate-900">Repayments by Period</h2>
          <div className="mt-3 space-y-2">
            {rows(funding.repaymentsByPeriod).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span>{key}</span>
                <span className="font-semibold">{value.toLocaleString()} {funding.reportCurrency}</span>
              </div>
            ))}
            {Object.keys(funding.repaymentsByPeriod).length === 0 ? <p className="text-sm text-slate-500">No loan repayment entries for this period.</p> : null}
          </div>
        </section>
      </div>
    </div>
  );
}
