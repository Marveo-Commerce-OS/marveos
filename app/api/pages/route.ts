import { NextRequest, NextResponse } from 'next/server';
import { getWordPressApiBase } from '@/src/lib/endpoints';

export const dynamic = 'force-dynamic';

interface RuntimePage {
  id: number;
  title: string;
  slug: string;
  type: string;
  status: string;
}

function normalizeBase(base: string): string {
  return base.endsWith('/') ? base.slice(0, -1) : base;
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
  return `${root}/wp/v2/pages?per_page=100&_fields=id,slug,status,title`;
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

function sanitizePage(input: unknown): RuntimePage | null {
  if (!input || typeof input !== 'object') return null;

  const raw = input as Record<string, unknown>;
  const id = Number(raw.id);
  const slug = String(raw.slug ?? '').trim();
  const titleFromNested =
    raw.title && typeof raw.title === 'object'
      ? String((raw.title as Record<string, unknown>).rendered ?? '')
      : '';
  const title = String(raw.title ?? titleFromNested).trim() || titleFromNested.trim();

  if (!Number.isFinite(id) || id <= 0 || !slug || !title) return null;

  const status = String(raw.status ?? 'publish');
  const type = String(raw.page_type ?? raw.type ?? inferType(slug, title));

  return { id, title, slug, type, status };
}

async function fetchPagesFromMarveo(base: string): Promise<RuntimePage[]> {
  const res = await fetch(toMarveoPagesEndpoint(base), {
    method: 'GET',
    headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
    cache: 'no-store',
  });

  if (!res.ok) return [];

  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) return [];

  return data
    .map(sanitizePage)
    .filter((page): page is RuntimePage => Boolean(page));
}

async function fetchPagesFromWp(base: string): Promise<RuntimePage[]> {
  const res = await fetch(toWpPagesEndpoint(base), {
    method: 'GET',
    headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
    cache: 'no-store',
  });

  if (!res.ok) return [];

  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) return [];

  return data
    .map(sanitizePage)
    .filter((page): page is RuntimePage => Boolean(page));
}

async function getRuntimePages(): Promise<RuntimePage[]> {
  const base = getWordPressApiBase();
  if (!base) return [];

  const marveoPages = await fetchPagesFromMarveo(base);
  if (marveoPages.length > 0) {
    return marveoPages;
  }

  return fetchPagesFromWp(base);
}

export async function GET() {
  try {
    const pages = await getRuntimePages();
    return NextResponse.json(
      {
        pages,
        count: pages.length,
        syncedAt: new Date().toISOString(),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch pages';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(_req: NextRequest) {
  return GET();
}
