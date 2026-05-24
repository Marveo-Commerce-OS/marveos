import { NextRequest, NextResponse } from 'next/server';
import { getSession, getCurrentPlatformUser, isAdmin, isSuperAdmin } from '@/lib/auth';
import { PLATFORM_EMAIL_TEMPLATE_KEYS, appendAuditLog, readAdminStore, updateAdminStore } from '@/lib/adminStore';

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

const PAYMENT_PROVIDER_KEYS = ['PAYSTACK', 'FLUTTERWAVE', 'CUSTOM', 'STRIPE', 'PAYPAL'] as const;
const MARKET_KEYS = ['NG', 'GB', 'AE', 'CA', 'US', 'AFRICA_OTHER'] as const;
const CURRENCY_KEYS = ['USD', 'GBP', 'NGN'] as const;

function normalizeRecipientList(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const normalized = input.map((item) => String(item).trim().toLowerCase()).filter(Boolean);
  return Array.from(new Set(normalized));
}

async function ensureAdminSession() {
  const session = await getSession();
  if (!session) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const admin = await isAdmin(session.token);
  if (!admin) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { session };
}

export async function GET() {
  const auth = await ensureAdminSession();
  if ('error' in auth) return auth.error;

  const store = await readAdminStore();
  return NextResponse.json({
    accountPlan: store.cloud.accountPlan,
    platformSettings: store.platformSettings,
    trialDefaults: store.cloud.commercial.trialDefaults,
    supportOfficerPoolSize: Object.values(store.nativeAuth.identities).filter((identity) =>
      identity.roles.some((role) => role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'SUPPORT_OFFICER'),
    ).length,
  });
}

