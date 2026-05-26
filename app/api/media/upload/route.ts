import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { put } from '@vercel/blob';

function toSafeFilename(name: string): string {
  const raw = String(name || 'upload').trim();
  const sanitized = raw.replace(/[^\w.\-]+/g, '-');
  return sanitized.length ? sanitized : 'upload';
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'Missing file' }, { status: 400 });

  const token = (process.env.BLOB_READ_WRITE_TOKEN || '').trim();

  try {
    const key = `uploads/${Date.now()}-${toSafeFilename(file.name)}`;
    const result = await put(key, file, {
      // Our Vercel Blob store is configured as private, so access must be private here.
      access: 'private',
      contentType: file.type || 'application/octet-stream',
      ...(token ? { token } : {}),
    });

    // Return a same-origin URL that can stream private blobs via the server.
    const proxyUrl = `/api/media/file/${encodeURIComponent(result.pathname)}`;
    return NextResponse.json({ ok: true, key, blob_url: result.url, source_url: proxyUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
