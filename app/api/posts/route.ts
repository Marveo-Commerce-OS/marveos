import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { appendAuditLog } from '@/lib/adminStore';

const WP = `${process.env.NEXT_PUBLIC_WP_API_URL ?? 'https://central.prag.global/wp-json'}/wp/v2`;

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = await req.json();
  const { id } = payload;
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const postBody: Record<string, unknown> = {};
  for (const key of ['status', 'title', 'slug', 'excerpt', 'content', 'featured_media']) {
    if (payload[key] !== undefined) postBody[key] = payload[key];
  }

  if (payload.seo && typeof payload.seo === 'object') {
    postBody.meta = {
      _yoast_wpseo_title: payload.seo.title ?? '',
      _yoast_wpseo_metadesc: payload.seo.description ?? '',
      _yoast_wpseo_focuskw: payload.seo.focusKeyphrase ?? '',
    };
  }

  const res = await fetch(`${WP}/posts/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
    body: JSON.stringify(postBody),
  });

  if (!res.ok) return NextResponse.json({ error: 'WP update failed' }, { status: res.status });
  const updated = await res.json();
  await appendAuditLog({
    actorEmail: session.user?.user_email ?? 'unknown',
    action: 'post.updated',
    target: `post:${id}`,
    details: `Updated ${updated.title?.rendered ?? 'post'}`,
  });
  return NextResponse.json(updated);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const payload = await req.json();
  const postBody: Record<string, unknown> = {
    title: payload.title,
    slug: payload.slug || undefined,
    excerpt: payload.excerpt || '',
    content: payload.content || '',
    status: payload.status || 'draft',
    featured_media: payload.featured_media || 0,
  };

  if (payload.seo && typeof payload.seo === 'object') {
    postBody.meta = {
      _yoast_wpseo_title: payload.seo.title ?? '',
      _yoast_wpseo_metadesc: payload.seo.description ?? '',
      _yoast_wpseo_focuskw: payload.seo.focusKeyphrase ?? '',
    };
  }

  const res = await fetch(`${WP}/posts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
    body: JSON.stringify(postBody),
  });

  if (!res.ok) return NextResponse.json({ error: 'WP create failed' }, { status: res.status });
  const created = await res.json();
  await appendAuditLog({
    actorEmail: session.user?.user_email ?? 'unknown',
    action: 'post.created',
    target: `post:${created.id}`,
    details: `Created ${created.title?.rendered ?? 'post'}`,
  });
  return NextResponse.json(created);
}
