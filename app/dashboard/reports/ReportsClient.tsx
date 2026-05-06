'use client';

import { useState } from 'react';
import { FileText, FileSpreadsheet } from 'lucide-react';

interface DayData { date: string; total: number; orders: number }

interface Props {
  date_min: string;
  date_max: string;
  initialDays: DayData[];
}

const W = 700, H = 180;
const PL = 68, PR = 16, PT = 16, PB = 40;
const CW = W - PL - PR;
const CH = H - PT - PB;

function fmtK(val: number) {
  if (val >= 1_000_000) return `₦${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `₦${(val / 1_000).toFixed(0)}K`;
  return `₦${val.toFixed(0)}`;
}

export default function ReportsClient({ date_min, date_max, initialDays }: Props) {
  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null);
  const [hovered, setHovered] = useState<DayData | null>(null);
  const days = initialDays;

  async function exportReport(format: 'pdf' | 'excel') {
    setExporting(format);
    try {
      const res = await fetch(
        `/api/reports/export?format=${format}&date_min=${date_min}&date_max=${date_max}`
      );
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sales-report-${date_min}-to-${date_max}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }
    } finally {
      setExporting(null);
    }
  }

  const maxVal = Math.max(...days.map(d => d.total), 1);
  const n = days.length;

  function xPos(i: number) {
    return PL + (n <= 1 ? CW / 2 : (i / (n - 1)) * CW);
  }
  function yPos(val: number) {
    return PT + CH - (val / maxVal) * CH;
  }

  const linePath = days
    .map((d, i) => `${i === 0 ? 'M' : 'L'}${xPos(i).toFixed(1)},${yPos(d.total).toFixed(1)}`)
    .join(' ');

  const areaPath =
    days.length > 0
      ? `${linePath} L${xPos(days.length - 1).toFixed(1)},${(PT + CH).toFixed(1)} L${xPos(0).toFixed(1)},${(PT + CH).toFixed(1)} Z`
      : '';

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => ({ y: PT + CH - t * CH, val: maxVal * t }));
  const xLabelStep = Math.max(1, Math.ceil(n / 7));
  const xLabels = days
    .map((d, i) => ({ d, i }))
    .filter(({ i }) => i % xLabelStep === 0 || i === n - 1);

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-base font-semibold text-gray-900">Daily Sales Chart</h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => exportReport('pdf')}
              disabled={exporting !== null}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <FileText size={13} />
              {exporting === 'pdf' ? 'Exporting…' : 'Export PDF'}
            </button>
            <button
              type="button"
              onClick={() => exportReport('excel')}
              disabled={exporting !== null}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <FileSpreadsheet size={13} />
              {exporting === 'excel' ? 'Exporting…' : 'Export Excel'}
            </button>
          </div>
        </div>

        {days.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-sm text-gray-400">
            No order data for this period.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="w-full"
              style={{ minWidth: 320 }}
              aria-label="Daily sales chart"
            >
              {/* Grid lines + Y labels */}
              {yTicks.map((t, i) => (
                <g key={i}>
                  <line x1={PL} y1={t.y} x2={W - PR} y2={t.y} stroke="#f3f4f6" strokeWidth={1} />
                  <text x={PL - 6} y={t.y + 4} textAnchor="end" fontSize={10} fill="#9ca3af">
                    {fmtK(t.val)}
                  </text>
                </g>
              ))}

              {/* Area fill */}
              <path d={areaPath} fill="#0369a1" fillOpacity={0.07} />

              {/* Line */}
              <path
                d={linePath}
                fill="none"
                stroke="#0369a1"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />

              {/* Data points */}
              {days.map((d, i) => (
                <circle
                  key={i}
                  cx={xPos(i)}
                  cy={yPos(d.total)}
                  r={hovered?.date === d.date ? 5 : 3}
                  fill={hovered?.date === d.date ? '#075985' : '#0369a1'}
                  className="cursor-pointer transition-all"
                  onMouseEnter={() => setHovered(d)}
                  onMouseLeave={() => setHovered(null)}
                />
              ))}

              {/* X-axis labels */}
              {xLabels.map(({ d, i }) => (
                <text
                  key={i}
                  x={xPos(i)}
                  y={H - 6}
                  textAnchor="middle"
                  fontSize={9}
                  fill="#9ca3af"
                >
                  {d.date.slice(5)}
                </text>
              ))}
            </svg>

            {hovered ? (
              <p className="mt-1 text-center text-xs text-gray-600">
                {hovered.date} — ₦{hovered.total.toLocaleString('en-NG', { maximumFractionDigits: 0 })} ({hovered.orders}{' '}
                order{hovered.orders !== 1 ? 's' : ''})
              </p>
            ) : (
              <p className="mt-1 text-center text-xs text-gray-400">Hover over a point for details</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
