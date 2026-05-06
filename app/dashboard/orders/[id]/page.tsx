export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { getOrderById } from '@/lib/api';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  processing: 'Shipping',
  'on-hold': 'On Hold',
  completed: 'Completed',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

interface Props {
  params: Promise<{ id: string }>;
}

export default async function OrderDetailPage({ params }: Props) {
  const { id } = await params;
  const order = await getOrderById(Number(id));

  if (!order) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/orders" className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">
          <ChevronLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Order #{order.id}</h1>
          <p className="text-xs text-gray-500 mt-0.5">{new Date(order.date_created).toLocaleString('en-GB')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Items</h2>
            <div className="divide-y divide-gray-100">
              {order.line_items.map((item) => (
                <div key={item.id} className="py-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{item.name}</p>
                    <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                  </div>
                  <p className="text-sm font-semibold text-gray-900">₦{Number(item.total).toLocaleString('en-NG')}</p>
                </div>
              ))}
            </div>
            <div className="pt-4 border-t border-gray-100 mt-3 space-y-1 text-sm">
              <div className="flex justify-between text-gray-600"><span>Shipping</span><span>₦{Number(order.shipping_total).toLocaleString('en-NG')}</span></div>
              <div className="flex justify-between font-semibold text-gray-900"><span>Total</span><span>₦{Number(order.total).toLocaleString('en-NG')}</span></div>
            </div>
          </section>
        </div>

        <div className="space-y-5">
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-2">
            <h2 className="text-sm font-semibold text-gray-900">Order Details</h2>
            <p className="text-sm text-gray-600">Status: <span className="font-medium text-gray-900">{STATUS_LABELS[order.status] ?? order.status}</span></p>
            <p className="text-sm text-gray-600">Payment: <span className="font-medium text-gray-900">{order.payment_method_title || '—'}</span></p>
          </section>

          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-2">
            <h2 className="text-sm font-semibold text-gray-900">Billing</h2>
            <p className="text-sm text-gray-700">{order.billing.first_name} {order.billing.last_name}</p>
            <p className="text-sm text-gray-600">{order.billing.email || '—'}</p>
            <p className="text-sm text-gray-600">{order.billing.phone || '—'}</p>
            <p className="text-sm text-gray-600">{order.billing.address_1 || '—'}</p>
            <p className="text-sm text-gray-600">{[order.billing.city, order.billing.state].filter(Boolean).join(', ') || '—'}</p>
          </section>
        </div>
      </div>
    </div>
  );
}
