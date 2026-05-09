import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getWordPressApiBase } from '@/src/lib/endpoints';

const WP_API_URL = getWordPressApiBase();
const WC_BASE = `${WP_API_URL}/wc/v3`;

function auth() {
  return `consumer_key=${process.env.WC_CONSUMER_KEY ?? ''}&consumer_secret=${process.env.WC_CONSUMER_SECRET ?? ''}`;
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!WP_API_URL) return NextResponse.json({ error: 'WordPress API URL is not configured' }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const date_min = searchParams.get('date_min') ?? '';
  const date_max = searchParams.get('date_max') ?? '';

  const byDay = new Map<string, { total: number; orders: number }>();
  let page = 1;

  while (true) {
    const qs = new URLSearchParams({
      per_page: '100',
      page: String(page),
      status: 'any',
      ...(date_min && { after: `${date_min}T00:00:00` }),
      ...(date_max && { before: `${date_max}T23:59:59` }),
    });

    const res = await fetch(`${WC_BASE}/orders?${qs}&${auth()}`, { cache: 'no-store' });
    if (!res.ok) break;

    const orders: { date_created: string; total: string }[] = await res.json();
    if (orders.length === 0) break;

    for (const order of orders) {
      const date = order.date_created.split('T')[0];
      const existing = byDay.get(date) ?? { total: 0, orders: 0 };
      byDay.set(date, {
        total: existing.total + parseFloat(order.total || '0'),
        orders: existing.orders + 1,
      });
    }

    if (orders.length < 100) break;
    page++;
  }

  const days = Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => ({ date, ...data }));

  return NextResponse.json({ days });
}
