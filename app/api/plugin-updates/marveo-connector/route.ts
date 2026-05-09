import { NextRequest, NextResponse } from 'next/server';
import { fetchLatestPluginRelease } from '@/src/lib/pluginUpdates';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const release = await fetchLatestPluginRelease();

  if (!release) {
    return NextResponse.json({ error: 'Unable to load plugin release metadata' }, { status: 503 });
  }

  const packageUrl = new URL('/api/plugin-updates/marveo-connector/download', req.nextUrl.origin);
  packageUrl.searchParams.set('tag', release.tag);

  return NextResponse.json(
    {
      name: 'Marvéo Connector',
      slug: 'marveo-connector',
      version: release.version,
      details_url: release.detailsUrl,
      package_url: packageUrl.toString(),
      changelog: release.changelog,
      published_at: release.publishedAt,
      requires: '5.9',
      requires_php: '7.4',
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  );
}
