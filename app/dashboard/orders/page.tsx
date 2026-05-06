export const dynamic = 'force-dynamic';

import { getOrders } from '@/lib/api';
import Link from 'next/link';
import OrderStatusSelect from './OrderStatusSelect';

interface Props { searchParams: Promise<{ page?: string; status?: string; search?: string; sort?: string }> }

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-green-100 text-green-700',
  processing: 'bg-blue-100 text-blue-700',
  pending: 'bg-yellow-100 text-yellow-700',
  cancelled: 'bg-red-100 text-red-700',
  refunded: 'bg-gray-100 text-gray-600',
  'on-hold': 'bg-orange-100 text-orange-700',
};

const STATUSES = ['any', 'pending', 'processing', 'on-hold', 'completed', 'cancelled', 'refunded'];

const STATUS_LABELS: Record<string, string> = {
  any: 'All Status',
  pending: 'Pending',
  processing: 'Shipping',
  'on-hold': 'On Hold',
  completed: 'Completed',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

const SORT_LABELS: Record<string, string> = {
  newest: 'Newest first',
  oldest: 'Oldest first',
};

function pageHref(page: number, params: { status?: string; search?: string; sort?: string }) {
  const qs = new URLSearchParams();
  qs.set('page', String(page));
  if (params.status) qs.set('status', params.status);
  if (params.search) qs.set('search', params.search);
  if (params.sort) qs.set('sort', params.sort);
  return `?${qs.toString()}`;
}

export default async function OrdersPage({ searchParams }: Props) {
  const sp = await searchParams;
  const page = Number(sp.page ?? 1);
  const sort = sp.sort === 'oldest' ? 'oldest' : 'newest';
  const order = sort === 'oldest' ? 'asc' : 'desc';
  const { data: orders, total } = await getOrders(page, sp.status ?? 'any', sp.search ?? '', order);
  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
        <p className="text-gray-500 text-sm mt-1">{total} total orders from WooCommerce</p>
      </div>

      <form className="flex flex-col md:flex-row gap-3">
        <input name="search" defaultValue={sp.search} placeholder="Search by customer..."
          className="h-10 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 w-full md:w-64" />
        <select name="status" defaultValue={sp.status ?? 'any'}
          className="h-10 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 w-full md:w-auto">
          {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s] ?? s}</option>)}
        </select>
        <select name="sort" defaultValue={sort}
          className="h-10 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 w-full md:w-auto">
          {Object.entries(SORT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <button type="submit" className="h-10 px-5 bg-sky-700 text-white rounded-xl text-sm font-medium hover:bg-sky-800 transition-colors w-full md:w-auto">Filter</button>
      </form>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>{['Order', 'Customer', 'Items', 'Status', 'Total', 'Payment', 'Date', 'Update'].map(h => (
                <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {orders.length === 0
                ? <tr><td colSpan={8} className="px-6 py-10 text-center text-gray-400">No orders found</td></tr>
                : orders.map((o) => (
                  <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4 font-medium text-sky-700">
                      <Link href={`/dashboard/orders/${o.id}`} className="hover:underline">#{o.id}</Link>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-medium text-gray-900">{o.billing.first_name} {o.billing.last_name}</p>
                      <p className="text-xs text-gray-400">{o.billing.email}</p>
                    </td>
                    <td className="px-5 py-4 text-gray-600">{o.line_items.length}</td>
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[o.status] ?? 'bg-gray-100 text-gray-600'}`}>{STATUS_LABELS[o.status] ?? o.status}</span>
                    </td>
                    <td className="px-5 py-4 font-medium text-gray-900">₦{Number(o.total).toLocaleString('en-NG')}</td>
                    <td className="px-5 py-4 text-gray-500 text-xs">{o.payment_method_title}</td>
                    <td className="px-5 py-4 text-gray-500 text-xs">{new Date(o.date_created).toLocaleDateString('en-GB')}</td>
                    <td className="px-5 py-4">
                      <OrderStatusSelect id={o.id} currentStatus={o.status} />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
            <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              {page > 1 && <Link href={pageHref(page - 1, sp)} className="px-4 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-50">← Prev</Link>}
              {page < totalPages && <Link href={pageHref(page + 1, sp)} className="px-4 py-2 text-sm bg-sky-700 text-white rounded-xl hover:bg-sky-800">Next →</Link>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
