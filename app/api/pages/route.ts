import { NextRequest, NextResponse } from 'next/server';
import { getWordPressApiBase } from '@/src/lib/endpoints';

type ContentSource = 'wordpress' | 'nextjs';

export const dynamic = 'force-dynamic';

interface ListedPage {
  id: string;
  originId?: number;
  title: string;
  slug: string;
  type: string;
  status: string;
  sourceType: ContentSource;
  url: string;
}

function normalizeBase(base: string): string {
  return base.endsWith('/') ? base.slice(0, -1) : base;
}

function inferType(slug: string, title: string): string {
  const key = `${slug} ${title}`.toLowerCase();
  if (key.includes('home')) return 'home';
  if (key.includes('about')) return 'about';
  if (key.includes('contact')) return 'contact';
  if (key.includes('service')) return 'services';
  if (key.includes('blog') || key.includes('news')) return 'blog';
  if (key.includes('shop') || key.includes('store')) return 'shop';
  return 'custom';
}

function toMarveoPagesEndpoint(base: string): string {
  const normalized = normalizeBase(base);
  return normalized.includes('/wp-json')
    ? `${normalized}/marveo/v1/pages`
    : `${normalized}/wp-json/marveo/v1/pages`;
}

function toWpPagesEndpoint(base: string): string {
  const normalized = normalizeBase(base);
  const root = normalized.includes('/wp-json') ? normalized : `${normalized}/wp-json`;
  return `${root}/wp/v2/pages?per_page=100&_fields=id,slug,status,title,link`;
}

function parseContentSource(value: string | null): ContentSource {
  return value?.toLowerCase() === 'nextjs' ? 'nextjs' : 'wordpress';
}

function resolveBaseUrl(sourceType: ContentSource, providedBase: string | null): string {
  if (providedBase && providedBase.trim()) {
    return normalizeBase(providedBase.trim());
  }

  if (sourceType === 'wordpress') {
    return normalizeBase(getWordPressApiBase());
  }

  const fallbackFrontend = process.env.NEXT_PUBLIC_FRONTEND_URL || '';
  return normalizeBase(fallbackFrontend);
}

function sanitizeWordPressPage(input: unknown, base: string): ListedPage | null {
  if (!input || typeof input !== 'object') return null;

  const raw = input as Record<string, unknown>;
  const originId = Number(raw.id);
  const slug = String(raw.slug ?? '').trim();

  const nestedTitle =
    raw.title && typeof raw.title === 'object'
      ? String((raw.title as Record<string, unknown>).rendered ?? '')
      : '';
  const title = String(raw.title ?? nestedTitle).trim() || nestedTitle.trim();

  if (!Number.isFinite(originId) || originId <= 0 || !slug || !title) return null;

  const status = String(raw.status ?? 'publish');
  const pageType = String(raw.page_type ?? raw.type ?? inferType(slug, title));
  const siteOrigin = normalizeBase(base).replace(/\/wp-json(?:\/.*)?$/, '');
  const url = String(raw.url ?? raw.link ?? `${siteOrigin}/${slug.replace(/^\//, '')}`);

  return {
    id: String(originId),
    originId,
    title,
    slug,
    type: pageType,
    status,
    sourceType: 'wordpress',
    url,
  };
}

async function fetchWordpressPages(base: string): Promise<ListedPage[]> {
  const marveoRes = await fetch(toMarveoPagesEndpoint(base), {
    method: 'GET',
    headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
    cache: 'no-store',
  });

  if (marveoRes.ok) {
    const data = (await marveoRes.json()) as unknown;
    if (Array.isArray(data)) {
      const pages = data
        .map((item) => sanitizeWordPressPage(item, base))
        .filter((item): item is ListedPage => Boolean(item));
      if (pages.length > 0) {
        return pages;
      }
    }
  }

  const wpRes = await fetch(toWpPagesEndpoint(base), {
    method: 'GET',
    headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
    cache: 'no-store',
  });

  if (!wpRes.ok) return [];

  const wpData = (await wpRes.json()) as unknown;
  if (!Array.isArray(wpData)) return [];

  return wpData
    .map((item) => sanitizeWordPressPage(item, base))
    .filter((item): item is ListedPage => Boolean(item));
}

