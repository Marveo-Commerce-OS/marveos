import { NextRequest, NextResponse } from 'next/server';
import { findTemplateForPublicOnboarding, startPublicOnboarding } from '@/lib/commercialOnboarding';
import { sendPlatformDirectEmail, sendPlatformEmailNotification } from '@/lib/emailNotifications';
import { buildBillingInvoicePdfBuffer, buildInvoiceEmailHtml } from '@/lib/billing/invoice';
import { readAdminStore, updateAdminStore } from '@/lib/adminStore';
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

  const store = await readAdminStore();
  const subscription = result.subscriptionId ? store.cloud.commercial.subscriptions[result.subscriptionId] : null;
  const plan = subscription ? store.cloud.commercial.plans.find((item) => item.id === subscription.planId) : null;
  const invoiceNumber = `MRV-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

  if (subscription && plan) {
    try {
      const pdfBuffer = await buildBillingInvoicePdfBuffer({
        invoiceNumber,
        customerName: name || company || email,
        customerEmail: email,
        organizationName: company || name || undefined,
        planName: plan.name,
        currency: subscription.currency,
        firstBillAmount: subscription.firstBillAmount ?? subscription.amount,
        firstBillSetupFee: subscription.firstBillSetupFee ?? subscription.setupFee,
        renewalAmount: subscription.renewalAmount,
        renewalSetupFee: subscription.renewalSetupFee,
        billingInterval: subscription.billingInterval,
        issuedAt: new Date().toISOString(),
        note: 'Your first bill may include an introductory offer. Future renewals use the standard renewal price shown here.',
        invoiceTitle: 'Marveo onboarding invoice',
      });

      await updateAdminStore((current) => {
        const now = new Date().toISOString();
        current.cloud.commercial.invoices[invoiceNumber] = {
          id: invoiceNumber,
          invoiceNumber,
          subscriptionId: subscription.id,
          organizationId: subscription.organizationId,
          identityId: subscription.identityId,
          planId: subscription.planId,
          customerEmail: email,
          customerName: name || company || undefined,
          currency: subscription.currency,
          amount: subscription.amount,
          billingInterval: subscription.billingInterval,
          billingType: subscription.paymentMode === 'TRIAL' ? 'FIRST_BILL' : 'FIRST_BILL',
          issuedAt: now,
          pdfFileName: `${invoiceNumber}.pdf`,
        };

        const nextSubscription = current.cloud.commercial.subscriptions[subscription.id];
        if (nextSubscription) {
          current.cloud.commercial.subscriptions[subscription.id] = {
            ...nextSubscription,
            lastInvoiceId: invoiceNumber,
            updatedAt: now,
          };
        }

        return current;
      });

      await sendPlatformDirectEmail({
        to: email,
        subject: `Marveo invoice ${invoiceNumber}`,
        html: buildInvoiceEmailHtml({
          invoiceNumber,
          planName: plan.name,
          firstBillAmount: subscription.firstBillAmount ?? subscription.amount,
          renewalAmount: subscription.renewalAmount,
          currency: subscription.currency,
          billingInterval: subscription.billingInterval,
          customerName: name || company || undefined,
        }),
        text: `Your Marveo invoice ${invoiceNumber} is attached. First bill: ${subscription.currency} ${subscription.firstBillAmount ?? subscription.amount}. Renewal price: ${subscription.currency} ${subscription.renewalAmount}.`,
        attachments: [
          {
            filename: `${invoiceNumber}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf',
          },
        ],
      });
    } catch (error) {
      // Invoice/notification failures should not block onboarding creation.
      console.error('[public-onboarding-start] invoice workflow failed', error);
    }
  }

  try {
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
  } catch (error) {
    // Email notification failures should not block onboarding creation.
    console.error('[public-onboarding-start] signup notification failed', error);
  }

  return NextResponse.json(result, { status: 201 });
}
