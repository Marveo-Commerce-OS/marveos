export const dynamic = 'force-dynamic';

import StoresClient from './StoresClient';

const WP = `${process.env.NEXT_PUBLIC_WP_API_URL?.replace('/wp-json', '/wp-json/wp/v2') ?? 'https://central.prag.global/wp-json/wp/v2'}`;

async function getStores() {
  try {
    const res = await fetch(`${WP}/prag_store?per_page=50&_fields=id,title,meta`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return data.map((s: any) => ({
      id: s.id,
      name: s.title?.rendered ?? '',
      city: s.meta?.city ?? '',
      address: s.meta?.address ?? '',
      phone: s.meta?.phone ?? '',
      map_url: s.meta?.map_url ?? '',
      store_type: s.meta?.store_type ?? 'prag',
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
