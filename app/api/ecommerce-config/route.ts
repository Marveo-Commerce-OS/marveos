import { NextRequest, NextResponse } from 'next/server';
import { readAdminStore } from '@/lib/adminStore';

export async function GET(req: NextRequest) {
  const host = req.nextUrl.searchParams.get('host') ?? '';
  const store = await readAdminStore();

  const allowed = host === store.tracking.ecommerceDomain;
  return NextResponse.json({
    allowed,
    domain: store.tracking.ecommerceDomain,
    scripts: allowed ? store.tracking : null,
  });
}
