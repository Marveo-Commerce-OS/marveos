export const dynamic = 'force-dynamic';

import { getReportsCustomers, getReportsSales, getReportsTrend } from '@/lib/api';
import ReportsClient from './ReportsClient';

interface Props {
  searchParams: Promise<{ date_min?: string; date_max?: string }>;
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function startOfMonthISO() {
  const date = new Date();
  date.setDate(1);
  return date.toISOString().split('T')[0];
}

export default async function ReportsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const date_min = sp.date_min || startOfMonthISO();
  const date_max = sp.date_max || todayISO();

  const [salesRows, customerRows, trendRows] = await Promise.all([
    getReportsSales({ date_min, date_max }),
    getReportsCustomers({ date_min, date_max }),
    getReportsTrend({ date_min, date_max }),
  ]);

  const sales = salesRows[0] ?? { total_sales: '0', net_sales: '0', total_orders: 0, total_items: 0 };
  const customerTotal = customerRows.reduce((sum, row) => sum + Number(row.total || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-gray-500 text-sm mt-1">Revenue, orders, and customer activity for ecommerce operations.</p>
      </div>

      <form className="flex flex-col md:flex-row gap-3 items-start md:items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">From</label>
          <input type="date" name="date_min" defaultValue={date_min} className="h-10 px-3 rounded-lg border border-gray-200 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">To</label>
          <input type="date" name="date_max" defaultValue={date_max} className="h-10 px-3 rounded-lg border border-gray-200 text-sm" />
        </div>
        <button type="submit" className="h-10 px-5 bg-sky-700 text-white rounded-lg text-sm font-medium hover:bg-sky-800 transition-colors">Apply</button>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Total Sales</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">₦{Number(sales.total_sales).toLocaleString('en-NG')}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Net Sales</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">₦{Number(sales.net_sales).toLocaleString('en-NG')}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Orders</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{Number(sales.total_orders).toLocaleString()}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Customer Signups</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{customerTotal.toLocaleString()}</p>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-5">
        <h2 className="text-base font-semibold text-gray-900 mb-3">Summary</h2>
        <ul className="text-sm text-gray-700 space-y-1">
          <li>Date range: {date_min} to {date_max}</li>
          <li>Total items sold: {Number(sales.total_items).toLocaleString()}</li>
          <li>Average order value: ₦{sales.total_orders ? (Number(sales.total_sales) / Number(sales.total_orders)).toLocaleString('en-NG', { maximumFractionDigits: 0 }) : '0'}</li>
        </ul>
      </div>

      <ReportsClient date_min={date_min} date_max={date_max} initialDays={trendRows} />
    </div>
  );
}
