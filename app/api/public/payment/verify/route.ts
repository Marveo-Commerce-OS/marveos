import { NextRequest, NextResponse } from 'next/server';
import { verifyPayment } from '@/lib/commercialOnboarding';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const paymentReference = body?.paymentReference ? String(body.paymentReference).trim() : '';
  const provider = body?.provider ? String(body.provider).trim().toUpperCase() : '';
  const selectedPlanId = body?.selectedPlanId ? String(body.selectedPlanId).trim() : undefined;
  const billingIntervalRaw = body?.billingInterval ? String(body.billingInterval).trim().toUpperCase() : undefined;
  const billingInterval = billingIntervalRaw === 'ANNUAL' ? 'ANNUAL' : billingIntervalRaw === 'MONTHLY' ? 'MONTHLY' : undefined;
  const organizationId = body?.organizationId ? String(body.organizationId).trim() : undefined;
  const customerEmail = body?.customerEmail ? String(body.customerEmail).trim().toLowerCase() : undefined;
  const country = body?.country ? String(body.country).trim().toUpperCase() : undefined;
  const currency = body?.currency ? String(body.currency).trim().toUpperCase() : undefined;
  const amount = typeof body?.amount === 'number' ? body.amount : undefined;

  if (!paymentReference) {
    return NextResponse.json({ ok: false, error: 'paymentReference is required' }, { status: 400 });
  }

  if (provider !== 'PAYSTACK' && provider !== 'STRIPE') {
    return NextResponse.json({ ok: false, error: 'provider must be PAYSTACK or STRIPE' }, { status: 400 });
  }

  if (billingIntervalRaw && !billingInterval) {
    return NextResponse.json({ ok: false, error: 'billingInterval must be MONTHLY or ANNUAL' }, { status: 400 });
  }

  const appBaseUrl = process.env.MARVEO_APP_BASE_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;

  const result = await verifyPayment({
    provider,
    paymentReference,
    selectedPlanId,
    billingInterval,
    organizationId,
    customerEmail,
    country,
    currency,
    amount,
    appBaseUrl,
  });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.reason }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    subscriptionId: result.subscriptionId,
    status: result.status,
    billingInterval: result.billingInterval,
    paymentVerificationStatus: result.paymentVerificationStatus,
    redirectUrl: result.redirectUrl,
  });
}
