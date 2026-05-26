import { NextRequest, NextResponse } from 'next/server';
import { listLedgerEntries } from '@/lib/finance/ledger';
import { requireActionPermission } from '@/lib/master/permissions/guards';

function csvEscape(value: unknown): string {
  const raw = String(value ?? '');
  if (raw.includes(',') || raw.includes('"') || raw.includes('\n')) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

export async function GET(req: NextRequest) {
  const access = await requireActionPermission('finance', 'export');
  if ('error' in access) return access.error;

  const format = String(req.nextUrl.searchParams.get('format') || 'csv').toLowerCase();
  if (format === 'pdf') {
    return NextResponse.json({
      ok: false,
      message: 'PDF export placeholder: use CSV now. PDF rendering can be added with existing platform PDF pipeline.',
    }, { status: 501 });
  }

  const entries = await listLedgerEntries({
    type: (req.nextUrl.searchParams.get('type') || undefined) as 'income' | 'expense' | undefined,
    month: req.nextUrl.searchParams.get('month') || undefined,
    category: req.nextUrl.searchParams.get('category') || undefined,
  });

  const header = ['date', 'type', 'category', 'amount', 'currency', 'status', 'reference', 'workspaceId', 'clientId'];
  const rows = entries.map((entry) => [
    entry.transactionDate,
    entry.type,
    entry.category,
    entry.amount,
    entry.currency,
    entry.status,
    entry.reference,
    entry.workspaceId || '',
    entry.clientId || '',
  ]);

  const csv = [header, ...rows]
    .map((row) => row.map(csvEscape).join(','))
    .join('\n');

  const filename = `marveo-ledger-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
