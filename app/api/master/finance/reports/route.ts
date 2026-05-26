import { NextRequest, NextResponse } from 'next/server';
import { buildOperationalFinanceReports } from '@/lib/finance/metrics';
import { requireActionPermission } from '@/lib/master/permissions/guards';

export async function GET(req: NextRequest) {
  const access = await requireActionPermission('finance', 'view');
  if ('error' in access) return access.error;

  const periodRaw = String(req.nextUrl.searchParams.get('period') || 'month').trim().toLowerCase();
  const period = periodRaw === 'week' || periodRaw === 'month' || periodRaw === 'year' || periodRaw === 'all'
    ? periodRaw as 'week' | 'month' | 'year' | 'all'
    : 'month';
  const currency = String(req.nextUrl.searchParams.get('currency') || '').trim().toUpperCase();

  const reports = await buildOperationalFinanceReports({ period, currency: currency || undefined });
  return NextResponse.json({ reports });
}
