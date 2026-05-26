export function normalizeStoredMediaUrl(value: unknown): string | null {
  const raw = String(value || '').trim();
  if (!raw) return '';

  if (raw.startsWith('/')) {
    if (raw.startsWith('/api/media/file?pathname=')) {
      try {
        const url = new URL(raw, 'http://localhost');
        const pathname = url.searchParams.get('pathname') || '';
        return pathname ? `/api/media/file/${encodeURIComponent(pathname.trim())}` : '/api/media/file';
      } catch {
        return raw;
      }
    }

    return raw;
  }

  try {
    const parsed = new URL(raw);
    if (parsed.pathname === '/api/media/file') {
      const pathname = parsed.searchParams.get('pathname');
      return pathname ? `/api/media/file?pathname=${encodeURIComponent(pathname.trim())}` : '/api/media/file';
    }

    const host = parsed.hostname.toLowerCase();
    if (host.includes('blob.vercel-storage.com') || host.includes('vercel-storage.com')) {
      const pathname = parsed.pathname.replace(/^\/+/, '');
      return pathname ? `/api/media/file/${encodeURIComponent(pathname)}` : '/api/media/file';
    }

    if (parsed.pathname === '/api/media/file') {
      const pathname = parsed.searchParams.get('pathname');
      return pathname ? `/api/media/file/${encodeURIComponent(pathname.trim())}` : '/api/media/file';
    }

    return raw;
  } catch {
    return null;
  }
}
