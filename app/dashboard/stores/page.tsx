export const dynamic = 'force-dynamic';

import StoresClient from './StoresClient';
import { getWordPressRestBase } from '@/src/lib/endpoints';

const WP = getWordPressRestBase();
const STORE_POST_TYPE = process.env.MARVEO_STORE_POST_TYPE;

type StoreType = 'location' | 'online' | 'chain';

function normalizeStoreType(value: string | undefined): StoreType {
  return value === 'online' || value === 'chain' ? value : 'location';
}

async function getStores() {
  try {
    if (!WP) return [];
    const res = await fetch(`${WP}/${STORE_POST_TYPE}?per_page=50&_fields=id,title,meta`, { cache: 'no-store' });
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
        <p className="text-gray-500 text-sm mt-1">Manage store locations shown on the website.</p>
      </div>
      <StoresClient initialStores={stores} />
    </div>
  );
}
