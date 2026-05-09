import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { readAdminStore, updateAdminStore } from '@/lib/adminStore';

type ContentSource = 'wordpress' | 'nextjs';
type SectionKind = 'heading' | 'paragraph' | 'image' | 'button';

interface EditableSection {
  id: string;
  kind: SectionKind;
  label: string;
  text: string;
  tag?: string;
  src?: string;
  alt?: string;
  href?: string;
}

function normalizeBase(base: string): string {
  return base.endsWith('/') ? base.slice(0, -1) : base;
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function stripTags(value: string): string {
  return decodeHtml(value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));
}

function parseContentSource(value: string | null): ContentSource {
  return value?.toLowerCase() === 'nextjs' ? 'nextjs' : 'wordpress';
}

function draftKey(sourceType: ContentSource, baseUrl: string, pageId: string): string {
  return `${sourceType}::${normalizeBase(baseUrl)}::${pageId}`;
}

function toWpPageEndpoint(base: string, pageId: string): string {
  const normalized = normalizeBase(base);
  const root = normalized.includes('/wp-json') ? normalized : `${normalized}/wp-json`;
  return `${root}/wp/v2/pages/${encodeURIComponent(pageId)}?_fields=id,slug,status,title,content,link`;
}

function toWpPageSearchEndpoint(base: string, slug: string): string {
  const normalized = normalizeBase(base);
  const root = normalized.includes('/wp-json') ? normalized : `${normalized}/wp-json`;
  return `${root}/wp/v2/pages?slug=${encodeURIComponent(slug)}&_fields=id,slug,status,title,content,link`;
}

function removeScriptAndStyle(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gim, '')
    .replace(/<style[\s\S]*?<\/style>/gim, '');
}

function parseSectionsFromHtml(html: string): EditableSection[] {
  const clean = removeScriptAndStyle(html);
  const tokens: Array<{ idx: number; section: EditableSection }> = [];
  let counter = 0;

  const headingRegex = /<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/gim;
  let headingMatch = headingRegex.exec(clean);
  while (headingMatch) {
    const text = stripTags(String(headingMatch[2] || ''));
    if (text) {
      counter += 1;
      tokens.push({
        idx: headingMatch.index,
        section: {
          id: `sec_${counter}`,
          kind: 'heading',
          label: `Heading ${counter}`,
          text,
          tag: String(headingMatch[1] || 'h2').toLowerCase(),
        },
      });
    }
    headingMatch = headingRegex.exec(clean);
  }

  const paragraphRegex = /<p[^>]*>([\s\S]*?)<\/p>/gim;
  let paragraphMatch = paragraphRegex.exec(clean);
  while (paragraphMatch) {
    const text = stripTags(String(paragraphMatch[1] || ''));
    if (text) {
      counter += 1;
      tokens.push({
        idx: paragraphMatch.index,
        section: {
          id: `sec_${counter}`,
          kind: 'paragraph',
          label: `Paragraph ${counter}`,
          text,
        },
      });
    }
    paragraphMatch = paragraphRegex.exec(clean);
  }

  const imageRegex = /<img[^>]*>/gim;
  let imageMatch = imageRegex.exec(clean);
  while (imageMatch) {
    const raw = String(imageMatch[0] || '');
    const srcMatch = raw.match(/src=["']([^"']+)["']/i);
    const altMatch = raw.match(/alt=["']([^"']*)["']/i);
    const src = srcMatch ? String(srcMatch[1]) : '';
    if (src) {
      counter += 1;
      tokens.push({
        idx: imageMatch.index,
        section: {
          id: `sec_${counter}`,
          kind: 'image',
          label: `Image ${counter}`,
          text: altMatch ? decodeHtml(String(altMatch[1] || '')) : '',
          src,
          alt: altMatch ? decodeHtml(String(altMatch[1] || '')) : '',
        },
      });
    }
    imageMatch = imageRegex.exec(clean);
  }

  const linkRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gim;
  let linkMatch = linkRegex.exec(clean);
  while (linkMatch) {
    const text = stripTags(String(linkMatch[2] || ''));
    const href = String(linkMatch[1] || '').trim();
    if (text && href && !href.startsWith('#')) {
      counter += 1;
      tokens.push({
        idx: linkMatch.index,
        section: {
          id: `sec_${counter}`,
          kind: 'button',
          label: `CTA ${counter}`,
          text,
          href,
        },
      });
    }
    linkMatch = linkRegex.exec(clean);
  }

  return tokens
    .sort((a, b) => a.idx - b.idx)
    .map((item) => item.section)
    .slice(0, 300);
}

