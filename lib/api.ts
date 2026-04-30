import type { WCProduct, WCOrder, WCCustomer, SiteSettings, WPPost } from './types';

const WP_API_URL = process.env.NEXT_PUBLIC_WP_API_URL || 'https://central.prag.global/wp-json';

function wcBase() { return `${WP_API_URL}/wc/v3`; }
function wpBase() { return `${WP_API_URL}/wp/v2`; }
function auth() { return `consumer_key=${process.env.WC_CONSUMER_KEY}&consumer_secret=${process.env.WC_CONSUMER_SECRET}`; }

async function wcFetch<T>(path: string, fallback: T): Promise<T> {
  try {
    const sep = path.includes('?') ? '&' : '?';
    const res = await fetch(`${wcBase()}${path}${sep}${auth()}`, { next: { revalidate: 30 } });
    if (!res.ok) return fallback;
    return await res.json();
  } catch { return fallback; }
}

async function wcFetchWithTotal<T>(path: string): Promise<{ data: T[]; total: number }> {
  try {
    const sep = path.includes('?') ? '&' : '?';
    const res = await fetch(`${wcBase()}${path}${sep}${auth()}`, { next: { revalidate: 30 } });
    if (!res.ok) return { data: [], total: 0 };
    return { data: await res.json(), total: Number(res.headers.get('X-WP-Total') ?? 0) };
  } catch { return { data: [], total: 0 }; }
}

// ── Dashboard ──────────────────────────────────────────────
export async function getDashboardStats() {
  const [recentOrders, customersRes, revenueRes, ordersCountRes] = await Promise.all([
    wcFetch<WCOrder[]>('/orders?per_page=8&status=any', []),
    fetch(`${wcBase()}/customers?per_page=1&${auth()}`, { next: { revalidate: 30 } }),
    fetch(`${wcBase()}/reports/sales?${auth()}`, { next: { revalidate: 30 } }),
    fetch(`${wcBase()}/orders?per_page=1&status=any&${auth()}`, { next: { revalidate: 30 } }),
  ]);

  const totalCustomers = Number(customersRes.headers?.get('X-WP-Total') ?? 0);
  const totalOrders = Number(ordersCountRes.headers?.get('X-WP-Total') ?? 0);
  const revenueData = revenueRes.ok ? await revenueRes.json() : null;
  const totalRevenue = Number(revenueData?.total_sales ?? 0);
  const pendingOrders = recentOrders.filter(o => ['pending', 'processing'].includes(o.status)).length;

  return { totalRevenue, totalOrders, totalCustomers, pendingOrders, recentOrders };
}

// ── Products ───────────────────────────────────────────────
export async function getProducts(page = 1, search = '', status = 'any') {
  const qs = new URLSearchParams({ per_page: '20', page: String(page), ...(search && { search }), ...(status !== 'any' && { status }) });
  return wcFetchWithTotal<WCProduct>(`/products?${qs}`);
}

export async function updateProduct(id: number, data: Partial<WCProduct>) {
  const res = await fetch(`${wcBase()}/products/${id}?${auth()}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    cache: 'no-store',
  });
  return res.ok;
}

// ── Orders ─────────────────────────────────────────────────
export async function getOrders(page = 1, status = 'any', search = '') {
  const qs = new URLSearchParams({ per_page: '20', page: String(page), status, ...(search && { search }) });
  return wcFetchWithTotal<WCOrder>(`/orders?${qs}`);
}

export async function updateOrderStatus(id: number, status: string) {
  const res = await fetch(`${wcBase()}/orders/${id}?${auth()}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
    cache: 'no-store',
  });
  return res.ok;
}

// ── Customers ──────────────────────────────────────────────
export async function getCustomers(page = 1, search = '') {
  const qs = new URLSearchParams({ per_page: '20', page: String(page), ...(search && { search }) });
  return wcFetchWithTotal<WCCustomer>(`/customers?${qs}`);
}

// ── Site Settings ──────────────────────────────────────────
export async function getSiteSettings(): Promise<SiteSettings | null> {
  try {
    const res = await fetch(`${WP_API_URL}/prag-core/v1/settings`, { next: { revalidate: 30 } });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

export async function saveSiteSettings(settings: SiteSettings, token: string): Promise<boolean> {
  try {
    const res = await fetch(`${WP_API_URL}/prag-core/v1/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(settings),
    });
    return res.ok;
  } catch { return false; }
}

// ── Blog Posts ─────────────────────────────────────────────
export async function getPosts(page = 1, search = ''): Promise<{ data: WPPost[]; total: number }> {
  try {
    const qs = new URLSearchParams({ per_page: '20', page: String(page), _embed: '1', ...(search && { search }) });
    const res = await fetch(`${wpBase()}/posts?${qs}`, { next: { revalidate: 30 } });
    if (!res.ok) return { data: [], total: 0 };
    return { data: await res.json(), total: Number(res.headers.get('X-WP-Total') ?? 0) };
  } catch { return { data: [], total: 0 }; }
}

export async function updatePostStatus(id: number, status: string, token: string): Promise<boolean> {
  try {
    const res = await fetch(`${wpBase()}/posts/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status }),
    });
    return res.ok;
  } catch { return false; }
}
