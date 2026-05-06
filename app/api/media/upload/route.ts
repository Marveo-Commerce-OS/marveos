import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

const WP = `${process.env.NEXT_PUBLIC_WP_API_URL ?? 'https://central.prag.global/wp-json'}/wp/v2`;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'Missing file' }, { status: 400 });

  const res = await fetch(`${WP}/media`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.token}`,
      'Content-Type': file.type || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${file.name}"`,
    },
    body: await file.arrayBuffer(),
  });

  if (!res.ok) {
    const detail = await res.text();
    return NextResponse.json({ error: detail || 'Upload failed' }, { status: res.status });
  }

  const media = await res.json();
  return NextResponse.json({ id: media.id, source_url: media.source_url });
}
