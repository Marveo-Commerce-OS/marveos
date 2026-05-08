/**
 * WordPress Service
 * Handles all WordPress REST API interactions
 */

import { getConfig } from '@/src/config/client';

export interface WPPost {
  id: number;
  title: { rendered: string };
  content: { rendered: string };
  excerpt: { rendered: string };
  slug: string;
  date: string;
  featured_media?: number;
  status: 'publish' | 'draft' | 'pending' | 'private';
  meta?: Record<string, unknown>;
}

export interface WPPage {
  id: number;
  title: { rendered: string };
  content: { rendered: string };
  excerpt?: { rendered: string };
  slug: string;
  date: string;
  featured_media?: number;
  status: 'publish' | 'draft' | 'pending' | 'private';
}

export interface WPMedia {
  id: number;
  title: { rendered: string };
  source_url: string;
  media_details?: {
    width?: number;
    height?: number;
    sizes?: Record<string, unknown>;
  };
  alt_text?: string;
}

const FETCH_TIMEOUT_MS = 8000;

function getWpApiUrl(): string {
  const config = getConfig();
  return config.wordpressApiUrl || 'https://localhost/wp-json';
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
 * Get all posts
 */
export async function getPosts(page = 1, perPage = 20, status = 'any'): Promise<{ posts: WPPost[]; total: number }> {
  try {
    const params = new URLSearchParams({
      per_page: String(perPage),
      page: String(page),
      ...(status !== 'any' && { status }),
    });

    const res = await fetchWithTimeout(
      `${getWpApiUrl()}/wp/v2/posts?${params}`,
      { next: { revalidate: 30 } },
      1
    );

    if (!res.ok) return { posts: [], total: 0 };

    const posts = await res.json();
    const total = Number(res.headers.get('X-WP-Total') ?? 0);

    return { posts, total };
  } catch {
    return { posts: [], total: 0 };
  }
}

/**
 * Get single post
 */
export async function getPost(id: number): Promise<WPPost | null> {
  try {
    const res = await fetchWithTimeout(
      `${getWpApiUrl()}/wp/v2/posts/${id}`,
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
 * Create post
 */
export async function createPost(data: Partial<WPPost> & { title: string; content: string }): Promise<WPPost | null> {
  try {
    const res = await fetch(`${getWpApiUrl()}/wp/v2/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getAuthToken()}`,
      },
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
 * Update post
 */
export async function updatePost(id: number, data: Partial<WPPost>): Promise<boolean> {
  try {
    const res = await fetch(`${getWpApiUrl()}/wp/v2/posts/${id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getAuthToken()}`,
      },
      body: JSON.stringify(data),
      cache: 'no-store',
    });

    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Delete post
 */
export async function deletePost(id: number, force = false): Promise<boolean> {
  try {
    const res = await fetch(`${getWpApiUrl()}/wp/v2/posts/${id}?force=${force}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${getAuthToken()}`,
      },
      cache: 'no-store',
    });

    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Get pages
 */
export async function getPages(page = 1, perPage = 20): Promise<{ pages: WPPage[]; total: number }> {
  try {
    const params = new URLSearchParams({
      per_page: String(perPage),
      page: String(page),
    });

    const res = await fetchWithTimeout(
      `${getWpApiUrl()}/wp/v2/pages?${params}`,
      { next: { revalidate: 30 } },
      1
    );

    if (!res.ok) return { pages: [], total: 0 };

    const pages = await res.json();
    const total = Number(res.headers.get('X-WP-Total') ?? 0);

    return { pages, total };
  } catch {
    return { pages: [], total: 0 };
  }
}

/**
 * Get single page
 */
export async function getPage(id: number): Promise<WPPage | null> {
  try {
    const res = await fetchWithTimeout(
      `${getWpApiUrl()}/wp/v2/pages/${id}`,
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
 * Update page
 */
export async function updatePage(id: number, data: Partial<WPPage>): Promise<boolean> {
  try {
    const res = await fetch(`${getWpApiUrl()}/wp/v2/pages/${id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getAuthToken()}`,
      },
      body: JSON.stringify(data),
      cache: 'no-store',
    });

    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Get media
 */
export async function getMedia(page = 1, perPage = 50): Promise<{ media: WPMedia[]; total: number }> {
  try {
    const params = new URLSearchParams({
      per_page: String(perPage),
      page: String(page),
    });

    const res = await fetchWithTimeout(
      `${getWpApiUrl()}/wp/v2/media?${params}`,
      { next: { revalidate: 30 } },
      1
    );

    if (!res.ok) return { media: [], total: 0 };

    const media = await res.json();
    const total = Number(res.headers.get('X-WP-Total') ?? 0);

    return { media, total };
  } catch {
    return { media: [], total: 0 };
  }
}

/**
 * Get single media
 */
export async function getMediaItem(id: number): Promise<WPMedia | null> {
  try {
    const res = await fetchWithTimeout(
      `${getWpApiUrl()}/wp/v2/media/${id}`,
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
 * Helper to get auth token from cookies (should be server-only)
 */
function getAuthToken(): string {
  // This is a placeholder - in reality you'd get this from cookies/headers
  return '';
}

export default {
  getPosts,
  getPost,
  createPost,
  updatePost,
  deletePost,
  getPages,
  getPage,
  updatePage,
  getMedia,
  getMediaItem,
};
