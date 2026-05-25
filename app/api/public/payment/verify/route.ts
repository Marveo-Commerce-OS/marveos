import { NextRequest, NextResponse } from 'next/server';
import { verifyPayment } from '@/lib/commercialOnboarding';
import { sendPlatformEmailNotification, sendPlatformFailureAlert } from '@/lib/emailNotifications';
import {
  asOptionalTrimmedString,
  asTrimmedString,
  enforceRateLimit,
  parseBillingInterval,
  parseEmail,
  parsePaymentProvider,
} from '@/lib/security/requestGuards';

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, 'public:payment:verify');
  if (limited) return limited;

  const body = await req.json().catch(() => null);
  const paymentReference = asTrimmedString(body?.paymentReference);
  const providerRaw = asTrimmedString(body?.provider).toUpperCase();
  const provider = parsePaymentProvider(providerRaw);
  const selectedPlanId = asOptionalTrimmedString(body?.selectedPlanId);
  const billingIntervalRaw = asOptionalTrimmedString(body?.billingInterval)?.toUpperCase();
  const billingInterval = parseBillingInterval(body?.billingInterval) || undefined;
  const organizationId = asOptionalTrimmedString(body?.organizationId);
  const customerEmail = parseEmail(body?.customerEmail || null) || undefined;
  const country = asOptionalTrimmedString(body?.country)?.toUpperCase();
  const currency = asOptionalTrimmedString(body?.currency)?.toUpperCase();
  const amount = typeof body?.amount === 'number' ? body.amount : undefined;

  if (!paymentReference) {
    return NextResponse.json({ ok: false, error: 'paymentReference is required' }, { status: 400 });
  }

  if (!provider || !providerRaw) {
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
