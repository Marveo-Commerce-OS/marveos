import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { fetchPluginZip } from '@/src/lib/pluginUpdates';

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

  let upstream = await fetchPluginZip(tag);

  // Fallback to codeload archive when GitHub API zipball is rate-limited or unavailable.
  if (!upstream.ok) {
    upstream = await fetch(`https://codeload.github.com/Marveo-Commerce-OS/marveo-connector/zip/refs/tags/${encodeURIComponent(tag)}`, {
      cache: 'no-store',
      redirect: 'follow',
    });
  }

  let normalizedZip: Buffer | null = null;

  if (upstream.ok) {
    const upstreamBuffer = Buffer.from(await upstream.arrayBuffer());
    normalizedZip = normalizePluginZip(upstreamBuffer);
  } else {
    const localVersion = tag.replace(/^v/i, '');
    const localPackagePath = path.join(
      process.cwd(),
      'public',
      'plugin-packages',
      `marveo-connector-${localVersion}.zip`,
    );

    try {
      const localZip = await readFile(localPackagePath);
      normalizedZip = Buffer.from(localZip);
    } catch {
      return NextResponse.json(
        { error: `Unable to download plugin package for ${tag}. Upstream responded ${upstream.status} and local package fallback was not found.` },
        { status: 502 },
      );
    }
  }

  if (!normalizedZip) {
    return NextResponse.json({ error: 'Plugin package was empty' }, { status: 502 });
  }

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
