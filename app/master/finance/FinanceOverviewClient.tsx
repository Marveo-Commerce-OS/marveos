'use client';

import { useMemo } from 'react';

type Props = {
  revenueByCategory: Record<string, number>;
  revenueByMonth: Record<string, number>;
  reportCurrency: string;
  periodLabel: string;
};

const PIE_COLORS = ['#0f766e', '#0369a1', '#7c3aed', '#ea580c', '#16a34a', '#e11d48', '#b45309'];

function toCurrency(value: number): string {
  return Number(value || 0).toLocaleString();
}

export default function FinanceOverviewClient({ revenueByCategory, revenueByMonth, reportCurrency, periodLabel }: Props) {
  const categoryRows = useMemo(() => {
    return Object.entries(revenueByCategory)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [revenueByCategory]);

  const monthRows = useMemo(() => {
    return Object.entries(revenueByMonth)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6);
  }, [revenueByMonth]);

  const totalCategoryRevenue = categoryRows.reduce((acc, [, value]) => acc + Number(value || 0), 0);
  const maxMonthRevenue = Math.max(...monthRows.map(([, value]) => Number(value || 0)), 0);

  const pieSegments = categoryRows.map(([key, value], index) => {
    const safeValue = Number(value || 0);
    const ratio = totalCategoryRevenue > 0 ? safeValue / totalCategoryRevenue : 0;
    const start = categoryRows
      .slice(0, index)
      .reduce((acc, [, rowValue]) => acc + (totalCategoryRevenue > 0 ? Number(rowValue || 0) / totalCategoryRevenue : 0), 0);
    const end = start + ratio;

    const startAngle = start * Math.PI * 2 - Math.PI / 2;
    const endAngle = end * Math.PI * 2 - Math.PI / 2;
    const x1 = 100 + 78 * Math.cos(startAngle);
    const y1 = 100 + 78 * Math.sin(startAngle);
    const x2 = 100 + 78 * Math.cos(endAngle);
    const y2 = 100 + 78 * Math.sin(endAngle);
    const largeArc = ratio > 0.5 ? 1 : 0;

    return {
      key,
      value: safeValue,
      color: PIE_COLORS[index % PIE_COLORS.length],
      path: `M 100 100 L ${x1.toFixed(2)} ${y1.toFixed(2)} A 78 78 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`,
      ratio,
    };
  });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-slate-900">Revenue Mix (Pie)</h2>
        <p className="mt-1 text-xs text-slate-500">{periodLabel} · Reporting currency: {reportCurrency}</p>
        <div className="mt-3 grid items-center gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
          <svg viewBox="0 0 200 200" className="mx-auto h-52 w-52">
            {pieSegments.length > 0 ? (
              pieSegments.map((segment) => (
                <path key={segment.key} d={segment.path} fill={segment.color} opacity={segment.ratio > 0 ? 1 : 0} />
              ))
            ) : (
              <circle cx="100" cy="100" r="78" fill="#e2e8f0" />
            )}
            <circle cx="100" cy="100" r="42" fill="white" />
            <text x="100" y="95" textAnchor="middle" className="fill-slate-500 text-[9px] uppercase tracking-wide">
              Total
            </text>
            <text x="100" y="110" textAnchor="middle" className="fill-slate-900 text-[12px] font-semibold">
              {toCurrency(totalCategoryRevenue)}
            </text>
          </svg>

          <div className="space-y-2">
            {pieSegments.length > 0 ? (
              pieSegments.map((segment) => (
                <div key={segment.key} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                  <span className="flex items-center gap-2 text-slate-700">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: segment.color }} />
                    {segment.key}
                  </span>
                  <span className="font-semibold text-slate-900">{toCurrency(segment.value)}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">No paid revenue data yet.</p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-slate-900">Revenue by Month (Bar)</h2>
        <p className="mt-1 text-xs text-slate-500">Normalized using configured FX rates.</p>
        <div className="mt-3 space-y-3">
          {monthRows.length > 0 ? (
            monthRows.map(([month, value]) => {
              const safeValue = Number(value || 0);
              const widthPct = maxMonthRevenue > 0 ? Math.max((safeValue / maxMonthRevenue) * 100, 3) : 0;
              return (
                <div key={month}>
                  <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
                    <span>{month}</span>
                    <span className="font-semibold text-slate-900">{toCurrency(safeValue)}</span>
                  </div>
                  <div className="h-3 rounded-full bg-slate-100">
                    <div className="h-3 rounded-full bg-gradient-to-r from-sky-500 to-emerald-500" style={{ width: `${widthPct}%` }} />
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-slate-500">No monthly revenue data yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
