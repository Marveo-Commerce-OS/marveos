import { NextRequest, NextResponse } from 'next/server';
import { listLedgerEntries } from '@/lib/finance/ledger';
import { recordIncomeEvent } from '@/lib/finance/automation';
import { isIncomeCategoryKey } from '@/lib/finance/categories';
import { FINANCE_CURRENCY_OPTIONS } from '@/lib/finance/options';
import { requireActionPermission } from '@/lib/master/permissions/guards';

export async function GET() {
  const access = await requireActionPermission('finance', 'view');
  if ('error' in access) return access.error;

  const entries = await listLedgerEntries({ type: 'income', limit: 300 });
  return NextResponse.json({ entries });
}

export async function POST(req: NextRequest) {
  const access = await requireActionPermission('finance', 'create');
  if ('error' in access) return access.error;

  const body = await req.json().catch(() => null);
  const categoryRaw = String(body?.category || '').trim();
  const amount = Number(body?.amount || 0);
  const currency = String(body?.currency || 'USD').trim().toUpperCase();
  const sourceId = String(body?.sourceId || body?.reference || '').trim();
  const status = String(body?.status || 'pending').trim().toLowerCase();
  const source = String(body?.source || 'manual_adjustment').trim();

  if (!isIncomeCategoryKey(categoryRaw)) {
    return NextResponse.json({ error: 'Invalid income category' }, { status: 400 });
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'amount must be greater than zero' }, { status: 400 });
  }

  if (!FINANCE_CURRENCY_OPTIONS.includes(currency as (typeof FINANCE_CURRENCY_OPTIONS)[number])) {
    return NextResponse.json({ error: 'Invalid currency option' }, { status: 400 });
  }

  if (!sourceId) {
    return NextResponse.json({ error: 'sourceId or reference is required' }, { status: 400 });
  }

  if (!['pending', 'paid', 'failed', 'refunded'].includes(status)) {
    return NextResponse.json({ error: 'Invalid income status' }, { status: 400 });
  }

  const isLoanCategory = categoryRaw === 'loan_funding';
  const isLoanSource = source === 'loan_funding';
  if (isLoanCategory && !isLoanSource) {
    return NextResponse.json({ error: 'Loan Funding category must use source=loan_funding.' }, { status: 400 });
  }
  if (!isLoanCategory && isLoanSource) {
    return NextResponse.json({ error: 'Loan source cannot be posted into normal revenue categories.' }, { status: 400 });
  }

  const entry = await recordIncomeEvent({
    source,
    sourceId,
    amount,
    currency,
    reference: String(body?.reference || sourceId).trim(),
    description: String(body?.description || 'Manual income entry').trim(),
    status: status as 'pending' | 'paid' | 'failed' | 'refunded',
    createdBy: String(access.session.user?.user_email || 'unknown').trim().toLowerCase(),
    workspaceId: body?.workspaceId ? String(body.workspaceId).trim() : undefined,
    clientId: body?.clientId ? String(body.clientId).trim() : undefined,
    category: categoryRaw,
    subcategory: body?.subcategory ? String(body.subcategory).trim() : undefined,
    transactionDate: body?.transactionDate ? String(body.transactionDate).trim() : undefined,
  });

  return NextResponse.json({ ok: true, entry });
}
