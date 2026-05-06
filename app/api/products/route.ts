import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { appendAuditLog } from '@/lib/adminStore';

const WC = `${process.env.NEXT_PUBLIC_WP_API_URL?.replace('/wp-json', '/wp-json/wc/v3') ?? 'https://central.prag.global/wp-json/wc/v3'}`;
const AUTH = `consumer_key=${process.env.WC_CONSUMER_KEY}&consumer_secret=${process.env.WC_CONSUMER_SECRET}`;

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, ...data } = await req.json();
  if (!id) return NextResponse.json({ error: 'Missing product id' }, { status: 400 });

  const res = await fetch(`${WC}/products/${id}?${AUTH}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
    body: JSON.stringify(data),
  });

  if (!res.ok) return NextResponse.json({ error: 'WC update failed' }, { status: res.status });
  const updated = await res.json();
  await appendAuditLog({
    actorEmail: session.user?.user_email ?? 'unknown',
    action: 'product.updated',
    target: `product:${id}`,
    details: `Updated ${updated.name ?? 'product'}`,
  });
  return NextResponse.json(updated);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const data = await req.json();
  const res = await fetch(`${WC}/products?${AUTH}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
    body: JSON.stringify(data),
  });

  if (!res.ok) return NextResponse.json({ error: 'WC create failed' }, { status: res.status });
  const created = await res.json();
  await appendAuditLog({
    actorEmail: session.user?.user_email ?? 'unknown',
    action: 'product.created',
    target: `product:${created.id}`,
    details: `Created ${created.name ?? 'product'}`,
  });

  return NextResponse.json(created);
}
