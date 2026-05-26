import type { NextRequest } from 'next/server';

function resolveAllowedOrigins(): string[] {
  const raw = process.env.MARVEO_PUBLIC_CHAT_ALLOWED_ORIGINS || '*';
  return raw.split(',').map((v) => v.trim()).filter(Boolean);
}

export function resolveCorsHeaders(req: NextRequest): Record<string, string> {
  const allowed = resolveAllowedOrigins();
  const origin = req.headers.get('origin') || '';

  const allowOrigin = (() => {
    if (allowed.includes('*')) return '*';
    if (origin && allowed.includes(origin)) return origin;
    return allowed[0] || '*';
  })();

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '600',
  };
}
