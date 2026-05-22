import type { ConnectorSiteMetadata } from '@/lib/adminStore';

export type ConnectorProbeResult = {
  ok: boolean;
  siteOrigin?: string;
  connectorStatus?: string;
  verificationError?: string;
  metadata?: ConnectorSiteMetadata;
};

type ConnectorStatusResponse = {
  status?: string;
  connector_version?: string;
  site_id?: string;
  wordpress_version?: string;
  woocommerce_version?: string | null;
  jwt_enabled?: boolean;
};

type ConnectorSiteProfileResponse = {
  site_url?: string;
  site_name?: string;
  wordpress_version?: string;
  woocommerce_enabled?: boolean;
  mode?: string;
};

function safeCount(value: unknown): number | undefined {
  return Array.isArray(value) ? value.length : undefined;
}

export function normalizeSiteUrl(raw: string): string | null {
  const trimmed = raw.trim().replace(/\/$/, '');
  if (!trimmed) return null;

  const withScheme = trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(withScheme);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

    if (process.env.NODE_ENV === 'production') {
      const h = url.hostname.toLowerCase();
      const isLocal =
        h === 'localhost' ||
        h === '127.0.0.1' ||
        h === '0.0.0.0' ||
        h.startsWith('192.168.') ||
        h.startsWith('10.') ||
        h.startsWith('172.16.') ||
        h.endsWith('.local');

      if (isLocal) return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}

function buildWpJsonBase(origin: string): string {
  return `${origin}/wp-json/marveo/v1`;
}

async function fetchJson(url: string): Promise<{ ok: boolean; status: number; data: unknown }> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      return { ok: false, status: response.status, data: null };
    }

    const data = await response.json();
    return { ok: true, status: response.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

export async function probeConnectorSite(rawDomain: string): Promise<ConnectorProbeResult> {
  const siteOrigin = normalizeSiteUrl(rawDomain);
  if (!siteOrigin) {
    return {
      ok: false,
      verificationError: 'Invalid or unreachable domain provided.',
    };
  }

  const apiBase = buildWpJsonBase(siteOrigin);
  const discoveredAt = new Date().toISOString();

  const statusRes = await fetchJson(`${apiBase}/status`);
  if (!statusRes.ok) {
    const reason = statusRes.status
      ? `Connector status endpoint returned HTTP ${statusRes.status}.`
      : 'Could not reach connector status endpoint.';

    return {
      ok: false,
      siteOrigin,
      connectorStatus: 'FAILED',
      verificationError: `${reason} Ensure the Marveo Connector plugin is installed and active.`,
    };
  }

  const statusData = (statusRes.data || {}) as ConnectorStatusResponse;

  const [profileRes, pagesRes, productsRes, navigationRes, inventoryRes] = await Promise.all([
    fetchJson(`${apiBase}/site-profile`),
    fetchJson(`${apiBase}/pages`),
    fetchJson(`${apiBase}/products`),
    fetchJson(`${apiBase}/navigation`),
    fetchJson(`${apiBase}/content-inventory`),
  ]);

  const profileData = (profileRes.data || {}) as ConnectorSiteProfileResponse;

  const inventoryData = (inventoryRes.data || {}) as Record<string, unknown>;
  const inventoryMedia = inventoryData && typeof inventoryData.media === 'object'
    ? Number((inventoryData.media as Record<string, unknown>).total || 0)
    : undefined;

  const metadata: ConnectorSiteMetadata = {
    siteUrl: profileData.site_url ?? siteOrigin,
    siteName: profileData.site_name ?? undefined,
    platform: profileData.mode === 'headless' ? 'WordPress (Headless)' : 'WordPress/WooCommerce',
    wordpressVersion: profileData.wordpress_version ?? statusData.wordpress_version ?? undefined,
    woocommerceEnabled: profileData.woocommerce_enabled ?? Boolean(statusData.woocommerce_version),
    connectorVersion: statusData.connector_version ?? undefined,
    connectorPluginStatus: statusData.status ?? 'pending_setup',
    siteId: statusData.site_id ?? undefined,
    jwtEnabled: statusData.jwt_enabled ?? false,
    pageCount: safeCount(pagesRes.data),
    productCount: safeCount(productsRes.data),
    menuCount: safeCount(navigationRes.data),
    mediaCount: inventoryMedia,
    detectedCapabilities: {
      statusEndpoint: statusRes.ok,
      siteProfile: profileRes.ok,
      woocommerceDetection: profileRes.ok || Boolean(statusData.woocommerce_version),
      pagesDiscovery: pagesRes.ok,
      productsDiscovery: productsRes.ok,
      navigationDiscovery: navigationRes.ok,
      mediaDiscovery: inventoryRes.ok && typeof inventoryMedia === 'number',
      contentInventory: inventoryRes.ok,
    },
    discoveredAt,
  };

  return {
    ok: true,
    siteOrigin,
    connectorStatus: 'CONNECTED',
    metadata,
  };
}
