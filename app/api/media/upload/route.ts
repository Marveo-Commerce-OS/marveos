import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

import { getConfig } from '@/src/config/client';

const getWpApiUrl = () => {
  const config = getConfig();
  return config.wordpressApiUrl || 'https://localhost/wp-json';
};

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'Missing file' }, { status: 400 });

  const WP = `${getWpApiUrl()}/wp/v2`;
  const wpFormData = new FormData();
  wpFormData.append('file', file, file.name);

  let res = await fetch(`${WP}/media`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.token}`,
      Accept: 'application/json',
    },
    body: wpFormData,
  });

  // Some WP setups still expect raw binary uploads. Keep a fallback for those.
  if (!res.ok) {
    res = await fetch(`${WP}/media`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.token}`,
        Accept: 'application/json',
        'Content-Type': file.type || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${file.name}"`,
      },
      body: await file.arrayBuffer(),
    });
  }

  if (!res.ok) {
    const detail = await res.text();
    return NextResponse.json({ error: detail || 'Upload failed' }, { status: res.status });
  }

  const media = await res.json();
  return NextResponse.json({ id: media.id, source_url: media.source_url });
}
