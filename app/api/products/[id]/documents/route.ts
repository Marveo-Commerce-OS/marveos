import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { appendAuditLog } from '@/lib/adminStore';

const WP = `${process.env.NEXT_PUBLIC_WP_API_URL?.replace('/wp-json', '/wp-json/wp/v2') ?? 'https://central.prag.global/wp-json/wp/v2'}`;

interface RawDoc {
  id: number;
  title?: { rendered?: string };
  meta?: {
    file_url?: string;
    file_type?: string;
    file_size?: string;
    pages?: string;
    product_id?: string | number;
    media_id?: number;
  };
}

function mapDoc(doc: RawDoc) {
  return {
    id: doc.id,
    title: doc.title?.rendered ?? '',
    file_url: doc.meta?.file_url ?? '',
    file_type: doc.meta?.file_type ?? '',
    file_size: doc.meta?.file_size ?? '',
    pages: doc.meta?.pages ?? '',
    product_id: doc.meta?.product_id ?? '',
    media_id: doc.meta?.media_id ?? 0,
  };
}

export async function GET(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const res = await fetch(`${WP}/prag_document?per_page=100&_fields=id,title,meta`, {
    headers: { Authorization: `Bearer ${session.token}` },
    cache: 'no-store',
  });

  if (!res.ok) return NextResponse.json({ error: 'Failed to load docs' }, { status: res.status });
  const allDocs = (await res.json()) as RawDoc[];
  const filtered = allDocs.filter((d) => String(d.meta?.product_id ?? '') === String(id)).map(mapDoc);
  return NextResponse.json(filtered);
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const formData = await req.formData();
  const title = String(formData.get('title') ?? '').trim();
  const file = formData.get('file');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 });
  }

  const uploadRes = await fetch(`${WP}/media`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.token}`,
      'Content-Type': file.type || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${file.name}"`,
    },
    body: await file.arrayBuffer(),
  });

  if (!uploadRes.ok) {
    const detail = await uploadRes.text();
    return NextResponse.json({ error: detail || 'Media upload failed' }, { status: uploadRes.status });
  }

  const media = await uploadRes.json();
  const ext = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() ?? '' : '';
  const sizeMb = (file.size / (1024 * 1024)).toFixed(2);

  const docRes = await fetch(`${WP}/prag_document`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: title || file.name,
      status: 'publish',
      meta: {
        file_url: media.source_url,
        file_type: ext || 'file',
        file_size: `${sizeMb} MB`,
        pages: '',
        product_id: Number(id),
        media_id: media.id,
      },
    }),
  });

  if (!docRes.ok) {
    const detail = await docRes.text();
    return NextResponse.json({ error: detail || 'Failed to create document' }, { status: docRes.status });
  }

  const doc = await docRes.json();
  await appendAuditLog({
    actorEmail: session.user?.user_email ?? 'unknown',
    action: 'product.document.uploaded',
    target: `product:${id}`,
    details: `Uploaded ${file.name}`,
  });

  return NextResponse.json(mapDoc(doc));
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const docId = req.nextUrl.searchParams.get('docId');
  const mediaId = req.nextUrl.searchParams.get('mediaId');

  if (!docId) return NextResponse.json({ error: 'Missing docId' }, { status: 400 });

  const docRes = await fetch(`${WP}/prag_document/${docId}?force=true`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${session.token}` },
  });

  if (!docRes.ok) {
    return NextResponse.json({ error: 'Failed to delete document' }, { status: docRes.status });
  }

  if (mediaId) {
    await fetch(`${WP}/media/${mediaId}?force=true`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session.token}` },
    });
  }

  await appendAuditLog({
    actorEmail: session.user?.user_email ?? 'unknown',
    action: 'product.document.deleted',
    target: `product:${id}`,
    details: `Deleted document ${docId}`,
  });

  return NextResponse.json({ success: true });
}