function sanitizeDraftSections(input: unknown): EditableSection[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((item): EditableSection | null => {
      if (!item || typeof item !== 'object') return null;
      const raw = item as Record<string, unknown>;
      const kind = String(raw.kind || '').toLowerCase();
      if (!['heading', 'paragraph', 'image', 'button'].includes(kind)) return null;

      return {
        id: String(raw.id || '').trim() || `sec_${Math.random().toString(36).slice(2, 8)}`,
        kind: kind as SectionKind,
        label: String(raw.label || 'Section').trim(),
        text: String(raw.text || ''),
        tag: raw.tag ? String(raw.tag) : undefined,
        src: raw.src ? String(raw.src) : undefined,
        alt: raw.alt ? String(raw.alt) : undefined,
        href: raw.href ? String(raw.href) : undefined,
      };
    })
    .filter((item): item is EditableSection => Boolean(item));
}

function serializeSectionsToHtml(sections: EditableSection[]): string {
  const chunks = sections.map((section) => {
    const text = section.text || '';
    if (section.kind === 'heading') {
      const tag = section.tag && /^h[1-6]$/.test(section.tag) ? section.tag : 'h2';
      return `<${tag}>${text}</${tag}>`;
    }

    if (section.kind === 'image') {
      if (!section.src) return '';
      const alt = section.alt ?? text;
      return `<figure><img src="${section.src}" alt="${alt}" /></figure>`;
    }

    if (section.kind === 'button') {
      if (!section.href) {
        return `<p>${text}</p>`;
      }
      return `<p><a href="${section.href}">${text}</a></p>`;
    }

    return `<p>${text}</p>`;
  });

  return chunks.filter(Boolean).join('\n\n');
}

