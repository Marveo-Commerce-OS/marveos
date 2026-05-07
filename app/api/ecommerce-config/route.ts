import { NextRequest, NextResponse } from 'next/server';
import { readAdminStore } from '@/lib/adminStore';

function normalizeHost(value: string) {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return '';

  const withoutProtocol = trimmed.replace(/^https?:\/\//, '');
  const hostWithPath = withoutProtocol.replace(/\/.*$/, '');
  const hostWithoutPort = hostWithPath.replace(/:\d+$/, '');
  return hostWithoutPort.replace(/^www\./, '');
}

function rootDomain(host: string) {
  const parts = normalizeHost(host).split('.').filter(Boolean);
  if (parts.length < 2) return normalizeHost(host);
  return parts.slice(-2).join('.');
}

function isAllowedHost(requestHost: string, configuredHost: string) {
  const req = normalizeHost(requestHost);
  const cfg = normalizeHost(configuredHost);
  if (!req || !cfg) return false;

  if (req === cfg) return true;
  if (req.endsWith(`.${cfg}`) || cfg.endsWith(`.${req}`)) return true;
  return rootDomain(req) === rootDomain(cfg);
}

export async function GET(req: NextRequest) {
  const host = req.nextUrl.searchParams.get('host') ?? '';
  const store = await readAdminStore();

  const requestHost = normalizeHost(host);
  const configuredHost = normalizeHost(store.tracking.ecommerceDomain);
  const allowed = isAllowedHost(requestHost, configuredHost);

  return NextResponse.json({
    allowed,
    domain: store.tracking.ecommerceDomain,
    scripts: allowed ? store.tracking : null,
  });
}
