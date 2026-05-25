import { NextRequest, NextResponse } from 'next/server';
import { findTemplateForPublicOnboarding, startPublicOnboarding } from '@/lib/commercialOnboarding';
import { sendPlatformEmailNotification } from '@/lib/emailNotifications';
import { recoverOnboardingByEmail } from '@/lib/onboarding/sessionRecovery';
import {
  asOptionalTrimmedString,
  asTrimmedString,
  enforceRateLimit,
  parseBillingInterval,
  parseEmail,
} from '@/lib/security/requestGuards';

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, 'public:onboarding:start');
  if (limited) return limited;

  const body = await req.json().catch(() => null);
  if (!body) return badRequest('Invalid JSON body.');

  const selectedPlanId = asTrimmedString(body?.selectedPlanId);
  const selectedTemplateId = asOptionalTrimmedString(body?.selectedTemplateId);
  const country = asTrimmedString(body?.country).toUpperCase();
  const currency = asOptionalTrimmedString(body?.currency)?.toUpperCase();
  const billingIntervalRaw = asTrimmedString(body?.billingInterval).toUpperCase();
  const billingInterval = parseBillingInterval(body?.billingInterval);
  const paymentModeRaw = asTrimmedString(body?.paymentMode).toUpperCase();
  const paymentMode = paymentModeRaw === 'PAID' ? 'PAID' : paymentModeRaw === 'TRIAL' ? 'TRIAL' : null;
  const paymentReference = asOptionalTrimmedString(body?.paymentReference);
  const source = asOptionalTrimmedString(body?.source) || 'marketing_website';

  const customer = body?.customer && typeof body.customer === 'object' ? body.customer : null;
  const email = parseEmail(customer?.email || null) || '';
  const name = asOptionalTrimmedString(customer?.name);
  const phone = asOptionalTrimmedString(customer?.phone);
  const company = asOptionalTrimmedString(customer?.company);

  if (!selectedPlanId) return badRequest('selectedPlanId is required');
  if (!country) return badRequest('country is required');
  if (!billingInterval || !billingIntervalRaw) return badRequest('billingInterval must be MONTHLY or ANNUAL');
  if (!paymentMode) return badRequest('paymentMode must be TRIAL or PAID');
  if (!email) return badRequest('customer.email is required');
  if (paymentMode === 'PAID' && !paymentReference) {
    return badRequest('paymentReference is required for PAID mode');
  }

  const recovery = await recoverOnboardingByEmail(email);
  if (recovery.status === 'completedWorkspace') {
    return NextResponse.json(
      {
        error: recovery.message,
        status: recovery.status,
        allowedActions: recovery.allowedActions,
        workspaceId: recovery.workspaceId,
        redirectPath: recovery.redirectPath,
      },
      { status: 409 },
    );
  }

  if (recovery.status === 'activeTrial' || recovery.status === 'pendingPayment' || recovery.status === 'incompleteOnboarding' || recovery.status === 'recoverableSession') {
    if (recovery.sessionId) {
      return NextResponse.json(
        {
          onboardingSessionId: recovery.sessionId,
          recoveryStatus: recovery.status,
          message: recovery.message,
          allowedActions: recovery.allowedActions,
          redirectUrl: `${(process.env.MARVEO_APP_BASE_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`).replace(/\/$/, '')}${recovery.redirectPath || `/setup/mvp?session=${encodeURIComponent(recovery.sessionId)}`}`,
        },
        { status: 200 },
      );
    }
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
