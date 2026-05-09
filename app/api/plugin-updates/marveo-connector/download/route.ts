import { NextRequest, NextResponse } from 'next/server';
import { fetchPluginZip, pluginUpdateToken } from '@/src/lib/pluginUpdates';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const tag = req.nextUrl.searchParams.get('tag');

  if (!tag) {
    return NextResponse.json({ error: 'Missing tag' }, { status: 400 });
  }

  if (!pluginUpdateToken()) {
    return NextResponse.json({ error: 'Plugin update token is not configured' }, { status: 500 });
  }

  const upstream = await fetchPluginZip(tag);
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: 'Unable to download plugin package' }, { status: 502 });
  }

  const filename = `marveo-connector-${tag.replace(/^v/i, '')}.zip`;

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': upstream.headers.get('content-type') || 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