function decodeHtmlEntity(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function parseSitemapUrls(xml: string): string[] {
  const urls: string[] = [];
  const regex = /<loc>([\s\S]*?)<\/loc>/gim;
  let match = regex.exec(xml);

  while (match) {
    urls.push(decodeHtmlEntity(String(match[1] || '').trim()));
    match = regex.exec(xml);
  }

  return urls;
}

function toSlugFromPath(pathname: string): string {
  if (pathname === '/') return 'home';
  return pathname.replace(/^\//, '').replace(/\/$/, '') || 'home';
}

function titleFromSlug(slug: string): string {
  if (slug === 'home') return 'Home';
  return slug
    .split('/')
    .pop()
    ?.replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (ch) => ch.toUpperCase()) || 'Page';
}

async function fetchNextJsPages(base: string): Promise<ListedPage[]> {
  const normalized = normalizeBase(base);
  const paths = new Set<string>();

  try {
    const sitemapRes = await fetch(`${normalized}/sitemap.xml`, {
      method: 'GET',
      headers: { Accept: 'application/xml', 'Cache-Control': 'no-cache' },
      cache: 'no-store',
    });

    if (sitemapRes.ok) {
      const xml = await sitemapRes.text();
      const urls = parseSitemapUrls(xml);
      for (const item of urls) {
        try {
          const url = new URL(item);
          if (url.origin === new URL(normalized).origin) {
            const path = url.pathname || '/';
            if (!path.startsWith('/_next') && !path.endsWith('.xml')) {
              paths.add(path);
            }
          }
        } catch {
          // ignore invalid URL entries
        }
      }
    }
  } catch {
    // fall through to homepage crawl
  }

  if (paths.size === 0) {
    try {
      const homeRes = await fetch(normalized, {
        method: 'GET',
        headers: { Accept: 'text/html', 'Cache-Control': 'no-cache' },
        cache: 'no-store',
      });
      if (homeRes.ok) {
        const html = await homeRes.text();
        const hrefRegex = /href=["']([^"']+)["']/gim;
        let match = hrefRegex.exec(html);
        while (match) {
          const href = String(match[1] || '').trim();
          if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
            match = hrefRegex.exec(html);
            continue;
          }

          try {
            const url = new URL(href, `${normalized}/`);
            if (url.origin === new URL(normalized).origin) {
              const path = url.pathname || '/';
              if (!path.startsWith('/_next')) {
                paths.add(path);
              }
            }
          } catch {
            // ignore invalid href entries
          }

          match = hrefRegex.exec(html);
        }
      }
    } catch {
      // no-op
    }
  }

  if (paths.size === 0) {
    paths.add('/');
  }

  return Array.from(paths)
    .sort((a, b) => a.localeCompare(b))
    .map((path, index) => {
      const slug = toSlugFromPath(path);
      return {
        id: `nx_${index + 1}_${slug.replace(/[^a-z0-9]+/gi, '-')}`,
        title: titleFromSlug(slug),
        slug,
        type: inferType(slug, slug),
        status: 'publish',
        sourceType: 'nextjs' as const,
        url: `${normalized}${path === '/' ? '' : path}`,
      };
    });
}

async function discoverPages(sourceType: ContentSource, base: string): Promise<ListedPage[]> {
  if (!base) return [];
  if (sourceType === 'nextjs') {
    return fetchNextJsPages(base);
  }
  return fetchWordpressPages(base);
}

export async function GET(req: NextRequest) {
  try {
    const sourceType = parseContentSource(req.nextUrl.searchParams.get('sourceType'));
    const baseUrl = resolveBaseUrl(sourceType, req.nextUrl.searchParams.get('baseUrl'));
    const pages = await discoverPages(sourceType, baseUrl);

    return NextResponse.json(
      {
        pages,
        count: pages.length,
        syncedAt: new Date().toISOString(),
        sourceType,
        baseUrl,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch pages';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
