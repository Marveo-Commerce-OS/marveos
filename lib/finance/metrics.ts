import { listLedgerEntries } from '@/lib/finance/ledger';
import { readAdminStore } from '@/lib/adminStore';
import type { ExpenseCategoryKey, FinanceLedgerEntry, IncomeCategoryKey } from '@/lib/finance/types';

type NumberMap = Record<string, number>;
export type FinancePeriod = 'week' | 'month' | 'year' | 'all';

type MetricBuildOptions = {
  period?: FinancePeriod;
  currency?: string;
};

type MetricContext = {
  period: FinancePeriod;
  reportCurrency: string;
  rateToUsd: Record<string, number>;
  fxSnapshotAt: string;
  fxSnapshotVersion: string;
};

function monthKey(value: string): string {
  return String(value || '').slice(0, 7);
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function currentWeek(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const start = Date.UTC(year, 0, 1);
  const dayOfYear = Math.floor((Date.UTC(year, now.getUTCMonth(), now.getUTCDate()) - start) / 86400000) + 1;
  const week = Math.ceil(dayOfYear / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

function weekKey(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'unknown';
  const year = date.getUTCFullYear();
  const start = Date.UTC(year, 0, 1);
  const dayOfYear = Math.floor((Date.UTC(year, date.getUTCMonth(), date.getUTCDate()) - start) / 86400000) + 1;
  const week = Math.ceil(dayOfYear / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

function yearKey(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'unknown';
  return String(date.getUTCFullYear());
}

function normalizePeriod(value: unknown): FinancePeriod {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'week' || raw === 'month' || raw === 'year' || raw === 'all') return raw;
  return 'month';
}

function daysForPeriod(period: FinancePeriod): number {
  if (period === 'week') return 7;
  if (period === 'month') return 30;
  if (period === 'year') return 365;
  return Number.POSITIVE_INFINITY;
}

function withinPeriod(entry: FinanceLedgerEntry, period: FinancePeriod): boolean {
  if (period === 'all') return true;
  const ts = Date.parse(entry.transactionDate);
  if (!Number.isFinite(ts)) return false;
  const ageMs = Date.now() - ts;
  const windowMs = daysForPeriod(period) * 24 * 60 * 60 * 1000;
  return ageMs <= windowMs;
}

function resolveRateTable(input: unknown): Record<string, number> {
  const raw = input && typeof input === 'object' ? (input as Record<string, number>) : {};
  const map: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw)) {
    const normalized = String(key || '').trim().toUpperCase();
    const num = Number(value);
    if (!normalized) continue;
    map[normalized] = Number.isFinite(num) && num > 0 ? num : 1;
  }
  if (!map.USD) map.USD = 1;
  return map;
}

function toReportCurrency(amount: number, entryCurrency: string, context: MetricContext): number {
  const from = String(entryCurrency || '').trim().toUpperCase();
  const to = String(context.reportCurrency || 'USD').trim().toUpperCase();
  const fromRate = context.rateToUsd[from] || 1;
  const toRate = context.rateToUsd[to] || 1;
  const usd = Number(amount || 0) / fromRate;
  return Number((usd * toRate).toFixed(2));
}

function sumAmountConverted(entries: FinanceLedgerEntry[], context: MetricContext): number {
  return Number(
    entries
      .reduce((acc, entry) => acc + toReportCurrency(Number(entry.amount || 0), entry.currency, context), 0)
      .toFixed(2),
  );
}

function byKeyConverted(
  entries: FinanceLedgerEntry[],
  keyResolver: (entry: FinanceLedgerEntry) => string,
  context: MetricContext,
): NumberMap {
  return entries.reduce<NumberMap>((acc, entry) => {
    const key = keyResolver(entry) || 'unknown';
    const converted = toReportCurrency(Number(entry.amount || 0), entry.currency, context);
    acc[key] = Number(((acc[key] || 0) + converted).toFixed(2));
    return acc;
  }, {});
}

function timelineKeyForPeriod(entry: FinanceLedgerEntry, period: FinancePeriod): string {
  if (period === 'year') return yearKey(entry.transactionDate);
  if (period === 'week') return weekKey(entry.transactionDate);
  return monthKey(entry.transactionDate);
}

function operationalRevenueEntries(entries: FinanceLedgerEntry[]): FinanceLedgerEntry[] {
  return entries.filter((entry) => entry.category !== 'loan_funding');
}

function loanFundingEntries(entries: FinanceLedgerEntry[]): FinanceLedgerEntry[] {
  return entries.filter((entry) => entry.category === 'loan_funding');
}

async function resolveMetricContext(options?: MetricBuildOptions): Promise<MetricContext> {
  const store = await readAdminStore();
  const policy = store.platformSettings.billingCurrencyPolicy;
  const reportCurrency = String(options?.currency || policy.basePricingCurrency || 'USD').trim().toUpperCase();
  const rateToUsd = resolveRateTable(policy.fxRates);
  const fxSnapshotVersion = Object.entries(rateToUsd)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, rate]) => `${code}:${rate}`)
    .join('|');

  return {
    period: normalizePeriod(options?.period),
    reportCurrency,
    rateToUsd,
    fxSnapshotAt: new Date().toISOString(),
    fxSnapshotVersion,
  };
}

