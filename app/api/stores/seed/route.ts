import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

const WP = `${process.env.NEXT_PUBLIC_WP_API_URL?.replace('/wp-json', '/wp-json/wp/v2') ?? 'https://central.prag.global/wp-json/wp/v2'}`;

type StoreType = 'prag' | 'online' | 'chain';

interface StorePayload {
  id?: number;
  name?: string;
  city?: string;
  address?: string;
  phone?: string;
  map_url?: string;
  store_type?: StoreType;
  logo_url?: string;
  logo_alt?: string;
}

const DEFAULT_STORES: StorePayload[] = [
  {
    name: 'PRAG (Obanikoro)',
    city: 'Obanikoro',
    address: '4, Obanikoro Street, Via Falemi House, Off Ikorodu Road, Lagos',
    phone: '0703 646 3977',
    map_url: 'https://maps.google.com/?q=4+Obanikoro+Street+Lagos',
    store_type: 'prag',
  },
  {
    name: 'PRAG (Port Harcourt)',
    city: 'Portharcourt',
    address: '18, Ezimgbu Link Road, GRA Phase IV, Mopol 19 Mummy-B Bypass, Port Harcourt',
    phone: '0703 549 2994',
    map_url: 'https://maps.google.com/?q=18+Ezimgbu+Link+Road+Port+Harcourt',
    store_type: 'prag',
  },
  {
    name: 'PRAG Abuja (Durumi)',
    city: 'Abuja',
    address: 'A.A IBRAHIM PLAZA, Block A, Suite 08, 12 David Ejoor, Durumi, Abuja, FCT',
    phone: '0808 101 0747',
    map_url: 'https://maps.google.com/?q=12+David+Ejoor+Durumi+Abuja',
    store_type: 'prag',
  },
  {
    name: 'Partner Abuja',
    city: 'Abuja',
    address: 'Shop 205, Block GH, Kaura Market, Durumi District, Abuja',
    phone: '07064847951',
    map_url: 'https://maps.google.com/?q=Kaura+Market+Durumi+Abuja',
    store_type: 'prag',
  },
  {
    name: 'PRAG (Lagos Island)',
    city: 'Lagos Island',
    address: 'G12, City Mall, Opposite Muson Centre, Onikan, Lagos',
    phone: '0810 400 0715',
    map_url: 'https://maps.google.com/?q=City+Mall+Onikan+Lagos',
    store_type: 'prag',
  },
  {
    name: 'PRAG (Alaba)',
    city: 'Alaba',
    address: 'Ichida Mall, Sunny Bus stop, Opposite Diamond Bank, Alaba International Market, Ojo, Alaba',
    phone: '0802 690 2296',
    map_url: 'https://maps.google.com/?q=Alaba+International+Market+Lagos',
    store_type: 'prag',
  },
  {
    name: 'Online Store 1',
    store_type: 'online',
    map_url: 'https://shop.prag.global',
    logo_url: 'https://central.prag.global/wp-content/uploads/2026/04/5ff0e6849b09a1a4eb3bdeda8471ff7fc2fd8ce3.png',
    logo_alt: 'Online Store 1',
  },
  {
    name: 'Online Store 2',
    store_type: 'online',
    map_url: 'https://shop.prag.global',
    logo_url: 'https://central.prag.global/wp-content/uploads/2026/04/bee5d02c8cf83b603f5e20ea9d3ea9af4c73da4e.png',
    logo_alt: 'Online Store 2',
  },
  {
    name: 'Chain Store 1',
    store_type: 'chain',
    map_url: 'https://shop.prag.global',
    logo_url: 'https://central.prag.global/wp-content/uploads/2026/04/10b7be4d65865dc31d780030e9229855815dc832.png',
    logo_alt: 'Chain Store 1',
  },
  {
    name: 'Chain Store 2',
    store_type: 'chain',
    map_url: 'https://shop.prag.global',
    logo_url: 'https://central.prag.global/wp-content/uploads/2026/04/34ad001c624cbf2245020be3a1641a3b6e2869c1.png',
    logo_alt: 'Chain Store 2',
  },
  {
    name: 'Chain Store 3',
    store_type: 'chain',
    map_url: 'https://shop.prag.global',
    logo_url: 'https://central.prag.global/wp-content/uploads/2026/04/80fc1fd5ec7a69f5a983d6a7bd47f293daf297b9.png',
    logo_alt: 'Chain Store 3',
  },
];

function normalizeStoreType(value: string | undefined): StoreType {
  return value === 'online' || value === 'chain' ? value : 'prag';
}

function toKey(name: string, type: StoreType) {
  return `${type}:${name.trim().toLowerCase()}`;
}

function storeBody(data: StorePayload) {
  return {
    title: data.name,
    status: 'publish',
    meta: {
      city: data.city ?? '',
      address: data.address ?? '',
      phone: data.phone ?? '',
      map_url: data.map_url ?? '',
      store_type: data.store_type ?? 'prag',
      logo_url: data.logo_url ?? '',
      logo_alt: data.logo_alt ?? '',
    },
  };
}

async function fetchStores() {
  const res = await fetch(`${WP}/prag_store?per_page=100&_fields=id,title,meta`, { cache: 'no-store' });
  if (!res.ok) return [] as Array<{ id: number; title?: { rendered?: string }; meta?: Record<string, string> }>;
  return await res.json() as Array<{ id: number; title?: { rendered?: string }; meta?: Record<string, string> }>;
}

function normalizeStores(data: Array<{ id: number; title?: { rendered?: string }; meta?: Record<string, string> }>) {
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
}

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const existing = await fetchStores();
  const existingKeys = new Set(
    existing.map((s) => toKey(s.title?.rendered ?? '', normalizeStoreType(s.meta?.store_type)))
  );

  let created = 0;
  for (const store of DEFAULT_STORES) {
    const key = toKey(store.name ?? '', store.store_type ?? 'prag');
    if (existingKeys.has(key)) continue;

    const res = await fetch(`${WP}/prag_store`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify(storeBody(store)),
    });

    if (res.ok) {
      created += 1;
      existingKeys.add(key);
    }
  }

  const refreshed = await fetchStores();
  return NextResponse.json({
    created,
    stores: normalizeStores(refreshed),
  });
}
