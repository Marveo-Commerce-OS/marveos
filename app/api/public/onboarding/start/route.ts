import { NextRequest, NextResponse } from 'next/server';
import { findTemplateForPublicOnboarding, startPublicOnboarding } from '@/lib/commercialOnboarding';
import { sendPlatformEmailNotification } from '@/lib/emailNotifications';

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return badRequest('Invalid JSON body.');

  const selectedPlanId = String(body?.selectedPlanId || '').trim();
  const selectedTemplateId = body?.selectedTemplateId ? String(body.selectedTemplateId).trim() : undefined;
  const country = String(body?.country || '').trim();
  const currency = body?.currency ? String(body.currency).trim() : undefined;
  const billingIntervalRaw = String(body?.billingInterval || '').trim().toUpperCase();
  const billingInterval = billingIntervalRaw === 'ANNUAL' ? 'ANNUAL' : billingIntervalRaw === 'MONTHLY' ? 'MONTHLY' : null;
  const paymentModeRaw = String(body?.paymentMode || '').trim().toUpperCase();
  const paymentMode = paymentModeRaw === 'PAID' ? 'PAID' : paymentModeRaw === 'TRIAL' ? 'TRIAL' : null;
  const paymentReference = body?.paymentReference ? String(body.paymentReference).trim() : undefined;
  const source = body?.source ? String(body.source).trim() : 'marketing_website';

  const customer = body?.customer && typeof body.customer === 'object' ? body.customer : null;
  const email = String(customer?.email || '').trim().toLowerCase();
  const name = customer?.name ? String(customer.name).trim() : undefined;
  const phone = customer?.phone ? String(customer.phone).trim() : undefined;
  const company = customer?.company ? String(customer.company).trim() : undefined;

  if (!selectedPlanId) return badRequest('selectedPlanId is required');
  if (!country) return badRequest('country is required');
  if (!billingInterval) return badRequest('billingInterval must be MONTHLY or ANNUAL');
  if (!paymentMode) return badRequest('paymentMode must be TRIAL or PAID');
  if (!email) return badRequest('customer.email is required');
  if (paymentMode === 'PAID' && !paymentReference) {
    return badRequest('paymentReference is required for PAID mode');
  }

  if (selectedTemplateId) {
    const template = await findTemplateForPublicOnboarding({
      selectedTemplateId,
      country,
      planId: selectedPlanId,
    });

    if (!template) {
      return badRequest('selectedTemplateId is not available for this plan, country, or website type');
    }
  }

  const appBaseUrl = process.env.MARVEO_APP_BASE_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;

  const result = await startPublicOnboarding({
    selectedPlanId,
    selectedTemplateId,
    country,
    currency,
    billingInterval,
    customer: { email, name, phone, company },
    paymentMode,
    paymentReference,
    source,
    appBaseUrl,
  });

  await sendPlatformEmailNotification({
    templateKey: 'CLIENT_SIGNUP',
    to: email,
    variables: {
      clientName: name || company || email,
      company: company || '',
      appBaseUrl,
      onboardingSessionId: result.onboardingSessionId || '',
      selectedPlanId,
      country,
    },
  });

  return NextResponse.json(result, { status: 201 });
}
