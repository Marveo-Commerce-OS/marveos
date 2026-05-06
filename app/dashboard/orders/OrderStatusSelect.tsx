'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const STATUSES = ['pending', 'processing', 'on-hold', 'completed', 'cancelled', 'refunded'];

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  processing: 'Shipping',
  'on-hold': 'On Hold',
  completed: 'Completed',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

export default function OrderStatusSelect({ id, currentStatus }: { id: number; currentStatus: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setLoading(true);
    await fetch('/api/orders', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: e.target.value }),
    });
    setLoading(false);
    router.refresh();
  }

  return (
    <select defaultValue={currentStatus} onChange={handleChange} disabled={loading}
      className="h-8 px-2 rounded-lg border border-gray-200 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50 bg-white">
      {STATUSES.map(s => (
        <option key={s} value={s}>{STATUS_LABELS[s] ?? s}</option>
      ))}
    </select>
  );
}
