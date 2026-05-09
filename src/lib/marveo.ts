/**
 * Marveo Adapter Library
 *
 * Reusable library for connecting existing Next.js frontends to Marveo backends.
 * Can be used for: gradual content migration, full template replacement, or hybrid modes.
 */

import { cache } from 'react';

interface MarveoSettings {
  business_profile?: {
    business_name?: string;
    industry?: string;
    business_model?: string;
    contact_email?: string;
    contact_phone?: string;
    whatsapp_phone?: string;
  };
  brand_settings?: {
    logo?: string;
    favicon?: string;
    primary_color?: string;
    secondary_color?: string;
    typography?: string;
  };
  content_settings?: {
    homepage_title?: string;
    homepage_subtitle?: string;
    about_content?: string;
    mission?: string;
    vision?: string;
    values?: string;
    social_links?: Array<{ platform: string; url: string }>;
  };
  commerce_settings?: {
    woocommerce_enabled?: boolean;
    checkout_mode?: string;
    currency?: string;
  };
}

interface MarveoContent {
  pages?: Array<{ id: string; title: string; slug: string; content?: string }>;
  posts?: Array<{ id: string; title: string; slug: string; content?: string; date?: string }>;
  products?: Array<{ id: string; name: string; sku: string; price: number }>;
  menus?: Record<string, Array<{ label: string; url: string }>>;
}

interface MarveoClient {
  apiUrl: string;
  frontendUrl: string;
  getSettings(): Promise<MarveoSettings>;
  getContent(): Promise<MarveoContent>;
  getPageBySlug(slug: string): Promise<any>;
  getPostBySlug(slug: string): Promise<any>;
  getProduct(id: string): Promise<any>;
  getMenu(name: string): Promise<Array<{ label: string; url: string }>>;
}

/**
 * Create Marveo client for connecting to backend
 */
export function createMarveoClient(apiUrl: string, frontendUrl: string): MarveoClient {
  return {
    apiUrl,
    frontendUrl,
    
    async getSettings(): Promise<MarveoSettings> {
      try {
        const response = await fetch(`${apiUrl}/api/admin/settings`);
        if (!response.ok) throw new Error('Failed to fetch settings');
        return response.json();
      } catch (error) {
        console.error('Marveo: Failed to fetch settings', error);
        return getDefaultSettings();
      }
    },

    async getContent(): Promise<MarveoContent> {
      try {
        const [pages, posts, products, menus] = await Promise.all([
          fetch(`${apiUrl}/api/posts?type=page`).then(r => r.json()).catch(() => []),
          fetch(`${apiUrl}/api/posts?type=post`).then(r => r.json()).catch(() => []),
          fetch(`${apiUrl}/api/products`).then(r => r.json()).catch(() => []),
          fetch(`${apiUrl}/api/menus`).then(r => r.json()).catch(() => ({})),
        ]);
        return { pages, posts, products, menus };
      } catch (error) {
        console.error('Marveo: Failed to fetch content', error);
        return {};
      }
    },

    async getPageBySlug(slug: string): Promise<any> {
      try {
        const response = await fetch(`${apiUrl}/api/posts/${slug}?type=page`);
        if (!response.ok) throw new Error('Page not found');
        return response.json();
      } catch (error) {
        console.error(`Marveo: Failed to fetch page ${slug}`, error);
        return null;
      }
    },

    async getPostBySlug(slug: string): Promise<any> {
      try {
        const response = await fetch(`${apiUrl}/api/posts/${slug}?type=post`);
        if (!response.ok) throw new Error('Post not found');
        return response.json();
      } catch (error) {
        console.error(`Marveo: Failed to fetch post ${slug}`, error);
        return null;
      }
    },

    async getProduct(id: string): Promise<any> {
      try {
        const response = await fetch(`${apiUrl}/api/products/${id}`);
        if (!response.ok) throw new Error('Product not found');
        return response.json();
      } catch (error) {
        console.error(`Marveo: Failed to fetch product ${id}`, error);
        return null;
      }
    },

    async getMenu(name: string): Promise<Array<{ label: string; url: string }>> {
      try {
        const response = await fetch(`${apiUrl}/api/menus/${name}`);
        if (!response.ok) throw new Error('Menu not found');
        return response.json();
      } catch (error) {
        console.error(`Marveo: Failed to fetch menu ${name}`, error);
        return [];
      }
    },
  };
}

/**
 * Get default settings fallback
 */
export function getDefaultSettings(): MarveoSettings {
  return {
    business_profile: {
      business_name: 'Your Business',
      industry: 'other',
      contact_email: 'contact@yourdomain.com',
    },
    brand_settings: {
      primary_color: '#14B8A6',
      secondary_color: '#A3E635',
      typography: 'Inter',
    },
    content_settings: {
      homepage_title: 'Welcome',
      mission: 'To serve our customers',
    },
  };
}

/**
 * Create cached settings hook
 */
export const getCachedSettings = cache(async (client: MarveoClient) => {
  return client.getSettings();
});

/**
 * Create cached content hook
 */
export const getCachedContent = cache(async (client: MarveoClient) => {
  return client.getContent();
});

/**
 * Marveo Context Type
 */
export interface MarveoContextType {
  client: MarveoClient;
  settings: MarveoSettings;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Config helper for environment-based setup
 */
export function getMarveoConfig() {
  const apiUrl = process.env.NEXT_PUBLIC_MARVEO_API_URL || process.env.NEXT_PUBLIC_WP_API_URL || '';
  const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || process.env.NEXT_PUBLIC_SITE_URL || '';

  if (!apiUrl) {
    console.warn('Marveo: NEXT_PUBLIC_MARVEO_API_URL or NEXT_PUBLIC_WP_API_URL not configured');
  }

  return { apiUrl, frontendUrl };
}

export default createMarveoClient;
