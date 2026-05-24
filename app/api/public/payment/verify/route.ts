import { NextRequest, NextResponse } from 'next/server';
import { verifyPayment } from '@/lib/commercialOnboarding';
import { sendPlatformEmailNotification, sendPlatformFailureAlert } from '@/lib/emailNotifications';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const paymentReference = body?.paymentReference ? String(body.paymentReference).trim() : '';
  const providerRaw = body?.provider ? String(body.provider).trim().toUpperCase() : '';
  const provider = ['PAYSTACK', 'FLUTTERWAVE', 'CUSTOM', 'STRIPE', 'PAYPAL'].includes(providerRaw)
    ? providerRaw as 'PAYSTACK' | 'FLUTTERWAVE' | 'CUSTOM' | 'STRIPE' | 'PAYPAL'
    : null;
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

  if (!provider) {
    return NextResponse.json({ ok: false, error: 'provider must be one of PAYSTACK, FLUTTERWAVE, CUSTOM, STRIPE, PAYPAL' }, { status: 400 });
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
    if (customerEmail) {
      await sendPlatformEmailNotification({
        templateKey: 'PAYMENT_FAILED',
        to: customerEmail,
        variables: {
          clientName: customerEmail,
          paymentReference,
          errorMessage: result.reason,
        },
      });
    }

    await sendPlatformFailureAlert({
      failureType: 'PAYMENT_VERIFICATION_FAILED',
      errorMessage: result.reason || 'Payment verification failed',
      operationName: 'public.payment.verify',
    });

    return NextResponse.json({ ok: false, error: result.reason }, { status: 404 });
  }

  if (customerEmail) {
    await sendPlatformEmailNotification({
      templateKey: 'PAYMENT_RECEIVED',
      to: customerEmail,
      variables: {
        clientName: customerEmail,
        amount: typeof amount === 'number' ? amount : '',
        currency: currency || '',
        paymentReference,
        subscriptionId: result.subscriptionId,
      },
    });
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
