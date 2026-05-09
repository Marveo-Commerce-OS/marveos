import { getCachedConfig } from '@/src/config/client';

function trimTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

export function getWordPressApiBase(): string {
  const config = getCachedConfig();
  const apiUrl = config.wordpressApiUrl || process.env.NEXT_PUBLIC_WP_API_URL || '';
  return trimTrailingSlash(apiUrl);
}

export function getWordPressRestBase(): string {
  const apiBase = getWordPressApiBase();
  if (!apiBase) {
    return '';
  }

  return apiBase.includes('/wp-json') ? `${trimTrailingSlash(apiBase)}/wp/v2` : `${trimTrailingSlash(apiBase)}/wp-json/wp/v2`;
}

export function getWooCommerceRestBase(): string {
  const config = getCachedConfig();
  const apiBase = config.woocommerceApiUrl || process.env.WOOCOMMERCE_API_URL || getWordPressApiBase();
  const normalized = trimTrailingSlash(apiBase || '');
  if (!normalized) {
    return '';
  }

  return normalized.includes('/wp-json') ? `${normalized.replace(/\/wp-json(?:\/)?$/, '/wp-json')}/wc/v3` : `${normalized}/wp-json/wc/v3`;
}

export function getPracticalRouteName(routeName: string, fallback: string): string {
  return routeName.trim() || fallback;
}
