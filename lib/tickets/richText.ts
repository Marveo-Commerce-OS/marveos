const ALLOWED_TAGS = new Set([
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  'ul',
  'ol',
  'li',
  'a',
]);

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function sanitizeAnchorAttributes(rawAttrs: string): string {
  const hrefMatch = rawAttrs.match(/\bhref\s*=\s*(["'])(.*?)\1/i);
  const href = hrefMatch?.[2]?.trim() || '';

  if (!href) {
    return '';
  }

  const isAllowedHref = /^(https?:\/\/|mailto:|tel:|\/)/i.test(href);
  if (!isAllowedHref) {
    return '';
  }

  const safeHref = href.replace(/\"/g, '&quot;');
  return ` href="${safeHref}" target="_blank" rel="noopener noreferrer"`;
}

export function sanitizeRichTextHtml(input: unknown): string {
  const raw = String(input || '');
  if (!raw.trim()) return '<p></p>';

  let sanitized = raw
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|iframe|object|embed|form|input|textarea|button|select|meta|link)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<(script|style|iframe|object|embed|form|input|textarea|button|select|meta|link)[^>]*\/?\s*>/gi, '');

  sanitized = sanitized.replace(/<\/?([a-z0-9-]+)([^>]*)>/gi, (full, rawTagName: string, rawAttrs: string) => {
    const tagName = rawTagName.toLowerCase();
    const isClosing = full.startsWith('</');

    if (!ALLOWED_TAGS.has(tagName)) {
      return '';
    }

    if (isClosing) {
      return `</${tagName}>`;
    }

    if (tagName === 'a') {
      return `<a${sanitizeAnchorAttributes(rawAttrs)}>`;
    }

    return `<${tagName}>`;
  });

  sanitized = sanitized.replace(/\s+on[a-z]+\s*=\s*(["']).*?\1/gi, '');

  if (!sanitized.trim()) return '<p></p>';
  return sanitized;
}

export function richTextToPlainText(html: unknown): string {
  const normalized = String(html || '')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*\/p\s*>/gi, '\n')
    .replace(/<\s*\/li\s*>/gi, '\n');

  const withoutTags = normalized.replace(/<[^>]*>/g, ' ');
  const decoded = decodeHtmlEntities(withoutTags);

  return decoded
    .replace(/\r/g, '')
    .replace(/[\t ]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function sanitizeAndExtractRichText(input: unknown): { html: string; text: string } {
  const html = sanitizeRichTextHtml(input);
  const text = richTextToPlainText(html);

  if (!text) {
    return { html: '<p></p>', text: '' };
  }

  return { html, text };
}

export function sanitizeTicketSubject(input: unknown): string {
  const value = decodeHtmlEntities(String(input || '').trim());
  return escapeHtml(value).slice(0, 180).trim();
}
