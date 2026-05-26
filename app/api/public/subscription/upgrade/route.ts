import { NextRequest, NextResponse } from 'next/server';
import { prepareSubscriptionUpgrade } from '@/lib/commercialOnboarding';
import {
  asOptionalTrimmedString,
  enforceRateLimit,
  parseBillingInterval,
  parseEmail,
  parsePaymentProvider,
} from '@/lib/security/requestGuards';
import { recordIncomeEvent } from '@/lib/finance/automation';

function badRequest(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, 'public:subscription:upgrade');
  if (limited) return limited;

  const body = await req.json().catch(() => null);
  if (!body) return badRequest('Invalid JSON body.');

  const sessionId = asOptionalTrimmedString(body?.sessionId);
  const email = parseEmail(body?.email || null) || undefined;
  const selectedPlanId = asOptionalTrimmedString(body?.selectedPlanId);
  const billingIntervalRaw = asOptionalTrimmedString(body?.billingInterval)?.toUpperCase();
  const billingInterval = parseBillingInterval(body?.billingInterval) || undefined;
  const providerRaw = asOptionalTrimmedString(body?.provider)?.toUpperCase();
  const provider = providerRaw ? parsePaymentProvider(providerRaw) || undefined : undefined;
  const paymentReference = asOptionalTrimmedString(body?.paymentReference);

  if (!sessionId && !email) return badRequest('sessionId or email is required');
  if (billingIntervalRaw && !billingInterval) return badRequest('billingInterval must be MONTHLY or ANNUAL');
  if (providerRaw && !provider) return badRequest('provider must be one of PAYSTACK, FLUTTERWAVE, CUSTOM, STRIPE, PAYPAL');

  const appBaseUrl = process.env.MARVEO_APP_BASE_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  const result = await prepareSubscriptionUpgrade({
    sessionId,
    email,
    selectedPlanId,
    billingInterval,
    provider,
    paymentReference,
    appBaseUrl,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.reason }, { status: 404 });
  }

  await recordIncomeEvent({
    source: 'subscription_paid',
    sourceId: String(result.subscriptionId),
    amount: Number(result.amount || 0),
    currency: String(result.currency || 'USD'),
    reference: String(paymentReference || result.subscriptionId),
    description: `Subscription upgrade initiated for plan ${String(result.selectedPlanId || '')}`,
    status: 'pending',
    createdBy: 'system',
    category: 'subscriptions',
    clientId: email,
    transactionDate: new Date().toISOString(),
  });

  return NextResponse.json(result);
}
