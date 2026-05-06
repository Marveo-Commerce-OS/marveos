import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

const WP = `${process.env.NEXT_PUBLIC_WP_API_URL?.replace('/wp-json', '/wp-json/wp/v2') ?? 'https://central.prag.global/wp-json/wp/v2'}`;

interface StorePayload {
  id?: number;
  name?: string;
  city?: string;
  address?: string;
  phone?: string;
  map_url?: string;
  store_type?: 'prag' | 'online' | 'chain';
  logo_url?: string;
  logo_alt?: string;
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

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const data = await req.json() as StorePayload;
  const res = await fetch(`${WP}/prag_store`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
    body: JSON.stringify(storeBody(data)),
  });
  if (!res.ok) return NextResponse.json({ error: 'Failed to create store' }, { status: res.status });
  const created = await res.json();
  return NextResponse.json({
    id: created.id, name: created.title?.rendered ?? data.name,
    ...data,
  });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const data = await req.json() as StorePayload;
  const res = await fetch(`${WP}/prag_store/${data.id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
    body: JSON.stringify(storeBody(data)),
  });
  if (!res.ok) return NextResponse.json({ error: 'Failed to update store' }, { status: res.status });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const res = await fetch(`${WP}/prag_store/${id}?force=true`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${session.token}` },
  });
  if (!res.ok) return NextResponse.json({ error: 'Failed to delete' }, { status: res.status });
  return NextResponse.json({ success: true });
}
