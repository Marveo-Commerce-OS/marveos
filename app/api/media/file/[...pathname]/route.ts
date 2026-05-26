import { NextRequest, NextResponse } from 'next/server';
import { get } from '@vercel/blob';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ pathname?: string[] }> | { pathname?: string[] } },
) {
  const resolvedParams = await Promise.resolve(context.params);
  const pathname = Array.isArray(resolvedParams.pathname)
    ? decodeURIComponent(resolvedParams.pathname.join('/')).trim()
    : '';

  if (!pathname) {
    return NextResponse.json({ error: 'pathname is required' }, { status: 400 });
  }

  const token = (process.env.BLOB_READ_WRITE_TOKEN || '').trim();
  if (!token) return NextResponse.json({ error: 'Missing BLOB_READ_WRITE_TOKEN' }, { status: 500 });

  const result = await get(pathname, { access: 'private', token });
  if (!result) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const contentType = result.headers.get('content-type') || 'application/octet-stream';
  const cacheControl = result.headers.get('cache-control') || 'private, max-age=300';

  return new NextResponse(result.stream, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': cacheControl,
    },
  });
}