function paidIncomeEntries(entries: FinanceLedgerEntry[]): FinanceLedgerEntry[] {
  return entries.filter((entry) => entry.type === 'income' && entry.status === 'paid');
}

function expensePaidOrApprovedEntries(entries: FinanceLedgerEntry[]): FinanceLedgerEntry[] {
  return entries.filter((entry) => entry.type === 'expense' && (entry.status === 'paid' || entry.status === 'approved'));
}

export async function buildFinanceDashboardMetrics(options?: MetricBuildOptions) {
  const context = await resolveMetricContext(options);
  const ledger = await listLedgerEntries();
  const paidIncome = operationalRevenueEntries(paidIncomeEntries(ledger));
  const loanInflows = loanFundingEntries(paidIncomeEntries(ledger));
  const expenses = expensePaidOrApprovedEntries(ledger);
  const filteredIncome = paidIncome.filter((entry) => withinPeriod(entry, context.period));
  const filteredExpenses = expenses.filter((entry) => withinPeriod(entry, context.period));
  const filteredLoans = loanInflows.filter((entry) => withinPeriod(entry, context.period));

  const monthly = currentMonth();
  const monthlyRevenue = filteredIncome.filter((entry) => monthKey(entry.transactionDate) === monthly);
  const monthlyExpenses = expenses.filter((entry) => monthKey(entry.transactionDate) === monthly);

  const pendingPayments = ledger.filter((entry) => entry.type === 'income' && entry.status === 'pending' && withinPeriod(entry, context.period));
  const refunds = ledger.filter((entry) => entry.type === 'income' && entry.status === 'refunded' && withinPeriod(entry, context.period));

  const activeSubscriptionsRevenue = filteredIncome
    .filter((entry) => entry.category === 'subscriptions')
    .filter((entry) => monthKey(entry.transactionDate) === monthly);

  const monthlyWindowRevenue = context.period === 'month'
    ? monthlyRevenue
    : filteredIncome;

  const monthlyWindowExpenses = context.period === 'month'
    ? monthlyExpenses
    : filteredExpenses;

  return {
    totalRevenue: sumAmountConverted(filteredIncome, context),
    monthlyRevenue: sumAmountConverted(monthlyWindowRevenue, context),
    monthlyExpenses: sumAmountConverted(monthlyWindowExpenses, context),
    netPosition: Number((sumAmountConverted(monthlyWindowRevenue, context) - sumAmountConverted(monthlyWindowExpenses, context)).toFixed(2)),
    activeSubscriptionsRevenue: sumAmountConverted(activeSubscriptionsRevenue, context),
    pendingPayments: sumAmountConverted(pendingPayments, context),
    refunds: sumAmountConverted(refunds, context),
    loanInflows: sumAmountConverted(filteredLoans, context),
    reportCurrency: context.reportCurrency,
    period: context.period,
    fxSnapshotAt: context.fxSnapshotAt,
    fxSnapshotVersion: context.fxSnapshotVersion,
    revenueByCategory: byKeyConverted(filteredIncome, (entry) => entry.category as IncomeCategoryKey, context),
  };
}

export async function buildOperationalFinanceReports(options?: MetricBuildOptions) {
  const context = await resolveMetricContext(options);
  const ledger = await listLedgerEntries();
  const paidIncome = operationalRevenueEntries(paidIncomeEntries(ledger)).filter((entry) => withinPeriod(entry, context.period));
  const expenses = expensePaidOrApprovedEntries(ledger).filter((entry) => withinPeriod(entry, context.period));
  const loanInflows = loanFundingEntries(paidIncomeEntries(ledger)).filter((entry) => withinPeriod(entry, context.period));

  const revenueByMonth = byKeyConverted(paidIncome, (entry) => timelineKeyForPeriod(entry, context.period), context);
  const revenueByCategory = byKeyConverted(paidIncome, (entry) => entry.category as IncomeCategoryKey, context);
  const expensesByCategory = byKeyConverted(expenses, (entry) => entry.category as ExpenseCategoryKey, context);
  const revenueByWorkspace = byKeyConverted(paidIncome, (entry) => entry.workspaceId || 'unassigned', context);
  const loanInflowsByPeriod = byKeyConverted(loanInflows, (entry) => timelineKeyForPeriod(entry, context.period), context);

  const revenueByProfession = byKeyConverted(paidIncome, (entry) => {
    const source = String(entry.source || '').toLowerCase();
    const match = source.match(/profession:([a-z0-9_-]+)/i);
    return match?.[1] || 'unknown';
  }, context);

  const revenueByCountry = byKeyConverted(paidIncome, (entry) => {
    const source = String(entry.source || '').toLowerCase();
    const match = source.match(/country:([a-z]{2})/i);
    return match?.[1]?.toUpperCase() || 'unknown';
  }, context);

  return {
    revenueByMonth,
    revenueByCategory,
    expensesByCategory,
    revenueByWorkspace,
    revenueByProfession,
    revenueByCountry,
    loanInflowsByPeriod,
    reportCurrency: context.reportCurrency,
    period: context.period,
    fxSnapshotAt: context.fxSnapshotAt,
    fxSnapshotVersion: context.fxSnapshotVersion,
  };
}

