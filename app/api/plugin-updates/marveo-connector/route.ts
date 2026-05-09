import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const release = {
    tag: 'v1.0.8',
    version: '1.0.8',
    detailsUrl: 'https://github.com/Marveo-Commerce-OS/marveo-connector/releases/tag/v1.0.8',
    changelog: 'Version 1.0.8 — Global deployment platform with three onboarding paths, content discovery, module system, and PRAG migration support.',
    publishedAt: '2026-05-09T00:00:00Z',
  };

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