export async function PATCH(req: NextRequest) {
  const auth = await ensureAdminSession();
  if ('error' in auth) return auth.error;

  const canEdit = await isSuperAdmin(auth.session.token);
  if (!canEdit) {
    return NextResponse.json({ error: 'Only super admins can update system settings.' }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return badRequest('Invalid JSON body.');

  const accountPlan = typeof body.accountPlan === 'string' ? body.accountPlan : undefined;
  if (accountPlan && !['starter', 'business', 'enterprise'].includes(accountPlan)) {
    return badRequest('accountPlan must be starter, business, or enterprise.');
  }

  const trialDurationDays = Number(body.trialDurationDays);
  if (!Number.isFinite(trialDurationDays) || trialDurationDays < 1 || trialDurationDays > 365) {
    return badRequest('trialDurationDays must be between 1 and 365.');
  }

  const pricingVisibility = typeof body.pricingVisibility === 'string' ? body.pricingVisibility : '';
  if (pricingVisibility !== 'PUBLIC' && pricingVisibility !== 'INTERNAL') {
    return badRequest('pricingVisibility must be PUBLIC or INTERNAL.');
  }

  const regionalPricingEnabled = Boolean(body.regionalPricingEnabled);

  const paymentProvider = (body.paymentProvider && typeof body.paymentProvider === 'object')
    ? (body.paymentProvider as Record<string, unknown>)
    : {};
  const provider = typeof paymentProvider.provider === 'string' ? paymentProvider.provider : 'NONE';
  const mode = typeof paymentProvider.mode === 'string' ? paymentProvider.mode : 'sandbox';
  const configured = Boolean(paymentProvider.configured);
  const publishableKeyRef = typeof paymentProvider.publishableKeyRef === 'string' ? paymentProvider.publishableKeyRef.trim() : '';
  const secretKeyRef = typeof paymentProvider.secretKeyRef === 'string' ? paymentProvider.secretKeyRef.trim() : '';
  const webhookSecretRef = typeof paymentProvider.webhookSecretRef === 'string' ? paymentProvider.webhookSecretRef.trim() : '';
  const webhookUrl = typeof paymentProvider.webhookUrl === 'string' ? paymentProvider.webhookUrl.trim() : '';
  const webhookConfigured = Boolean(paymentProvider.webhookConfigured);
  const merchantDisplayName = typeof paymentProvider.merchantDisplayName === 'string'
    ? paymentProvider.merchantDisplayName.trim()
    : 'Marveo';
  const settlementCurrency = typeof paymentProvider.settlementCurrency === 'string'
    ? paymentProvider.settlementCurrency.trim().toUpperCase()
    : 'USD';
  const autoCapture = Boolean(paymentProvider.autoCapture);
  const require3DS = Boolean(paymentProvider.require3DS);

  if (!['NONE', 'PAYSTACK', 'STRIPE'].includes(provider)) {
    return badRequest('paymentProvider.provider must be NONE, PAYSTACK, or STRIPE.');
  }
  if (!['sandbox', 'live'].includes(mode)) {
    return badRequest('paymentProvider.mode must be sandbox or live.');
  }
  if (settlementCurrency && !/^[A-Z]{3}$/.test(settlementCurrency)) {
    return badRequest('paymentProvider.settlementCurrency must be a 3-letter ISO currency code.');
  }
  if (webhookUrl) {
    try {
      const parsed = new URL(webhookUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return badRequest('paymentProvider.webhookUrl must be http or https.');
      }
    } catch {
      return badRequest('paymentProvider.webhookUrl must be a valid URL.');
    }
  }

  const paymentProvidersPayload = (body.paymentProviders && typeof body.paymentProviders === 'object')
    ? (body.paymentProviders as Record<string, unknown>)
    : {};

  const paymentProviders = Object.fromEntries(
    PAYMENT_PROVIDER_KEYS.map((providerKey) => {
      const row = paymentProvidersPayload[providerKey];
      const obj = (row && typeof row === 'object') ? (row as Record<string, unknown>) : {};

      const modeRaw = String(obj.mode || 'sandbox').toLowerCase();
      const modeValue = modeRaw === 'live' ? 'live' : 'sandbox';

      const marketsRaw = Array.isArray(obj.applicableMarkets)
        ? obj.applicableMarkets.map((item) => String(item).trim().toUpperCase())
        : [];
      const applicableMarkets = Array.from(new Set(marketsRaw.filter((item) => MARKET_KEYS.includes(item as typeof MARKET_KEYS[number]))));

      const currenciesRaw = Array.isArray(obj.settlementCurrencies)
        ? obj.settlementCurrencies.map((item) => String(item).trim().toUpperCase())
        : [];
      const settlementCurrencies = Array.from(new Set(currenciesRaw.filter((item) => CURRENCY_KEYS.includes(item as typeof CURRENCY_KEYS[number]))));

      const priority = Number(obj.priority);
      const normalizedPriority = Number.isFinite(priority) && priority >= 1 && priority <= 99 ? priority : 1;

      return [providerKey, {
        enabled: Boolean(obj.enabled),
        configured: Boolean(obj.configured),
        mode: modeValue as 'sandbox' | 'live',
        priority: normalizedPriority,
        applicableMarkets,
        settlementCurrencies,
        publishableKeyRef: typeof obj.publishableKeyRef === 'string' ? obj.publishableKeyRef.trim() : '',
        secretKeyRef: typeof obj.secretKeyRef === 'string' ? obj.secretKeyRef.trim() : '',
        webhookSecretRef: typeof obj.webhookSecretRef === 'string' ? obj.webhookSecretRef.trim() : '',
        webhookUrl: typeof obj.webhookUrl === 'string' ? obj.webhookUrl.trim() : '',
        customEndpoint: typeof obj.customEndpoint === 'string' ? obj.customEndpoint.trim() : '',
      }];
    }),
  ) as Record<typeof PAYMENT_PROVIDER_KEYS[number], {
    enabled: boolean;
    configured: boolean;
    mode: 'sandbox' | 'live';
    priority: number;
    applicableMarkets: string[];
    settlementCurrencies: string[];
    publishableKeyRef: string;
    secretKeyRef: string;
    webhookSecretRef: string;
    webhookUrl: string;
    customEndpoint: string;
  }>;

  const billingCurrencyPolicy = (body.billingCurrencyPolicy && typeof body.billingCurrencyPolicy === 'object')
    ? (body.billingCurrencyPolicy as Record<string, unknown>)
    : {};

  const basePricingCurrency = String(billingCurrencyPolicy.basePricingCurrency || 'USD').trim().toUpperCase();
  if (!CURRENCY_KEYS.includes(basePricingCurrency as typeof CURRENCY_KEYS[number])) {
    return badRequest('billingCurrencyPolicy.basePricingCurrency must be USD, GBP, or NGN.');
  }

  const countryCurrencyMapInput = (billingCurrencyPolicy.countryCurrencyMap && typeof billingCurrencyPolicy.countryCurrencyMap === 'object')
    ? (billingCurrencyPolicy.countryCurrencyMap as Record<string, unknown>)
    : {};

  const countryCurrencyMap = Object.fromEntries(
    MARKET_KEYS.map((market) => {
      const currency = String(countryCurrencyMapInput[market] || 'USD').trim().toUpperCase();
      return [market, CURRENCY_KEYS.includes(currency as typeof CURRENCY_KEYS[number]) ? currency : 'USD'];
    }),
  ) as Record<typeof MARKET_KEYS[number], 'USD' | 'GBP' | 'NGN'>;

  const fxRatesInput = (billingCurrencyPolicy.fxRates && typeof billingCurrencyPolicy.fxRates === 'object')
    ? (billingCurrencyPolicy.fxRates as Record<string, unknown>)
    : {};

  const fxRates = {
    USD: Number(fxRatesInput.USD ?? 1),
    GBP: Number(fxRatesInput.GBP ?? 0.79),
    NGN: Number(fxRatesInput.NGN ?? 1550),
  };

  if (!Number.isFinite(fxRates.USD) || fxRates.USD <= 0) return badRequest('billingCurrencyPolicy.fxRates.USD must be a positive number.');
  if (!Number.isFinite(fxRates.GBP) || fxRates.GBP <= 0) return badRequest('billingCurrencyPolicy.fxRates.GBP must be a positive number.');
  if (!Number.isFinite(fxRates.NGN) || fxRates.NGN <= 0) return badRequest('billingCurrencyPolicy.fxRates.NGN must be a positive number.');

  const demoMode = (body.demoMode && typeof body.demoMode === 'object')
    ? (body.demoMode as Record<string, unknown>)
    : {};
  const templatePublishRules = (body.templatePublishRules && typeof body.templatePublishRules === 'object')
    ? (body.templatePublishRules as Record<string, unknown>)
    : {};
  const supportDefaults = (body.supportDefaults && typeof body.supportDefaults === 'object')
    ? (body.supportDefaults as Record<string, unknown>)
    : {};
  const branding = (body.branding && typeof body.branding === 'object')
    ? (body.branding as Record<string, unknown>)
    : {};

  const defaultPriority = typeof supportDefaults.defaultPriority === 'string' ? supportDefaults.defaultPriority : 'MEDIUM';
  const defaultSetupType = typeof supportDefaults.defaultSetupType === 'string' ? supportDefaults.defaultSetupType : 'NEW_WEBSITE';
  const defaultAssigneeId = typeof supportDefaults.defaultAssigneeId === 'string'
    ? supportDefaults.defaultAssigneeId.trim() || null
    : null;

  if (!['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(defaultPriority)) {
    return badRequest('supportDefaults.defaultPriority must be LOW, MEDIUM, HIGH, or CRITICAL.');
  }
  if (!['NEW_WEBSITE', 'EXISTING_WEBSITE', 'CUSTOM_HEADLESS'].includes(defaultSetupType)) {
    return badRequest('supportDefaults.defaultSetupType must be NEW_WEBSITE, EXISTING_WEBSITE, or CUSTOM_HEADLESS.');
  }

  const brandName = typeof branding.brandName === 'string' ? branding.brandName.trim() : 'Marveo';
  const brandByline = typeof branding.brandByline === 'string' ? branding.brandByline.trim() : '';
  const logoUrl = typeof branding.logoUrl === 'string' ? branding.logoUrl.trim() : '';
  const dashboardLogoUrl = typeof branding.dashboardLogoUrl === 'string' ? branding.dashboardLogoUrl.trim() : '';
  const portalLoginLogoUrl = typeof branding.portalLoginLogoUrl === 'string' ? branding.portalLoginLogoUrl.trim() : '';
  const faviconUrl = typeof branding.faviconUrl === 'string' ? branding.faviconUrl.trim() : '';
  const footerLogoUrl = typeof branding.footerLogoUrl === 'string' ? branding.footerLogoUrl.trim() : '';
  const primaryColor = typeof branding.primaryColor === 'string' ? branding.primaryColor.trim() : '#0f172a';
  const secondaryColor = typeof branding.secondaryColor === 'string' ? branding.secondaryColor.trim() : '#0ea5e9';
  const websiteUrl = typeof branding.websiteUrl === 'string' ? branding.websiteUrl.trim() : '';
  const footerAddressLine = typeof branding.footerAddressLine === 'string' ? branding.footerAddressLine.trim() : '';
  const footerDescription = typeof branding.footerDescription === 'string' ? branding.footerDescription.trim() : '';
  const footerBadgeText = typeof branding.footerBadgeText === 'string' ? branding.footerBadgeText.trim() : '';
  const footerStatusLabel = typeof branding.footerStatusLabel === 'string' ? branding.footerStatusLabel.trim() : '';
  const footerStatusUrl = typeof branding.footerStatusUrl === 'string' ? branding.footerStatusUrl.trim() : '';
  const footerDocsLabel = typeof branding.footerDocsLabel === 'string' ? branding.footerDocsLabel.trim() : '';
  const footerDocsUrl = typeof branding.footerDocsUrl === 'string' ? branding.footerDocsUrl.trim() : '';
  const footerGdprLabel = typeof branding.footerGdprLabel === 'string' ? branding.footerGdprLabel.trim() : '';
  const footerGdprUrl = typeof branding.footerGdprUrl === 'string' ? branding.footerGdprUrl.trim() : '';
  const footerUnsubscribeLabel = typeof branding.footerUnsubscribeLabel === 'string' ? branding.footerUnsubscribeLabel.trim() : '';
  const footerUnsubscribeUrl = typeof branding.footerUnsubscribeUrl === 'string' ? branding.footerUnsubscribeUrl.trim() : '';

  if (!/^#[0-9A-Fa-f]{6}$/.test(primaryColor)) {
    return badRequest('branding.primaryColor must be a 6-digit hex color (e.g. #0f172a).');
  }
  if (!/^#[0-9A-Fa-f]{6}$/.test(secondaryColor)) {
    return badRequest('branding.secondaryColor must be a 6-digit hex color (e.g. #0ea5e9).');
  }

  const trialDefaults = (body.trialDefaults && typeof body.trialDefaults === 'object')
    ? (body.trialDefaults as Record<string, unknown>)
    : {};
  const trialEnabled = Boolean(trialDefaults.trialEnabled);
  const trialDefaultDays = Number(trialDefaults.trialDurationDays);
  if (!Number.isFinite(trialDefaultDays) || trialDefaultDays < 1 || trialDefaultDays > 365) {
    return badRequest('trialDefaults.trialDurationDays must be between 1 and 365.');
  }

  const email = (body.email && typeof body.email === 'object')
    ? (body.email as Record<string, unknown>)
    : {};
  const emailProvider = String(email.provider || 'SMTP').toUpperCase();
  if (!['SMTP', 'WORDPRESS_MAILER'].includes(emailProvider)) {
    return badRequest('email.provider must be SMTP or WORDPRESS_MAILER.');
  }

  const emailPort = Number(email.port ?? 587);
  if (!Number.isFinite(emailPort) || emailPort < 1 || emailPort > 65535) {
    return badRequest('email.port must be between 1 and 65535.');
  }

  const emailTemplatesPayload = (body.emailTemplates && typeof body.emailTemplates === 'object')
    ? (body.emailTemplates as Record<string, unknown>)
    : {};

  const emailTemplates = Object.fromEntries(
    PLATFORM_EMAIL_TEMPLATE_KEYS.map((templateKey) => {
      const row = emailTemplatesPayload[templateKey];
      const obj = (row && typeof row === 'object') ? (row as Record<string, unknown>) : {};
      return [templateKey, {
        enabled: Boolean(obj.enabled),
        subject: typeof obj.subject === 'string' ? obj.subject.trim() : '',
        preheader: typeof obj.preheader === 'string' ? obj.preheader.trim() : '',
        html: typeof obj.html === 'string' ? obj.html : '',
        text: typeof obj.text === 'string' ? obj.text : '',
      }];
    }),
  ) as Record<typeof PLATFORM_EMAIL_TEMPLATE_KEYS[number], {
    enabled: boolean;
    subject: string;
    preheader: string;
    html: string;
    text: string;
  }>;

  let updated;
  try {
    updated = await updateAdminStore((current) => ({
      ...current,
      platformSettings: {
        ...current.platformSettings,
        trialDurationDays,
        pricingVisibility: pricingVisibility as 'PUBLIC' | 'INTERNAL',
        regionalPricingEnabled,
        paymentProvider: {
          provider: provider as 'NONE' | 'PAYSTACK' | 'STRIPE',
          mode: mode as 'sandbox' | 'live',
          configured,
          publishableKeyRef,
          secretKeyRef,
          webhookSecretRef,
          webhookUrl,
          webhookConfigured,
          merchantDisplayName: merchantDisplayName || 'Marveo',
          settlementCurrency: settlementCurrency || 'USD',
          autoCapture,
          require3DS,
        },
        paymentProviders,
        billingCurrencyPolicy: {
          basePricingCurrency: basePricingCurrency as 'USD' | 'GBP' | 'NGN',
          autoConvertFromBase: Boolean(billingCurrencyPolicy.autoConvertFromBase),
          countryCurrencyMap,
          fxRates,
        },
        demoMode: {
          enabled: Boolean(demoMode.enabled),
          allowOperationalMutations: Boolean(demoMode.allowOperationalMutations),
        },
        templatePublishRules: {
          requireArtifactValidation: Boolean(templatePublishRules.requireArtifactValidation),
          requireSupportApproval: Boolean(templatePublishRules.requireSupportApproval),
        },
        supportDefaults: {
          defaultPriority: defaultPriority as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
          defaultSetupType: defaultSetupType as 'NEW_WEBSITE' | 'EXISTING_WEBSITE' | 'CUSTOM_HEADLESS',
          defaultAssigneeId,
        },
        branding: {
          brandName: brandName || 'Marveo',
          brandByline,
          logoUrl,
          dashboardLogoUrl,
          portalLoginLogoUrl,
          faviconUrl,
          footerLogoUrl,
          primaryColor,
          secondaryColor,
          websiteUrl,
          footerAddressLine,
          footerDescription,
          footerBadgeText,
          footerStatusLabel,
          footerStatusUrl,
          footerDocsLabel,
          footerDocsUrl,
          footerGdprLabel,
          footerGdprUrl,
          footerUnsubscribeLabel,
          footerUnsubscribeUrl,
        },
        email: {
          enabled: Boolean(email.enabled),
          provider: emailProvider as 'SMTP' | 'WORDPRESS_MAILER',
          host: typeof email.host === 'string' ? email.host.trim() : '',
          port: emailPort,
          secure: Boolean(email.secure),
          username: typeof email.username === 'string' ? email.username.trim() : '',
          password: typeof email.password === 'string' ? email.password : '',
          fromEmail: typeof email.fromEmail === 'string' ? email.fromEmail.trim() : '',
          fromName: typeof email.fromName === 'string' ? email.fromName.trim() : '',
          replyToEmail: typeof email.replyToEmail === 'string' ? email.replyToEmail.trim() : '',
          appBaseUrl: typeof email.appBaseUrl === 'string' ? email.appBaseUrl.trim() : '',
          apiBaseUrl: typeof email.apiBaseUrl === 'string' ? email.apiBaseUrl.trim() : '',
          supportPortalUrl: typeof email.supportPortalUrl === 'string' ? email.supportPortalUrl.trim() : '',
          supportEmail: typeof email.supportEmail === 'string' ? email.supportEmail.trim() : '',
          billingEmail: typeof email.billingEmail === 'string' ? email.billingEmail.trim() : '',
          deploymentEmail: typeof email.deploymentEmail === 'string' ? email.deploymentEmail.trim() : '',
          userOpsEmail: typeof email.userOpsEmail === 'string' ? email.userOpsEmail.trim() : '',
          sendFailureAlerts: Boolean(email.sendFailureAlerts),
          failureAlertRecipients: normalizeRecipientList(email.failureAlertRecipients),
        },
        emailTemplates,
      },
      smtp: {
        ...current.smtp,
        useWordPressMailer: emailProvider === 'WORDPRESS_MAILER',
        host: typeof email.host === 'string' ? email.host.trim() : current.smtp.host,
        port: emailPort,
        secure: Boolean(email.secure),
        username: typeof email.username === 'string' ? email.username.trim() : current.smtp.username,
        password: typeof email.password === 'string' ? email.password : current.smtp.password,
        fromEmail: typeof email.fromEmail === 'string' ? email.fromEmail.trim() : current.smtp.fromEmail,
        fromName: typeof email.fromName === 'string' ? email.fromName.trim() : current.smtp.fromName,
      },
      cloud: {
        ...current.cloud,
        accountPlan: (accountPlan ?? current.cloud.accountPlan) as 'starter' | 'business' | 'enterprise',
        accountPlanUpdatedAt: new Date().toISOString(),
        commercial: {
          ...current.cloud.commercial,
          trialDefaults: {
            trialEnabled,
            trialDurationDays: trialDefaultDays,
          },
        },
      },
    }));
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : 'Invalid payment provider or currency policy payload.');
  }

  const actor = await getCurrentPlatformUser(auth.session.token);
  await appendAuditLog({
    actorEmail: actor?.email ?? String(auth.session.user?.user_email ?? 'unknown'),
    action: 'master.system_settings.updated',
    target: 'platform-settings',
    details: `Updated accountPlan=${updated.cloud.accountPlan}; trialDurationDays=${updated.platformSettings.trialDurationDays}; emailProvider=${updated.platformSettings.email.provider}`,
  });

  return NextResponse.json({
    ok: true,
    accountPlan: updated.cloud.accountPlan,
    platformSettings: updated.platformSettings,
    trialDefaults: updated.cloud.commercial.trialDefaults,
  });
}