async function getWpAuthHeaders(): Promise<Record<string, string> | null> {
  const store = await cookies();
  const token = store.get('admin_token')?.value;
  if (token) {
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  const user = process.env.WP_APP_USER || '';
  const pass = process.env.WP_APP_PASSWORD || '';
  if (!user || !pass) {
    return null;
  }

  const encoded = Buffer.from(`${user}:${pass}`).toString('base64');
  return {
    Authorization: `Basic ${encoded}`,
    'Content-Type': 'application/json',
  };
}

async function loadWordPressPage(baseUrl: string, pageId: string, slug: string): Promise<Record<string, unknown> | null> {
  const byIdRes = await fetch(toWpPageEndpoint(baseUrl, pageId), {
    method: 'GET',
    headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
    cache: 'no-store',
  });

  if (byIdRes.ok) {
    return (await byIdRes.json()) as Record<string, unknown>;
  }

  if (!slug) return null;

  const bySlugRes = await fetch(toWpPageSearchEndpoint(baseUrl, slug), {
    method: 'GET',
    headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
    cache: 'no-store',
  });

  if (!bySlugRes.ok) return null;

  const payload = (await bySlugRes.json()) as unknown;
  if (!Array.isArray(payload) || payload.length === 0) return null;
  return (payload[0] ?? null) as Record<string, unknown> | null;
}

async function loadNextJsPage(url: string): Promise<string> {
  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'text/html', 'Cache-Control': 'no-cache' },
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch page HTML (${res.status})`);
  }

  return res.text();
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ pageId: string }> },
) {
  try {
    const { pageId } = await context.params;
    const sourceType = parseContentSource(req.nextUrl.searchParams.get('sourceType'));
    const baseUrl = normalizeBase(String(req.nextUrl.searchParams.get('baseUrl') || '').trim());
    const slug = String(req.nextUrl.searchParams.get('slug') || '').trim();
    const pageUrl = String(req.nextUrl.searchParams.get('pageUrl') || '').trim();

    if (!baseUrl) {
      return NextResponse.json({ error: 'baseUrl is required' }, { status: 400 });
    }

    if (sourceType === 'wordpress') {
      const page = await loadWordPressPage(baseUrl, pageId, slug);
      if (!page) {
        return NextResponse.json({ error: 'Page not found' }, { status: 404 });
      }

      const titleValue = page.title && typeof page.title === 'object'
        ? String((page.title as Record<string, unknown>).rendered ?? '')
        : String(page.title ?? 'Untitled');

      const contentValue = page.content && typeof page.content === 'object'
        ? String((page.content as Record<string, unknown>).rendered ?? '')
        : String(page.content ?? '');

      const sections = parseSectionsFromHtml(contentValue);

      const store = await readAdminStore();
      const draft = store.cloud.pageDrafts[draftKey(sourceType, baseUrl, String(page.id ?? pageId))];
      const draftSections = sanitizeDraftSections(draft?.sections);
      const mergedSections = draftSections.length > 0 ? draftSections : sections;

      return NextResponse.json({
        sourceType,
        id: String(page.id ?? pageId),
        title: stripTags(titleValue) || 'Untitled',
        slug: String(page.slug ?? slug),
        status: String(page.status ?? 'publish'),
        link: String(page.link ?? ''),
        sections: mergedSections,
      });
    }

    const resolvedPageUrl = pageUrl || `${baseUrl}/${slug.replace(/^\//, '')}`;
    const html = await loadNextJsPage(resolvedPageUrl);
    const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/im);
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/im);
    const contentHtml = String(mainMatch?.[1] || bodyMatch?.[1] || html);
    const sections = parseSectionsFromHtml(contentHtml);
    const store = await readAdminStore();
    const draft = store.cloud.pageDrafts[draftKey(sourceType, baseUrl, pageId)];
    const draftSections = sanitizeDraftSections(draft?.sections);
    const mergedSections = draftSections.length > 0 ? draftSections : sections;

    return NextResponse.json({
      sourceType,
      id: pageId,
      title: slug || pageId,
      slug,
      status: 'publish',
      link: resolvedPageUrl,
      sections: mergedSections,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load page sections';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ pageId: string }> },
) {
  try {
    const { pageId } = await context.params;
    const body = (await req.json()) as {
      sourceType?: string;
      baseUrl?: string;
      sections?: EditableSection[];
      title?: string;
    };

    const sourceType = parseContentSource(body?.sourceType ?? null);
    const baseUrl = normalizeBase(String(body?.baseUrl || '').trim());
    const sections = Array.isArray(body?.sections) ? body.sections : [];

    if (!baseUrl) {
      return NextResponse.json({ error: 'baseUrl is required' }, { status: 400 });
    }

    if (sections.length === 0) {
      return NextResponse.json({ error: 'sections are required' }, { status: 400 });
    }

    if (sourceType !== 'wordpress') {
      await updateAdminStore((current) => ({
        ...current,
        cloud: {
          ...current.cloud,
          pageDrafts: {
            ...current.cloud.pageDrafts,
            [draftKey(sourceType, baseUrl, pageId)]: {
              sourceType,
              baseUrl,
              pageId,
              title: String(body?.title || pageId),
              sections: sections.map((item) => ({ ...item })),
              updatedAt: new Date().toISOString(),
            },
          },
        },
      }));

      return NextResponse.json({
        success: true,
        mode: 'draft_saved',
        message: 'Next.js page sections saved as managed draft. Publish through your frontend deployment pipeline to apply on the live site.',
      });
    }

    const headers = await getWpAuthHeaders();
    if (!headers) {
      return NextResponse.json(
        {
          error: 'WordPress write credentials are not configured. Add WP_APP_USER and WP_APP_PASSWORD, or login as admin so marveo can write page updates.',
        },
        { status: 400 },
      );
    }

    const endpoint = toWpPageEndpoint(baseUrl, pageId).split('?')[0];
    const html = serializeSectionsToHtml(sections);

    const payload: Record<string, unknown> = { content: html };
    if (body?.title && String(body.title).trim()) {
      payload.title = String(body.title).trim();
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      cache: 'no-store',
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = (data as Record<string, unknown>)?.message;
      return NextResponse.json({ error: String(message || `WordPress update failed (${res.status})`) }, { status: 502 });
    }

    await updateAdminStore((current) => ({
      ...current,
      cloud: {
        ...current.cloud,
        pageDrafts: {
          ...current.cloud.pageDrafts,
          [draftKey(sourceType, baseUrl, pageId)]: {
            sourceType,
            baseUrl,
            pageId,
            title: String(body?.title || pageId),
            sections: sections.map((item) => ({ ...item })),
            updatedAt: new Date().toISOString(),
          },
        },
      },
    }));

    return NextResponse.json({ success: true, pageId, updatedAt: new Date().toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save page sections';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
