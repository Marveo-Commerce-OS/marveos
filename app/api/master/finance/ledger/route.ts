import { NextRequest, NextResponse } from 'next/server';
import { listLedgerEntries } from '@/lib/finance/ledger';
import { requireActionPermission } from '@/lib/master/permissions/guards';

export async function GET(req: NextRequest) {
  const access = await requireActionPermission('finance', 'view');
  if ('error' in access) return access.error;

  const entries = await listLedgerEntries({
    type: (req.nextUrl.searchParams.get('type') || undefined) as 'income' | 'expense' | undefined,
    category: req.nextUrl.searchParams.get('category') || undefined,
    status: req.nextUrl.searchParams.get('status') || undefined,
    workspaceId: req.nextUrl.searchParams.get('workspaceId') || undefined,
    clientId: req.nextUrl.searchParams.get('clientId') || undefined,
    month: req.nextUrl.searchParams.get('month') || undefined,
    search: req.nextUrl.searchParams.get('search') || undefined,
    limit: req.nextUrl.searchParams.get('limit') ? Number(req.nextUrl.searchParams.get('limit')) : undefined,
  });

  return NextResponse.json({ entries });
}
