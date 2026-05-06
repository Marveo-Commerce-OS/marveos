export const dynamic = 'force-dynamic';

import { getDashboardStats } from '@/lib/api';
import { TrendingUp, ShoppingBag, Users, Clock } from 'lucide-react';
import Link from 'next/link';

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-green-100 text-green-700',
  processing: 'bg-blue-100 text-blue-700',
  pending: 'bg-yellow-100 text-yellow-700',
  cancelled: 'bg-red-100 text-red-700',
  refunded: 'bg-gray-100 text-gray-600',
  'on-hold': 'bg-orange-100 text-orange-700',
};

export default async function DashboardPage() {
  const stats = await getDashboardStats();

  const cards = [
    { label: 'Total Revenue', value: `₦${stats.totalRevenue.toLocaleString('en-NG')}`, icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Total Orders', value: stats.totalOrders.toLocaleString(), icon: ShoppingBag, color: 'text-sky-600', bg: 'bg-sky-50' },
    { label: 'Customers', value: stats.totalCustomers.toLocaleString(), icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Pending Orders', value: stats.pendingOrders.toLocaleString(), icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Live data from WooCommerce</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {cards.map((c) => (
          <div key={c.label} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{c.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{c.value}</p>
              </div>
              <div className={`${c.bg} ${c.color} p-3 rounded-xl`}><c.icon size={20} /></div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <h2 className="font-bold text-gray-900">Recent Orders</h2>
          <Link href="/dashboard/orders" className="text-sm text-sky-700 hover:underline">View all →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>{['Order', 'Customer', 'Status', 'Total', 'Date'].map(h => (
                <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {stats.recentOrders.length === 0
                ? <tr><td colSpan={5} className="px-6 py-10 text-center text-gray-400">No orders yet</td></tr>
                : stats.recentOrders.map((o) => (
                  <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-sky-700">
                      <Link href={`/dashboard/orders/${o.id}`} className="hover:underline">#{o.id}</Link>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{o.billing.first_name} {o.billing.last_name}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[o.status] ?? 'bg-gray-100 text-gray-600'}`}>{o.status}</span>
                    </td>
                    <td className="px-6 py-4 font-medium">₦{Number(o.total).toLocaleString('en-NG')}</td>
                    <td className="px-6 py-4 text-gray-500">{new Date(o.date_created).toLocaleDateString('en-GB')}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
