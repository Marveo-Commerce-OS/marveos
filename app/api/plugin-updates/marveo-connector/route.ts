import { NextRequest, NextResponse } from 'next/server';
import { fetchLatestPluginRelease } from '@/src/lib/pluginUpdates';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const fallbackTag = process.env.MARVEO_CONNECTOR_FALLBACK_TAG || 'v1.0.16';
  const fallbackVersion = fallbackTag.replace(/^v/i, '');
  const fallbackRelease = {
    tag: fallbackTag,
    version: fallbackVersion,
    detailsUrl: `https://github.com/Marveo-Commerce-OS/marveo-connector/releases/tag/${fallbackTag}`,
    changelog: `Version ${fallbackVersion}`,
    publishedAt: '',
  };

  const release = (await fetchLatestPluginRelease()) ?? fallbackRelease;

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
