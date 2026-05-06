import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { appendAuditLog } from '@/lib/adminStore';

const WC = `${process.env.NEXT_PUBLIC_WP_API_URL?.replace('/wp-json', '/wp-json/wc/v3') ?? 'https://central.prag.global/wp-json/wc/v3'}`;
const AUTH = `consumer_key=${process.env.WC_CONSUMER_KEY}&consumer_secret=${process.env.WC_CONSUMER_SECRET}`;

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, status } = await req.json();
  if (!id || !status) return NextResponse.json({ error: 'Missing id or status' }, { status: 400 });

  const res = await fetch(`${WC}/orders/${id}?${AUTH}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
    body: JSON.stringify({ status }),
  });

  if (!res.ok) return NextResponse.json({ error: 'WC update failed' }, { status: res.status });
  const updated = await res.json();
  await appendAuditLog({
    actorEmail: session.user?.user_email ?? 'unknown',
    action: 'order.updated',
    target: `order:${id}`,
    details: `Status changed to ${status}`,
  });
  return NextResponse.json(updated);
}
