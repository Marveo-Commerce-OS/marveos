import type { WCProduct, WCOrder, WCCustomer, SiteSettings, WPPost } from './types';
import { getConfig } from '@/src/config/client';

const FETCH_TIMEOUT_MS = 8000;

function isDemoMode(): boolean {
  return (
    process.env.NODE_ENV !== 'production' &&
    (process.env.MARVEO_DEMO_MODE === 'true' || process.env.NEXT_PUBLIC_MARVEO_DEMO_MODE === 'true')
  );
}

function getWpApiUrl(): string {
  const config = getConfig();
  return config.wordpressApiUrl || 'https://localhost/wp-json';
}

function getWcConsumerKey(): string {
  const config = getConfig();
  return config.woocommerceConsumerKey || '';
}

function getWcConsumerSecret(): string {
  const config = getConfig();
  return config.woocommerceConsumerSecret || '';
}

function wcBase() { 
  return `${getWpApiUrl()}/wc/v3`; 
}

function wpBase() { 
  return `${getWpApiUrl()}/wp/v2`; 
}

function auth() { 
  return `consumer_key=${getWcConsumerKey()}&consumer_secret=${getWcConsumerSecret()}`; 
}

function canCallCommerceApis(): boolean {
  if (isDemoMode()) return false;
  return Boolean(getConfig().wordpressApiUrl && getWcConsumerKey() && getWcConsumerSecret());
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, retries = 1): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const mergedHeaders: Record<string, string> = {
        Connection: 'keep-alive',
        ...(init.headers as Record<string, string> ?? {}),
      };
      const res = await fetch(url, {
        ...init,
        headers: mergedHeaders,
        signal: controller.signal,
        keepalive: true,
      });
      clearTimeout(timeout);
      if (res.ok || attempt === retries) return res;
      lastError = new Error(`HTTP ${res.status}`);
    } catch (error) {
      clearTimeout(timeout);
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Fetch failed');
}

async function wcFetch<T>(path: string, fallback: T): Promise<T> {
  try {
    const sep = path.includes('?') ? '&' : '?';
    const res = await fetchWithTimeout(`${wcBase()}${path}${sep}${auth()}`, { next: { revalidate: 30 } }, 1);
    if (!res.ok) return fallback;
    return await res.json();
  } catch { return fallback; }
}

async function wcFetchWithTotal<T>(
  path: string,
  init: RequestInit = { next: { revalidate: 30 } },
): Promise<{ data: T[]; total: number }> {
  try {
    const sep = path.includes('?') ? '&' : '?';
    const res = await fetchWithTimeout(`${wcBase()}${path}${sep}${auth()}`, init, 1);
    if (!res.ok) return { data: [], total: 0 };
    return { data: await res.json(), total: Number(res.headers.get('X-WP-Total') ?? 0) };
  } catch { return { data: [], total: 0 }; }
}

// ── Dashboard ──────────────────────────────────────────────
export async function getDashboardStats() {
  if (!canCallCommerceApis()) {
    return {
      totalRevenue: 0,
      totalOrders: 0,
      totalCustomers: 0,
      pendingOrders: 0,
      recentOrders: [],
    };
  }

  try {
    const [recentOrders, customersRes, revenueRes, ordersCountRes] = await Promise.all([
      wcFetch<WCOrder[]>('/orders?per_page=8&status=any', []),
      fetchWithTimeout(`${wcBase()}/customers?per_page=1&${auth()}`, { next: { revalidate: 30 } }, 1),
      fetchWithTimeout(`${wcBase()}/reports/sales?${auth()}`, { next: { revalidate: 30 } }, 1),
      fetchWithTimeout(`${wcBase()}/orders?per_page=1&status=any&${auth()}`, { next: { revalidate: 30 } }, 1),
    ]);

    const totalCustomers = Number(customersRes.headers?.get('X-WP-Total') ?? 0);
    const totalOrders = Number(ordersCountRes.headers?.get('X-WP-Total') ?? 0);
    const revenueData = revenueRes.ok ? await revenueRes.json() : null;
    const totalRevenue = Number(revenueData?.total_sales ?? 0);
    const pendingOrders = recentOrders.filter(o => ['pending', 'processing'].includes(o.status)).length;

    return { totalRevenue, totalOrders, totalCustomers, pendingOrders, recentOrders };
  } catch {
    return {
      totalRevenue: 0,
      totalOrders: 0,
      totalCustomers: 0,
      pendingOrders: 0,
      recentOrders: [],
    };
  }
}

