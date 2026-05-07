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

export async function GET(req: NextRequest) {
  const host = req.nextUrl.searchParams.get('host') ?? '';
  const store = await readAdminStore();

  const requestHost = normalizeHost(host);
  const configuredHost = normalizeHost(store.tracking.ecommerceDomain);
  const allowed = Boolean(requestHost) && Boolean(configuredHost) && requestHost === configuredHost;

  return NextResponse.json({
    allowed,
    domain: store.tracking.ecommerceDomain,
    scripts: allowed ? store.tracking : null,
  });
}
