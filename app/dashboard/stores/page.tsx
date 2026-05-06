export const dynamic = 'force-dynamic';

import StoresClient from './StoresClient';

const WP = `${process.env.NEXT_PUBLIC_WP_API_URL?.replace('/wp-json', '/wp-json/wp/v2') ?? 'https://central.prag.global/wp-json/wp/v2'}`;

type StoreType = 'prag' | 'online' | 'chain';

function normalizeStoreType(value: string | undefined): StoreType {
  return value === 'online' || value === 'chain' ? value : 'prag';
}

async function getStores() {
  try {
    const res = await fetch(`${WP}/prag_store?per_page=50&_fields=id,title,meta`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json() as Array<{ id: number; title?: { rendered?: string }; meta?: Record<string, string> }>;
    return data.map((s) => ({
      id: s.id,
      name: s.title?.rendered ?? '',
      city: s.meta?.city ?? '',
      address: s.meta?.address ?? '',
      phone: s.meta?.phone ?? '',
      map_url: s.meta?.map_url ?? '',
      store_type: normalizeStoreType(s.meta?.store_type),
      logo_url: s.meta?.logo_url ?? '',
      logo_alt: s.meta?.logo_alt ?? '',
    }));
  } catch { return []; }
}

export default async function StoresPage() {
  const stores = await getStores();
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Stores</h1>
        <p className="text-gray-500 text-sm mt-1">Manage PRAG store locations shown on the website.</p>
      </div>
      <StoresClient initialStores={stores} />
    </div>
  );
}