// ── Products ───────────────────────────────────────────────
export async function getProducts(page = 1, search = '', status = 'any') {
  const qs = new URLSearchParams({ per_page: '20', page: String(page), ...(search && { search }), ...(status !== 'any' && { status }) });
  return wcFetchWithTotal<WCProduct>(`/products?${qs}`, { cache: 'no-store' });
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

export async function createProduct(data: Record<string, unknown>) {
  const res = await fetch(`${wcBase()}/products?${auth()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    cache: 'no-store',
  });
  if (!res.ok) return null;
  return await res.json();
}

export async function getProductCategories() {
  return wcFetch<{ id: number; name: string; slug: string }[]>('/products/categories?per_page=100', []);
}

export async function createProductCategory(data: { name: string; slug?: string }) {
  const res = await fetch(`${wcBase()}/products/categories?${auth()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    cache: 'no-store',
  });
  if (!res.ok) return null;
  return await res.json();
}

// ── Orders ─────────────────────────────────────────────────
export async function getOrders(page = 1, status = 'any', search = '', order: 'asc' | 'desc' = 'desc') {
  const qs = new URLSearchParams({
    per_page: '20',
    page: String(page),
    status,
    orderby: 'date',
    order,
    ...(search && { search }),
  });
  return wcFetchWithTotal<WCOrder>(`/orders?${qs}`);
}

export async function getOrderById(id: number) {
  return wcFetch<WCOrder | null>(`/orders/${id}`, null);
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

export async function getAllCustomers(limit = 500) {
  const perPage = 100;
  const first = await wcFetchWithTotal<WCCustomer>(`/customers?per_page=${perPage}&page=1`);
  if (first.data.length === 0) return [];

  const maxPagesByLimit = Math.ceil(limit / perPage);
  const totalPages = Math.ceil(first.total / perPage);
  const pagesToLoad = Math.min(totalPages, maxPagesByLimit);

  if (pagesToLoad <= 1) return first.data.slice(0, limit);

  const rest = await Promise.all(
    Array.from({ length: pagesToLoad - 1 }, (_, idx) => idx + 2).map((page) =>
      wcFetch<WCCustomer[]>(`/customers?per_page=${perPage}&page=${page}`, [])
    )
  );

  return [...first.data, ...rest.flat()].slice(0, limit);
}

export async function getReportsSales(params: { date_min?: string; date_max?: string }) {
  const qsBase = new URLSearchParams({
    per_page: '100',
    status: 'any',
    ...(params.date_min ? { after: `${params.date_min}T00:00:00` } : {}),
    ...(params.date_max ? { before: `${params.date_max}T23:59:59` } : {}),
  });

  const first = await wcFetchWithTotal<WCOrder>(`/orders?${new URLSearchParams({ ...Object.fromEntries(qsBase.entries()), page: '1' }).toString()}`);
  const totalPages = Math.ceil(first.total / 100);
  const pageBatches = totalPages > 1
    ? await Promise.all(
        Array.from({ length: totalPages - 1 }, (_, idx) => idx + 2).map((page) =>
          wcFetch<WCOrder[]>(`/orders?${new URLSearchParams({ ...Object.fromEntries(qsBase.entries()), page: String(page) }).toString()}`, [])
        )
      )
    : [];

  const allOrders = [...first.data, ...pageBatches.flat()];
  const salesEligible = allOrders.filter((o) => !['cancelled', 'failed', 'trash'].includes(o.status));
  const netEligible = salesEligible.filter((o) => o.status !== 'refunded');

  const totalSales = salesEligible.reduce((sum, o) => sum + Number(o.total || 0), 0);
  const netSales = netEligible.reduce((sum, o) => sum + Number(o.total || 0), 0);
  const totalItems = salesEligible.reduce(
    (sum, o) => sum + (Array.isArray(o.line_items) ? o.line_items.reduce((qty, li) => qty + Number(li.quantity || 0), 0) : 0),
    0,
  );

  return [{
    total_sales: totalSales.toFixed(2),
    net_sales: netSales.toFixed(2),
    total_orders: salesEligible.length,
    total_items: totalItems,
  }];
}

export async function getReportsCustomers(params: { date_min?: string; date_max?: string }) {
  const perPage = 100;
  const first = await wcFetchWithTotal<WCCustomer>(`/customers?per_page=${perPage}&page=1`);
  if (first.data.length === 0) return [{ total: 0 }];

  const totalPages = Math.ceil(first.total / perPage);
  const pageBatches = totalPages > 1
    ? await Promise.all(
        Array.from({ length: totalPages - 1 }, (_, idx) => idx + 2).map((page) =>
          wcFetch<WCCustomer[]>(`/customers?per_page=${perPage}&page=${page}`, [])
        )
      )
    : [];

  const allCustomers = [...first.data, ...pageBatches.flat()];
  const minMs = params.date_min ? new Date(`${params.date_min}T00:00:00`).getTime() : null;
  const maxMs = params.date_max ? new Date(`${params.date_max}T23:59:59`).getTime() : null;

  const filteredCustomers = allCustomers.filter((customer) => {
    const created = new Date(customer.date_created).getTime();
    if (Number.isNaN(created)) return false;
    if (minMs !== null && created < minMs) return false;
    if (maxMs !== null && created > maxMs) return false;
    return true;
  });

  return [{ total: filteredCustomers.length }];
}

export async function getReportsTrend(params: { date_min?: string; date_max?: string }) {
  const results: Array<{ date: string; total: number; orders: number }> = [];
  const byDay = new Map<string, { total: number; orders: number }>();
  const qsBase = new URLSearchParams({
    per_page: '100',
    status: 'any',
    ...(params.date_min ? { after: `${params.date_min}T00:00:00` } : {}),
    ...(params.date_max ? { before: `${params.date_max}T23:59:59` } : {}),
  });

  const first = await wcFetchWithTotal<WCOrder>(`/orders?${new URLSearchParams({ ...Object.fromEntries(qsBase.entries()), page: '1' }).toString()}`);
  const totalPages = Math.ceil(first.total / 100);
  const pageBatches = totalPages > 1
    ? await Promise.all(
        Array.from({ length: totalPages - 1 }, (_, idx) => idx + 2).map((page) =>
          wcFetch<WCOrder[]>(`/orders?${new URLSearchParams({ ...Object.fromEntries(qsBase.entries()), page: String(page) }).toString()}`, [])
        )
      )
    : [];

  for (const order of [...first.data, ...pageBatches.flat()]) {
    const date = order.date_created.split('T')[0];
    const current = byDay.get(date) ?? { total: 0, orders: 0 };
    byDay.set(date, {
      total: current.total + Number(order.total || 0),
      orders: current.orders + 1,
    });
  }

  for (const [date, value] of Array.from(byDay.entries()).sort(([a], [b]) => a.localeCompare(b))) {
    results.push({ date, total: value.total, orders: value.orders });
  }

  return results;
}

// ── Site Settings ──────────────────────────────────────────
export async function getSiteSettings(): Promise<SiteSettings | null> {
  try {
    const base = getWpApiUrl();
    const res = await fetchWithTimeout(`${base}/marveo/v1/settings/site_settings`, { next: { revalidate: 60 } }, 1);
    if (!res.ok) return null;
    const json = await res.json();
    // Connector returns { group, schema, settings } — extract settings
    return (json?.settings ?? json) as SiteSettings;
  } catch { return null; }
}

export async function saveSiteSettings(settings: SiteSettings, token: string): Promise<boolean> {
  try {
    const base = getWpApiUrl();
    const res = await fetchWithTimeout(`${base}/marveo/v1/settings/site_settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(settings),
    }, 2);
    return res.ok;
  } catch (err) {
    console.error('Save site settings failed:', err);
    return false;
  }
}

// ── Blog Posts ─────────────────────────────────────────────
export async function getPosts(page = 1, search = '', token?: string): Promise<{ data: WPPost[]; total: number }> {
  try {
    const qs = new URLSearchParams({ per_page: '20', page: String(page), _embed: '1', context: 'edit', ...(search && { search }) });
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetchWithTimeout(`${wpBase()}/posts?${qs}`, { headers, cache: 'no-store' }, 1);
    if (!res.ok) return { data: [], total: 0 };
    return { data: await res.json(), total: Number(res.headers.get('X-WP-Total') ?? 0) };
  } catch { return { data: [], total: 0 }; }
}

export async function getPostById(id: number): Promise<WPPost | null> {
  try {
    const res = await fetch(`${wpBase()}/posts/${id}?_embed=1`, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function createOrUpdatePost(data: Record<string, unknown>, token: string, id?: number): Promise<WPPost | null> {
  try {
    const url = id ? `${wpBase()}/posts/${id}` : `${wpBase()}/posts`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
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
