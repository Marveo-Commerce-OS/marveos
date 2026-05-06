import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

const WP = `${process.env.NEXT_PUBLIC_WP_API_URL?.replace('/wp-json', '/wp-json/wp/v2') ?? 'https://central.prag.global/wp-json/wp/v2'}`;

interface DocumentPayload {
  id?: number;
  title?: string;
  file_url?: string;
  file_type?: string;
  file_size?: string;
  pages?: string;
  product_id?: number | string;
}

function docBody(data: DocumentPayload) {
  return {
    title: data.title,
    status: 'publish',
    meta: {
      file_url: data.file_url ?? '',
      file_type: data.file_type ?? 'pdf',
      file_size: data.file_size ?? '',
      pages: data.pages ?? '',
      product_id: Number(data.product_id) || 0,
    },
  };
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const data = (await req.json()) as DocumentPayload;
  const res = await fetch(`${WP}/prag_document`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
    body: JSON.stringify(docBody(data)),
  });
  if (!res.ok) return NextResponse.json({ error: 'Failed to create document' }, { status: res.status });
  const created = await res.json();
  return NextResponse.json({ id: created.id, ...data });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const data = (await req.json()) as DocumentPayload;
  const res = await fetch(`${WP}/prag_document/${data.id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
    body: JSON.stringify(docBody(data)),
  });
  if (!res.ok) return NextResponse.json({ error: 'Failed to update document' }, { status: res.status });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const res = await fetch(`${WP}/prag_document/${id}?force=true`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${session.token}` },
  });
  if (!res.ok) return NextResponse.json({ error: 'Failed to delete' }, { status: res.status });
  return NextResponse.json({ success: true });
}
