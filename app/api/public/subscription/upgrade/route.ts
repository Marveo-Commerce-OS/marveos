import { NextRequest, NextResponse } from 'next/server';
import { prepareSubscriptionUpgrade } from '@/lib/commercialOnboarding';

function badRequest(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return badRequest('Invalid JSON body.');

  const sessionId = body?.sessionId ? String(body.sessionId).trim() : undefined;
  const email = body?.email ? String(body.email).trim().toLowerCase() : undefined;
  const selectedPlanId = body?.selectedPlanId ? String(body.selectedPlanId).trim() : undefined;
  const billingIntervalRaw = body?.billingInterval ? String(body.billingInterval).trim().toUpperCase() : undefined;
  const billingInterval = billingIntervalRaw === 'ANNUAL' ? 'ANNUAL' : billingIntervalRaw === 'MONTHLY' ? 'MONTHLY' : undefined;
  const providerRaw = body?.provider ? String(body.provider).trim().toUpperCase() : undefined;
  const provider = providerRaw === 'PAYSTACK' || providerRaw === 'STRIPE' ? providerRaw : undefined;
  const paymentReference = body?.paymentReference ? String(body.paymentReference).trim() : undefined;

  if (!sessionId && !email) return badRequest('sessionId or email is required');
  if (billingIntervalRaw && !billingInterval) return badRequest('billingInterval must be MONTHLY or ANNUAL');
  if (providerRaw && !provider) return badRequest('provider must be PAYSTACK or STRIPE');

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

  return NextResponse.json(result);
}
