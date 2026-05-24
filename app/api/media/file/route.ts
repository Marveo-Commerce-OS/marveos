import { NextRequest, NextResponse } from 'next/server';
import { get } from '@vercel/blob';
import { getSession } from '@/lib/auth';
import { readAdminStore } from '@/lib/adminStore';

function extractStoredPathname(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('uploads/')) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed, 'http://localhost');
    const proxiedPathname = url.searchParams.get('pathname');
    return proxiedPathname ? proxiedPathname.trim() : '';
  } catch {
    return '';
  }
}

async function isPublicBrandingAsset(pathname: string) {
  const store = await readAdminStore();
  const branding = store.platformSettings.branding;
  const publicAssetPaths = new Set([
    branding.logoUrl,
    branding.dashboardLogoUrl,
    branding.portalLoginLogoUrl,
    branding.faviconUrl,
    branding.footerLogoUrl,
  ].map(extractStoredPathname).filter(Boolean));

  return publicAssetPaths.has(pathname);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const pathname = String(searchParams.get('pathname') || '').trim();
  if (!pathname) return NextResponse.json({ error: 'pathname is required' }, { status: 400 });

  const session = await getSession();
  if (!session && !(await isPublicBrandingAsset(pathname))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

