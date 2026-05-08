/**
 * WooCommerce Service
 * Handles all WooCommerce REST API interactions
 */

import { getConfig } from '@/src/config/client';

export interface WCProduct {
  id: number;
  name: string;
  slug: string;
  description?: string;
  short_description?: string;
  price?: string;
  regular_price?: string;
  sale_price?: string;
  stock_quantity?: number;
  status: 'publish' | 'draft' | 'pending' | 'private';
  images?: Array<{ id: number; src: string; alt: string }>;
  categories?: Array<{ id: number; name: string }>;
}

export interface WCOrder {
  id: number;
  order_number?: number;
  status: string;
  total?: string;
  date_created?: string;
  customer_id?: number;
  billing?: Record<string, unknown>;
  shipping?: Record<string, unknown>;
  line_items?: Array<{ product_id: number; quantity: number; total: string }>;
}

export interface WCCustomer {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  billing?: Record<string, unknown>;
  shipping?: Record<string, unknown>;
}

const FETCH_TIMEOUT_MS = 8000;

function getWcApiUrl(): string {
  const config = getConfig();
  return config.woocommerceApiUrl || getConfig().wordpressApiUrl || 'https://localhost/wp-json';
}

function getAuth(): string {
  const config = getConfig();
  const key = config.woocommerceConsumerKey || '';
  const secret = config.woocommerceConsumerSecret || '';
  return `consumer_key=${key}&consumer_secret=${secret}`;
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

/**
 * Get products
 */
export async function getProducts(
  page = 1,
  perPage = 20,
  search = '',
  status = 'any'
): Promise<{ products: WCProduct[]; total: number }> {
  try {
    const sep = '?';
    const params = new URLSearchParams({
      per_page: String(perPage),
      page: String(page),
      ...(search && { search }),
      ...(status !== 'any' && { status }),
    });

    const res = await fetchWithTimeout(
      `${getWcApiUrl()}/wc/v3/products${sep}${params}&${getAuth()}`,
      { next: { revalidate: 30 } },
      1
    );

    if (!res.ok) return { products: [], total: 0 };

    const products = await res.json();
    const total = Number(res.headers.get('X-WP-Total') ?? 0);

    return { products, total };
  } catch {
    return { products: [], total: 0 };
  }
}

/**
 * Get single product
 */
export async function getProduct(id: number): Promise<WCProduct | null> {
  try {
    const res = await fetchWithTimeout(
      `${getWcApiUrl()}/wc/v3/products/${id}?${getAuth()}`,
      { next: { revalidate: 30 } },
      1
    );

    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Create product
 */
export async function createProduct(data: Partial<WCProduct> & { name: string }): Promise<WCProduct | null> {
  try {
    const res = await fetch(`${getWcApiUrl()}/wc/v3/products?${getAuth()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      cache: 'no-store',
    });

    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Update product
 */
export async function updateProduct(id: number, data: Partial<WCProduct>): Promise<boolean> {
  try {
    const res = await fetch(`${getWcApiUrl()}/wc/v3/products/${id}?${getAuth()}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      cache: 'no-store',
    });

    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Get orders
 */
export async function getOrders(
  page = 1,
  perPage = 20,
  status = 'any'
): Promise<{ orders: WCOrder[]; total: number }> {
  try {
    const params = new URLSearchParams({
      per_page: String(perPage),
      page: String(page),
      ...(status !== 'any' && { status }),
    });

    const res = await fetchWithTimeout(
      `${getWcApiUrl()}/wc/v3/orders?${params}&${getAuth()}`,
      { next: { revalidate: 30 } },
      1
    );

    if (!res.ok) return { orders: [], total: 0 };

    const orders = await res.json();
    const total = Number(res.headers.get('X-WP-Total') ?? 0);

    return { orders, total };
  } catch {
    return { orders: [], total: 0 };
  }
}

/**
 * Get single order
 */
export async function getOrder(id: number): Promise<WCOrder | null> {
  try {
    const res = await fetchWithTimeout(
      `${getWcApiUrl()}/wc/v3/orders/${id}?${getAuth()}`,
      { next: { revalidate: 30 } },
      1
    );

    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Update order status
 */
export async function updateOrderStatus(id: number, status: string): Promise<boolean> {
  try {
    const res = await fetch(`${getWcApiUrl()}/wc/v3/orders/${id}?${getAuth()}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
      cache: 'no-store',
    });

    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Get customers
 */
export async function getCustomers(page = 1, perPage = 20): Promise<{ customers: WCCustomer[]; total: number }> {
  try {
    const params = new URLSearchParams({
      per_page: String(perPage),
      page: String(page),
    });

    const res = await fetchWithTimeout(
      `${getWcApiUrl()}/wc/v3/customers?${params}&${getAuth()}`,
      { next: { revalidate: 30 } },
      1
    );

    if (!res.ok) return { customers: [], total: 0 };

    const customers = await res.json();
    const total = Number(res.headers.get('X-WP-Total') ?? 0);

    return { customers, total };
  } catch {
    return { customers: [], total: 0 };
  }
}

/**
 * Get single customer
 */
export async function getCustomer(id: number): Promise<WCCustomer | null> {
  try {
    const res = await fetchWithTimeout(
      `${getWcApiUrl()}/wc/v3/customers/${id}?${getAuth()}`,
      { next: { revalidate: 30 } },
      1
    );

    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  getOrders,
  getOrder,
  updateOrderStatus,
  getCustomers,
  getCustomer,
};
