import { NextRequest, NextResponse } from 'next/server';
import { createExpenseEntry, listLedgerEntries } from '@/lib/finance/ledger';
import { isExpenseCategoryKey } from '@/lib/finance/categories';
import { FINANCE_CURRENCY_OPTIONS, FINANCE_PAYMENT_METHOD_OPTIONS } from '@/lib/finance/options';
import { requireActionPermission } from '@/lib/master/permissions/guards';

export async function GET() {
  const access = await requireActionPermission('finance', 'view');
  if ('error' in access) return access.error;

  const entries = await listLedgerEntries({ type: 'expense', limit: 300 });
  return NextResponse.json({ entries });
}

export async function POST(req: NextRequest) {
  const access = await requireActionPermission('finance', 'create');
  if ('error' in access) return access.error;

  const body = await req.json().catch(() => null);
  const categoryRaw = String(body?.category || '').trim();
  const amount = Number(body?.amount || 0);

  if (!isExpenseCategoryKey(categoryRaw)) {
    return NextResponse.json({ error: 'Invalid expense category' }, { status: 400 });
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'amount must be greater than zero' }, { status: 400 });
  }

  if (!String(body?.vendor || '').trim()) {
    return NextResponse.json({ error: 'vendor is required' }, { status: 400 });
  }

  if (!String(body?.paymentMethod || '').trim()) {
    return NextResponse.json({ error: 'paymentMethod is required' }, { status: 400 });
  }

  if (!String(body?.incurredDate || '').trim()) {
    return NextResponse.json({ error: 'incurredDate is required' }, { status: 400 });
  }

  const currency = String(body?.currency || 'USD').trim().toUpperCase();
  if (!FINANCE_CURRENCY_OPTIONS.includes(currency as (typeof FINANCE_CURRENCY_OPTIONS)[number])) {
    return NextResponse.json({ error: 'Invalid currency option' }, { status: 400 });
  }

  const paymentMethod = String(body?.paymentMethod || '').trim();
  if (!FINANCE_PAYMENT_METHOD_OPTIONS.includes(paymentMethod as (typeof FINANCE_PAYMENT_METHOD_OPTIONS)[number])) {
    return NextResponse.json({ error: 'Invalid payment method option' }, { status: 400 });
  }

  if (!String(body?.receipt || '').trim()) {
    return NextResponse.json({ error: 'receipt is required (upload only)' }, { status: 400 });
  }

  const entry = await createExpenseEntry({
    vendor: String(body.vendor).trim(),
    category: categoryRaw,
    subcategory: body?.subcategory ? String(body.subcategory).trim() : undefined,
    amount,
    currency,
    paymentMethod,
    receipt: body?.receipt ? String(body.receipt).trim() : undefined,
    notes: body?.notes ? String(body.notes).trim() : undefined,
    description: body?.description ? String(body.description).trim() : undefined,
    reference: body?.reference ? String(body.reference).trim() : undefined,
    source: body?.source ? String(body.source).trim() : undefined,
    sourceId: body?.sourceId ? String(body.sourceId).trim() : undefined,
    workspaceId: body?.workspaceId ? String(body.workspaceId).trim() : undefined,
    clientId: body?.clientId ? String(body.clientId).trim() : undefined,
    status: body?.status ? String(body.status).trim().toLowerCase() as 'pending' | 'approved' | 'paid' | 'cancelled' : 'pending',
    incurredDate: String(body.incurredDate).trim(),
    createdBy: String(access.session.user?.user_email || 'unknown').trim().toLowerCase(),
  });

  return NextResponse.json({ ok: true, entry });
}
