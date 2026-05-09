import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { appendAuditLog } from '@/lib/adminStore';
import { getWooCommerceRestBase } from '@/src/lib/endpoints';

const WC = getWooCommerceRestBase();
const AUTH = `consumer_key=${process.env.WOOCOMMERCE_CONSUMER_KEY ?? ''}&consumer_secret=${process.env.WOOCOMMERCE_CONSUMER_SECRET ?? ''}`;

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!WC) return NextResponse.json({ error: 'WooCommerce API URL is not configured' }, { status: 503 });

  const res = await fetch(`${WC}/products/categories?per_page=100&${AUTH}`, { cache: 'no-store' });
  if (!res.ok) return NextResponse.json({ error: 'Failed to load categories' }, { status: res.status });
  return NextResponse.json(await res.json());
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!WC) return NextResponse.json({ error: 'WooCommerce API URL is not configured' }, { status: 503 });

  const body = await req.json();
  const res = await fetch(`${WC}/products/categories?${AUTH}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
    body: JSON.stringify({ name: body.name, slug: body.slug || undefined }),
  });

  if (!res.ok) return NextResponse.json({ error: 'Failed to create category' }, { status: res.status });

  const created = await res.json();
  await appendAuditLog({
    actorEmail: session.user?.user_email ?? 'unknown',
    action: 'category.created',
    target: `category:${created.id}`,
    details: `Created category ${created.name}`,
  });

  return NextResponse.json(created);
}
