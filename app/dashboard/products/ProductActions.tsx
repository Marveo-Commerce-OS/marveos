'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  id: number;
  field: 'featured' | 'status';
  value: boolean | string;
  label: string;
  toggleValue?: string;
}

export default function ProductActions({ id, field, value, label, toggleValue }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleToggle() {
    setLoading(true);
    const body = field === 'featured'
      ? { id, featured: !value }
      : { id, status: toggleValue };

    await fetch('/api/products', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setLoading(false);
    router.refresh();
  }

  if (field === 'featured') {
    return (
      <button onClick={handleToggle} disabled={loading}
        className={`w-10 h-6 rounded-full transition-colors relative ${value ? 'bg-sky-700' : 'bg-gray-200'} disabled:opacity-50`}>
        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${value ? 'left-5' : 'left-1'}`} />
      </button>
    );
  }

  return (
    <button onClick={handleToggle} disabled={loading}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
        value === 'publish'
          ? 'bg-red-50 text-red-600 hover:bg-red-100'
          : 'bg-green-50 text-green-700 hover:bg-green-100'
      }`}>
      {loading ? '...' : label}
    </button>
  );
}
