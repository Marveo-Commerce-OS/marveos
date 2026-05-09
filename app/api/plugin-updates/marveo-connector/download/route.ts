import { NextRequest, NextResponse } from 'next/server';
import AdmZip from 'adm-zip';
import { fetchPluginZip, pluginUpdateToken } from '@/src/lib/pluginUpdates';

export const dynamic = 'force-dynamic';

const PLUGIN_ROOT = 'marveo-connector/';

function normalizePluginZip(zipBuffer: Buffer): Buffer {
  const inputZip = new AdmZip(zipBuffer);
  const outputZip = new AdmZip();

  for (const entry of inputZip.getEntries()) {
    if (entry.isDirectory) {
      continue;
    }

    const segments = entry.entryName.split('/').filter(Boolean);
    if (segments.length <= 1) {
      continue;
    }

    const normalizedPath = `${PLUGIN_ROOT}${segments.slice(1).join('/')}`;
    outputZip.addFile(normalizedPath, entry.getData());
  }

  return outputZip.toBuffer();
}

export async function GET(req: NextRequest) {
  const tag = req.nextUrl.searchParams.get('tag');

  if (!tag) {
    return NextResponse.json({ error: 'Missing tag' }, { status: 400 });
  }

  if (!pluginUpdateToken()) {
    return NextResponse.json({ error: 'Plugin update token is not configured' }, { status: 500 });
  }

  const upstream = await fetchPluginZip(tag);
  if (!upstream.ok) {
    return NextResponse.json({ error: 'Unable to download plugin package' }, { status: 502 });
  }

  const upstreamBuffer = Buffer.from(await upstream.arrayBuffer());
  const normalizedZip = normalizePluginZip(upstreamBuffer);

  const filename = `marveo-connector-${tag.replace(/^v/i, '')}.zip`;

  return new NextResponse(new Uint8Array(normalizedZip), {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
      'Content-Length': String(normalizedZip.length),
    },
  });
}
