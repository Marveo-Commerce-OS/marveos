import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getWordPressRestBase } from '@/src/lib/endpoints';

const WP = getWordPressRestBase();
const STORE_POST_TYPE = process.env.MARVEO_STORE_POST_TYPE;

type StoreType = 'location' | 'online' | 'chain';

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
    name: 'Main Store',
    city: 'Downtown',
    address: '123 Main Street, City Center',
    phone: '+1-555-0101',
    map_url: 'https://maps.google.com/',
    store_type: 'location',
  },
  {
    name: 'North Location',
    city: 'North District',
    address: '456 North Avenue, North Side',
    phone: '+1-555-0102',
    map_url: 'https://maps.google.com/',
    store_type: 'location',
  },
  {
    name: 'South Location',
    city: 'South District',
    address: '789 South Boulevard, South Side',
    phone: '+1-555-0103',
    map_url: 'https://maps.google.com/',
    store_type: 'location',
  },
  {
    name: 'East Location',
    city: 'East District',
    address: '321 East Road, East Side',
    phone: '+1-555-0104',
    map_url: 'https://maps.google.com/',
    store_type: 'location',
  },
  {
    name: 'West Location',
    city: 'West District',
    address: '654 West Street, West Side',
    phone: '+1-555-0105',
    map_url: 'https://maps.google.com/',
    store_type: 'location',
  },
  {
    name: 'Partner Location',
    city: 'Business Park',
    address: '987 Commercial Drive, Business District',
    phone: '+1-555-0106',
    map_url: 'https://maps.google.com/',
    store_type: 'location',
  },
  {
    name: 'Online Marketplace',
    store_type: 'online',
    map_url: 'https://store.example.com',
    logo_alt: 'Online Marketplace',
  },
  {
    name: 'Partner Shop',
    store_type: 'online',
    map_url: 'https://shop.example.com',
    logo_alt: 'Partner Shop',
  },
  {
    name: 'Regional Chain A',
    store_type: 'chain',
    map_url: 'https://chain-a.example.com',
    logo_alt: 'Regional Chain A',
  },
  {
    name: 'Regional Chain B',
    store_type: 'chain',
    map_url: 'https://chain-b.example.com',
    logo_alt: 'Regional Chain B',
  },
  {
    name: 'Regional Chain C',
    store_type: 'chain',
    map_url: 'https://chain-c.example.com',
    logo_alt: 'Regional Chain C',
  },
];

function normalizeStoreType(value: string | undefined): StoreType {
  return value === 'online' || value === 'chain' ? value : 'location';
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
      store_type: data.store_type ?? 'location',
      logo_url: data.logo_url ?? '',
      logo_alt: data.logo_alt ?? '',
    },
  };
}

async function fetchStores() {
  if (!WP || !STORE_POST_TYPE) return [];
  const res = await fetch(`${WP}/${STORE_POST_TYPE}?per_page=100&_fields=id,title,meta`, { cache: 'no-store' });
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
    const key = toKey(store.name ?? '', store.store_type ?? 'location');
    if (existingKeys.has(key)) continue;

    const res = await fetch(`${WP}/${STORE_POST_TYPE}`, {
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