export async function buildInvestorReadinessMetrics(options?: MetricBuildOptions) {
  const context = await resolveMetricContext(options);
  const ledger = await listLedgerEntries();
  const paidIncome = operationalRevenueEntries(paidIncomeEntries(ledger)).filter((entry) => withinPeriod(entry, context.period));
  const expenses = expensePaidOrApprovedEntries(ledger).filter((entry) => withinPeriod(entry, context.period));

  const revenueByMonth = byKeyConverted(paidIncome, (entry) => monthKey(entry.transactionDate), context);
  const sortedMonths = Object.keys(revenueByMonth).sort();
  const latestMonth = sortedMonths[sortedMonths.length - 1] || currentMonth();
  const previousMonth = sortedMonths[sortedMonths.length - 2] || latestMonth;

  const mrr = Number(revenueByMonth[latestMonth] || 0);
  const arr = Number((mrr * 12).toFixed(2));

  const expenseByMonth = byKeyConverted(expenses, (entry) => monthKey(entry.transactionDate), context);
  const burnRate = Number(expenseByMonth[latestMonth] || 0);

  const previousRevenue = Number(revenueByMonth[previousMonth] || 0);
  const revenueGrowth = previousRevenue > 0
    ? Number((((mrr - previousRevenue) / previousRevenue) * 100).toFixed(2))
    : 0;

  const workspaceRevenue = byKeyConverted(paidIncome, (entry) => entry.workspaceId || 'unassigned', context);
  const workspaceKeys = Object.keys(workspaceRevenue).filter((key) => key !== 'unassigned');
  const averageRevenuePerWorkspace = workspaceKeys.length > 0
    ? Number((sumAmountConverted(paidIncome, context) / workspaceKeys.length).toFixed(2))
    : 0;

  const revenueByProfession = byKeyConverted(paidIncome, (entry) => {
    const source = String(entry.source || '').toLowerCase();
    const match = source.match(/profession:([a-z0-9_-]+)/i);
    return match?.[1] || 'unknown';
  }, context);

  return {
    mrr,
    arr,
    burnRate,
    revenueGrowth,
    averageRevenuePerWorkspace,
    revenueByProfession,
    reportCurrency: context.reportCurrency,
    period: context.period,
    currentWeekKey: currentWeek(),
    fxSnapshotAt: context.fxSnapshotAt,
    fxSnapshotVersion: context.fxSnapshotVersion,
  };
}

export async function buildFundingLiabilitiesReport(options?: MetricBuildOptions) {
  const context = await resolveMetricContext(options);
  const ledger = await listLedgerEntries();

  const paidIncome = paidIncomeEntries(ledger).filter((entry) => withinPeriod(entry, context.period));
  const expenseEntries = expensePaidOrApprovedEntries(ledger).filter((entry) => withinPeriod(entry, context.period));

  const loanPrincipalEntries = paidIncome.filter((entry) => entry.category === 'loan_funding');
  const repaymentEntries = expenseEntries.filter((entry) => entry.category === 'loan_repayments');

  const principal = sumAmountConverted(loanPrincipalEntries, context);
  const repayments = sumAmountConverted(repaymentEntries, context);
  const outstanding = Number((principal - repayments).toFixed(2));

  const principalByPeriod = byKeyConverted(loanPrincipalEntries, (entry) => timelineKeyForPeriod(entry, context.period), context);
  const repaymentsByPeriod = byKeyConverted(repaymentEntries, (entry) => timelineKeyForPeriod(entry, context.period), context);

  return {
    principal,
    repayments,
    outstanding,
    principalByPeriod,
    repaymentsByPeriod,
    reportCurrency: context.reportCurrency,
    period: context.period,
    fxSnapshotAt: context.fxSnapshotAt,
    fxSnapshotVersion: context.fxSnapshotVersion,
  };
}
