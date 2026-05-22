import { NextRequest, NextResponse } from 'next/server';
import { getSession, isAdmin } from '@/lib/auth';

/**
 * POST /api/connector/check
 * Lightweight server-side proxy that checks if the Marvéo Connector plugin
 * is installed and reachable on a given WordPress domain.
 * No workspace required — used in onboarding details step for real-time feedback.
 * Body: { domain: string }
 */

async function ensureSession() {
  const session = await getSession();
  if (!session) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const admin = await isAdmin(session.token);
  if (!admin) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { session };
}

function normalizeSiteUrl(raw: string): string | null {
  const trimmed = raw.trim().replace(/\/$/, '');
  if (!trimmed) return null;

  const withScheme =
    trimmed.startsWith('http://') || trimmed.startsWith('https://')
      ? trimmed
      : `https://${trimmed}`;

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

export async function POST(req: NextRequest) {
  const auth = await ensureSession();
  if ('error' in auth) return auth.error;

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const rawDomain = String(body?.domain || '');

  const siteOrigin = normalizeSiteUrl(rawDomain);
  if (!siteOrigin) {
    return NextResponse.json(
      { error: 'Invalid domain. Provide a valid HTTP/HTTPS URL.' },
      { status: 400 },
    );
  }

  const statusUrl = `${siteOrigin}/wp-json/marveo/v1/status`;

  try {
    const res = await fetch(statusUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      return NextResponse.json({
        found: false,
        siteOrigin,
        error: `Site responded with HTTP ${res.status}. The Marvéo Connector plugin may not be installed or activated.`,
      });
    }

    const data = await res.json() as {
      status?: string;
      connector_version?: string;
      site_id?: string;
      wordpress_version?: string;
      woocommerce_version?: string | null;
      jwt_enabled?: boolean;
    };

    return NextResponse.json({
      found: true,
      siteOrigin,
      connectorPluginStatus: data.status ?? 'pending_setup',
      connectorVersion: data.connector_version ?? null,
      wordpressVersion: data.wordpress_version ?? null,
      woocommerceEnabled: data.woocommerce_version != null && data.woocommerce_version !== null,
      siteId: data.site_id ?? null,
      jwtEnabled: data.jwt_enabled ?? false,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Request failed';
    return NextResponse.json({
      found: false,
      siteOrigin,
      error: `Could not reach ${siteOrigin}: ${message}. Check the domain and ensure the plugin is active.`,
    });
  }
}
