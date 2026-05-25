import {
  readAdminStore,
  type CommercialTemplateConfig,
  type CommercialTemplatePlanAvailability,
  type CommercialTemplateWebsiteType,
  updateAdminStore,
  type CommercialBillingInterval,
  type CommercialIdentity,
  type CommercialOnboardingSession,
  type CommercialPaymentProvider,
  type CommercialPlanConfig,
  type CommercialSubscription,
  type CommercialSubscriptionStatus,
} from '@/lib/adminStore';
import { verifyPaymentWithProvider } from '@/lib/payments';

const DEFAULT_MARKETING_SOURCE = 'marketing_website' as const;

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeCountry(country: string): string {
  return String(country || '').trim().toUpperCase() || 'US';
}

function normalizeMarket(country: string): 'NG' | 'GB' | 'AE' | 'CA' | 'US' | 'AFRICA_OTHER' {
  const normalized = normalizeCountry(country);
  if (normalized === 'NG') return 'NG';
  if (normalized === 'GB') return 'GB';
  if (normalized === 'AE') return 'AE';
  if (normalized === 'CA') return 'CA';
  if (normalized === 'US') return 'US';
  return 'AFRICA_OTHER';
}

function getCurrencyForCountry(country: string, countryCurrencyMap: Record<string, string>): string {
  const normalized = normalizeCountry(country);
  const market = normalizeMarket(normalized);
  return countryCurrencyMap[normalized] || countryCurrencyMap[market] || 'USD';
}

function convertAmount(value: number, fromCurrency: string, toCurrency: string, fxRates: { USD: number; GBP: number; NGN: number }): number {
  if (fromCurrency === toCurrency) return value;

  const fromRate = fxRates[fromCurrency as 'USD' | 'GBP' | 'NGN'];
  const toRate = fxRates[toCurrency as 'USD' | 'GBP' | 'NGN'];
  if (!fromRate || !toRate) return value;

  const valueInUsd = value / fromRate;
  const converted = valueInUsd * toRate;
  return Number(converted.toFixed(2));
}

function addDaysIso(baseIso: string, days: number): string {
  const base = new Date(baseIso);
  base.setDate(base.getDate() + days);
  return base.toISOString();
}

function normalizeBillingInterval(interval?: string): CommercialBillingInterval {
  return interval === 'ANNUAL' ? 'ANNUAL' : 'MONTHLY';
}

function pickRegionalPlanPrice(
  plan: CommercialPlanConfig,
  country: string,
  fallbackCurrency: string,
  conversionPolicy?: {
    basePricingCurrency: 'USD' | 'GBP' | 'NGN';
    fxRates: { USD: number; GBP: number; NGN: number };
  },
) {
  const normalizedCountry = normalizeCountry(country);
  const exact = plan.regions.find((item) => item.country === normalizedCountry);
  if (exact) return exact;

  const sameCurrency = plan.regions.find((item) => item.currency === fallbackCurrency);
  if (sameCurrency) return sameCurrency;

  const baseRegion = plan.regions.find((item) => item.currency === fallbackCurrency)
    || (conversionPolicy
      ? plan.regions.find((item) => item.currency === conversionPolicy.basePricingCurrency)
      : undefined)
    || plan.regions[0];

  if (baseRegion && conversionPolicy && baseRegion.currency !== fallbackCurrency) {
    return {
      ...baseRegion,
      country: normalizedCountry,
      currency: fallbackCurrency,
      monthly: {
        amount: convertAmount(baseRegion.monthly.amount, baseRegion.currency, fallbackCurrency, conversionPolicy.fxRates),
        setupFee: convertAmount(baseRegion.monthly.setupFee || 0, baseRegion.currency, fallbackCurrency, conversionPolicy.fxRates),
      },
      annual: {
        amount: convertAmount(baseRegion.annual.amount, baseRegion.currency, fallbackCurrency, conversionPolicy.fxRates),
        setupFee: convertAmount(baseRegion.annual.setupFee || 0, baseRegion.currency, fallbackCurrency, conversionPolicy.fxRates),
      },
      introductoryMonthly: {
        amount: convertAmount((baseRegion.introductoryMonthly?.amount ?? baseRegion.monthly.amount), baseRegion.currency, fallbackCurrency, conversionPolicy.fxRates),
        setupFee: convertAmount((baseRegion.introductoryMonthly?.setupFee ?? (baseRegion.monthly.setupFee || 0)), baseRegion.currency, fallbackCurrency, conversionPolicy.fxRates),
      },
      introductoryAnnual: {
        amount: convertAmount((baseRegion.introductoryAnnual?.amount ?? baseRegion.annual.amount), baseRegion.currency, fallbackCurrency, conversionPolicy.fxRates),
        setupFee: convertAmount((baseRegion.introductoryAnnual?.setupFee ?? (baseRegion.annual.setupFee || 0)), baseRegion.currency, fallbackCurrency, conversionPolicy.fxRates),
      },
    };
  }

  return baseRegion || {
    country: normalizedCountry,
    currency: fallbackCurrency,
    monthly: { amount: 0, setupFee: 0 },
    annual: { amount: 0, setupFee: 0 },
    introductoryMonthly: { amount: 0, setupFee: 0 },
    introductoryAnnual: { amount: 0, setupFee: 0 },
  };
}

function normalizePlanAvailability(planId?: string): CommercialTemplatePlanAvailability | undefined {
  const normalized = String(planId || '').trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === 'starter' || normalized === 'business' || normalized === 'growth' || normalized === 'enterprise') {
    return normalized;
  }
  return undefined;
}

function normalizeWebsiteType(value?: string): CommercialTemplateWebsiteType | undefined {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === 'NEW_WEBSITE' || normalized === 'EXISTING_WEBSITE' || normalized === 'CUSTOM_HEADLESS') {
    return normalized;
  }
  return undefined;
}

function mapTemplate(template: CommercialTemplateConfig) {
  return {
    templateId: template.templateId,
    name: template.name,
    slug: template.slug,
    businessType: template.businessType,
    sector: template.sector,
    category: template.category,
    description: template.description,
    previewImage: template.previewImage,
    status: template.status,
    visibility: template.visibility,
    supportedWebsiteTypes: template.supportedWebsiteTypes,
    supportedStacks: template.supportedStacks,
    planAvailability: template.planAvailability,
    countryAvailability: template.countryAvailability,
    featureModules: template.featureModules,
    requiresSupport: template.requiresSupport,
    repoSource: template.repoSource,
    repoPath: template.repoPath,
    version: template.version,
    artifactStatus: template.artifactStatus,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
    manifest: template.preview
      ? {
          tagline: template.preview.tagline,
          palette: template.preview.palette,
          typography: template.preview.typography,
          routes: template.preview.routes,
        }
      : undefined,
  };
}

function isTemplateVisibleForFilter(template: CommercialTemplateConfig, filter: {
  status?: string;
  visibility?: string;
  websiteType?: string;
  country?: string;
  planId?: string;
}) {
  const status = String(filter.status || '').trim().toUpperCase();
  const visibility = String(filter.visibility || '').trim().toUpperCase();
  const websiteType = normalizeWebsiteType(filter.websiteType);
  const country = String(filter.country || '').trim().toUpperCase();
  const plan = normalizePlanAvailability(filter.planId);

  if (status && template.status !== status) return false;
  if (visibility && template.visibility !== visibility) return false;
  if (websiteType && !template.supportedWebsiteTypes.includes(websiteType)) return false;

  if (country && Array.isArray(template.countryAvailability) && template.countryAvailability.length > 0) {
    if (!template.countryAvailability.includes(country)) return false;
  }

  if (plan && !template.planAvailability.includes('all') && !template.planAvailability.includes(plan)) return false;

  // Public template API must not expose unmapped artifacts unless the template is explicitly support/manual-driven.
  if (template.status === 'ACTIVE' && template.visibility === 'PUBLIC') {
    const hasArtifact = template.artifactStatus === 'FOUND';
    const supportAllowed = template.requiresSupport;
    if (!hasArtifact && !supportAllowed) return false;
  }

  return true;
}

function findIdentityByEmail(identities: Record<string, CommercialIdentity>, email: string): CommercialIdentity | null {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  const existing = Object.values(identities).find((item) => item.email.toLowerCase() === normalized);
  return existing || null;
}

function normalizePhoneKey(value?: string): string {
  return String(value || '').replace(/\D+/g, '');
}

function normalizeCompanyKey(value?: string): string {
  return String(value || '').trim().toLowerCase();
}

function findIdentityByContact(
  identities: Record<string, CommercialIdentity>,
  contact: {
    email: string;
    phone?: string;
    company?: string;
  },
) {
  const normalizedEmail = contact.email.trim().toLowerCase();
  const normalizedPhone = normalizePhoneKey(contact.phone);
  const normalizedCompany = normalizeCompanyKey(contact.company);

  return Object.values(identities).find((identity) => {
    if (identity.email.trim().toLowerCase() === normalizedEmail) return true;
    if (normalizedPhone && normalizePhoneKey(identity.phone) === normalizedPhone) return true;
    if (normalizedCompany && normalizeCompanyKey(identity.company) === normalizedCompany) return true;
    return false;
  }) || null;
}

function buildBillingPeriodEndAt(startIso: string, interval: CommercialBillingInterval): string {
  return interval === 'ANNUAL' ? addDaysIso(startIso, 365) : addDaysIso(startIso, 30);
}

function resolvePlanBillingAmount(params: {
  plan: CommercialPlanConfig;
  country: string;
  fallbackCurrency: string;
  billingInterval: CommercialBillingInterval;
  firstBill: boolean;
  conversionPolicy?: {
    basePricingCurrency: 'USD' | 'GBP' | 'NGN';
    fxRates: { USD: number; GBP: number; NGN: number };
  };
}) {
  const pricing = pickRegionalPlanPrice(params.plan, params.country, params.fallbackCurrency, params.conversionPolicy);
  const intervalPricing = params.billingInterval === 'ANNUAL' ? pricing.annual : pricing.monthly;
  const introductoryPricing = params.billingInterval === 'ANNUAL'
    ? pricing.introductoryAnnual || pricing.annual
    : pricing.introductoryMonthly || pricing.monthly;

  return {
    region: pricing,
    renewalPricing: intervalPricing,
    firstBillPricing: params.firstBill ? introductoryPricing : intervalPricing,
  };
}

function isSubscriptionEntitled(status: CommercialSubscriptionStatus): boolean {
  return status === 'TRIAL' || status === 'ACTIVE';
}

function expectedProviderForCountry(country: string, store?: Awaited<ReturnType<typeof readAdminStore>>): CommercialPaymentProvider {
  if (!store) {
    return normalizeCountry(country) === 'NG' ? 'PAYSTACK' : 'STRIPE';
  }

  const market = normalizeMarket(country);
  const configured = Object.entries(store.platformSettings.paymentProviders)
    .filter(([, config]) => config.enabled && config.configured && config.applicableMarkets.includes(market))
    .sort((a, b) => a[1].priority - b[1].priority);

  if (configured.length > 0) {
    return configured[0][0] as CommercialPaymentProvider;
  }

  return normalizeCountry(country) === 'NG' ? 'PAYSTACK' : 'STRIPE';
}

function refreshSubscriptionLifecycleState(subscription: CommercialSubscription, currentTime = new Date()): CommercialSubscription {
  if (
    subscription.status === 'TRIAL'
    && subscription.trialEndDate
    && new Date(subscription.trialEndDate).getTime() < currentTime.getTime()
  ) {
    return {
      ...subscription,
      status: 'EXPIRED',
      updatedAt: nowIso(),
    };
  }

  return subscription;
}

function buildRedirectUrl(appBaseUrl: string, sessionId: string): string {
  return `${appBaseUrl.replace(/\/$/, '')}/setup/mvp?session=${encodeURIComponent(sessionId)}`;
}

function getIntervalPrice(
  plan: CommercialPlanConfig,
  country: string,
  fallbackCurrency: string,
  billingInterval: CommercialBillingInterval,
  conversionPolicy?: {
    basePricingCurrency: 'USD' | 'GBP' | 'NGN';
    fxRates: { USD: number; GBP: number; NGN: number };
  },
) {
  const pricing = pickRegionalPlanPrice(plan, country, fallbackCurrency, conversionPolicy);
  return {
    region: pricing,
    intervalPrice: billingInterval === 'ANNUAL' ? pricing.annual : pricing.monthly,
  };
}

export async function getPublicPlans(country: string) {
  const store = await readAdminStore();
  const normalizedCountry = normalizeCountry(country);
  const effectiveCountryCurrencyMap = {
    ...store.cloud.commercial.countryCurrencyMap,
    ...store.platformSettings.billingCurrencyPolicy.countryCurrencyMap,
  };
  const conversionPolicy = store.platformSettings.billingCurrencyPolicy;
  const currency = getCurrencyForCountry(normalizedCountry, effectiveCountryCurrencyMap);
  const activePlans = store.cloud.commercial.plans.filter((plan) => plan.active !== false);

  return {
    country: normalizedCountry,
    currency,
    plans: activePlans.map((plan) => {
      const pricing = pickRegionalPlanPrice(plan, normalizedCountry, currency, conversionPolicy);
      return {
        planId: plan.id,
        name: plan.name,
        description: plan.description,
        paymentProvider: expectedProviderForCountry(normalizedCountry, store),
        pricing: {
          country: pricing.country,
          currency: pricing.currency,
          renewal: {
            monthly: {
              amount: pricing.monthly.amount,
              setupFee: pricing.monthly.setupFee || 0,
            },
            annual: {
              amount: pricing.annual.amount,
              setupFee: pricing.annual.setupFee || 0,
            },
          },
          firstBill: {
            monthly: {
              amount: pricing.introductoryMonthly?.amount ?? pricing.monthly.amount,
              setupFee: pricing.introductoryMonthly?.setupFee ?? pricing.monthly.setupFee ?? 0,
            },
            annual: {
              amount: pricing.introductoryAnnual?.amount ?? pricing.annual.amount,
              setupFee: pricing.introductoryAnnual?.setupFee ?? pricing.annual.setupFee ?? 0,
            },
          },
          annualDiscountPercent: pricing.annualDiscountPercent,
          billingNote: 'After the first bill, the subscription renews at the standard price shown in the renewal section.',
        },
        trial: {
          available: plan.trialEnabled,
          durationDays: plan.trialDurationDays ?? store.cloud.commercial.trialDefaults.trialDurationDays,
        },
        workspaceLimits: {
          maxWorkspaces: plan.workspaceLimit,
        },
        featureEntitlements: plan.featureEntitlements,
      };
    }),
  };
}

export async function getPublicTemplates(filter: {
  status?: string;
  visibility?: string;
  websiteType?: string;
  country?: string;
  planId?: string;
} = {}) {
  const store = await readAdminStore();
  const effectiveFilter = {
    ...filter,
    status: 'ACTIVE',
    visibility: 'PUBLIC',
  };

  const templates = store.cloud.commercial.templates
    .filter((template) => isTemplateVisibleForFilter(template, effectiveFilter))
    .map((template) => mapTemplate(template));

  return {
    filters: {
      status: effectiveFilter.status,
      visibility: effectiveFilter.visibility,
      websiteType: filter.websiteType || null,
      country: filter.country || null,
      planId: filter.planId || null,
    },
    templates,
  };
}

export async function findTemplateForPublicOnboarding(payload: {
  selectedTemplateId: string;
  country?: string;
  planId?: string;
}) {
  const store = await readAdminStore();
  const templateId = payload.selectedTemplateId.trim();
  const template = store.cloud.commercial.templates.find((item) => item.templateId === templateId);
  if (!template) return null;

  const visible = isTemplateVisibleForFilter(template, {
    status: 'ACTIVE',
    visibility: 'PUBLIC',
    websiteType: 'NEW_WEBSITE',
    country: payload.country,
    planId: payload.planId,
  });

  return visible ? mapTemplate(template) : null;
}

export async function startPublicOnboarding(payload: {
  selectedPlanId: string;
  selectedTemplateId?: string;
  country: string;
  currency?: string;
  billingInterval: CommercialBillingInterval;
  customer: {
    email: string;
    name?: string;
    phone?: string;
    company?: string;
  };
  paymentMode: 'TRIAL' | 'PAID';
  paymentProvider?: CommercialPaymentProvider;
  paymentReference?: string;
  source?: string;
  appBaseUrl: string;
}) {
  const result = await updateAdminStore((current) => {
    const now = nowIso();
    const email = payload.customer.email.trim().toLowerCase();
    const normalizedCountry = normalizeCountry(payload.country);
    const billingInterval = normalizeBillingInterval(payload.billingInterval);

    const activePlans = current.cloud.commercial.plans.filter((plan) => plan.active !== false);
    const selectedPlan = activePlans.find((plan) => plan.id === payload.selectedPlanId)
      || activePlans[0]
      || current.cloud.commercial.plans[0];
    const effectiveCountryCurrencyMap = {
      ...current.cloud.commercial.countryCurrencyMap,
      ...current.platformSettings.billingCurrencyPolicy.countryCurrencyMap,
    };
    const fallbackCurrency = payload.currency || getCurrencyForCountry(normalizedCountry, effectiveCountryCurrencyMap);
    const matchedIdentity = findIdentityByContact(current.cloud.commercial.identities, {
      email,
      phone: payload.customer.phone,
      company: payload.customer.company,
    });
    const isFirstTimeCustomer = !matchedIdentity;
    const { region: selectedPrice, renewalPricing, firstBillPricing } = resolvePlanBillingAmount({
      plan: selectedPlan,
      country: normalizedCountry,
      fallbackCurrency,
      billingInterval,
      firstBill: isFirstTimeCustomer,
      conversionPolicy: current.platformSettings.billingCurrencyPolicy,
    });
    const selectedIntervalPrice = firstBillPricing;
    const renewalIntervalPrice = renewalPricing;

    let identity = matchedIdentity;
    if (!identity) {
      identity = {
        id: makeId('identity'),
        email,
        name: payload.customer.name?.trim() || undefined,
        phone: payload.customer.phone?.trim() || undefined,
        company: payload.customer.company?.trim() || undefined,
        createdAt: now,
        updatedAt: now,
      };
      current.cloud.commercial.identities[identity.id] = identity;
    } else {
      identity = {
        ...identity,
        name: payload.customer.name?.trim() || identity.name,
        phone: payload.customer.phone?.trim() || identity.phone,
        company: payload.customer.company?.trim() || identity.company,
        updatedAt: now,
      };
      current.cloud.commercial.identities[identity.id] = identity;
    }

    const orgName = payload.customer.company?.trim() || payload.customer.name?.trim() || email;
    const existingOrg = Object.values(current.cloud.commercial.organizations).find((org) => org.ownerIdentityId === identity.id);
    const organization = existingOrg
      ? {
          ...existingOrg,
          name: orgName || existingOrg.name,
          country: normalizedCountry,
          preferredBillingInterval: billingInterval,
          updatedAt: now,
        }
      : {
          id: makeId('org'),
          name: orgName || 'Marveo Organization',
          ownerIdentityId: identity.id,
          country: normalizedCountry,
          preferredBillingInterval: billingInterval,
          createdAt: now,
          updatedAt: now,
        };

    current.cloud.commercial.organizations[organization.id] = organization;

    const trialDays = selectedPlan.trialDurationDays ?? current.cloud.commercial.trialDefaults.trialDurationDays;
    const trialAllowed = selectedPlan.trialEnabled && current.cloud.commercial.trialDefaults.trialEnabled;
    const useTrial = payload.paymentMode === 'TRIAL' && trialAllowed;
    const billingPeriodEndAt = useTrial ? addDaysIso(now, trialDays) : buildBillingPeriodEndAt(now, billingInterval);
    const paymentProvider = payload.paymentMode === 'PAID'
      ? (payload.paymentProvider || expectedProviderForCountry(normalizedCountry, current))
      : undefined;

    const subscription: CommercialSubscription = {
      id: makeId('sub'),
      organizationId: organization.id,
      identityId: identity.id,
      planId: selectedPlan.id,
      country: normalizedCountry,
      currency: selectedPrice.currency,
      amount: selectedIntervalPrice.amount,
      setupFee: selectedIntervalPrice.setupFee || 0,
      renewalAmount: renewalIntervalPrice.amount,
      renewalSetupFee: renewalIntervalPrice.setupFee || 0,
      firstBillAmount: selectedIntervalPrice.amount,
      firstBillSetupFee: selectedIntervalPrice.setupFee || 0,
      billingInterval,
      intendedBillingInterval: billingInterval,
      billingPeriodStartAt: now,
      billingPeriodEndAt,
      status: useTrial ? 'TRIAL' : 'PAST_DUE',
      paymentReference: payload.paymentReference?.trim() || undefined,
      paymentProvider,
      paymentMode: payload.paymentMode,
      paymentVerificationStatus: useTrial ? 'NOT_REQUIRED' : 'PENDING',
      paymentVerifiedAt: undefined,
      trialEnabled: trialAllowed,
      trialDurationDays: useTrial ? trialDays : undefined,
      trialStartDate: useTrial ? now : undefined,
      trialEndDate: useTrial ? addDaysIso(now, trialDays) : undefined,
      createdAt: now,
      updatedAt: now,
    };

    current.cloud.commercial.subscriptions[subscription.id] = subscription;

    const onboardingSession: CommercialOnboardingSession = {
      id: makeId('onboarding'),
      identityId: identity.id,
      organizationId: organization.id,
      subscriptionId: subscription.id,
      selectedPlanId: selectedPlan.id,
      selectedTemplateId: payload.selectedTemplateId?.trim() || undefined,
      billingInterval,
      expiresAt: addDaysIso(now, 2),
      createdAt: now,
      updatedAt: now,
      source: payload.source === 'internal' ? 'internal' : DEFAULT_MARKETING_SOURCE,
    };

    current.cloud.commercial.onboardingSessions[onboardingSession.id] = onboardingSession;

    return {
      ...current,
    };
  });

  const commercial = result.cloud.commercial;
  const latestSession = Object.values(commercial.onboardingSessions).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const latestSubscription = latestSession ? commercial.subscriptions[latestSession.subscriptionId] : null;
  const redirectUrl = buildRedirectUrl(payload.appBaseUrl, latestSession?.id || '');

  return {
    onboardingSessionId: latestSession?.id,
    identityId: latestSession?.identityId,
    organizationId: latestSession?.organizationId,
    subscriptionId: latestSession?.subscriptionId,
    subscriptionStatus: latestSubscription?.status,
    billingInterval: latestSubscription?.billingInterval,
    paymentVerificationStatus: latestSubscription?.paymentVerificationStatus,
    amountDueNow: latestSubscription?.amount,
    firstBillAmount: latestSubscription?.firstBillAmount ?? latestSubscription?.amount,
    renewalAmount: latestSubscription?.renewalAmount,
    currency: latestSubscription?.currency,
    redirectUrl,
  };
}

export async function verifyPayment(payload: {
  provider: CommercialPaymentProvider;
  paymentReference: string;
  selectedPlanId?: string;
  billingInterval?: CommercialBillingInterval;
  organizationId?: string;
  onboardingSessionId?: string;
  customerEmail?: string;
  country?: string;
  currency?: string;
  amount?: number;
  appBaseUrl: string;
}) {
  const paymentReference = payload.paymentReference.trim();
  if (!paymentReference) {
    return { ok: false, reason: 'payment reference is required' };
  }

  const normalizedEmail = payload.customerEmail?.trim().toLowerCase();
  const expectedCountry = payload.country ? normalizeCountry(payload.country) : undefined;
  const expectedBillingInterval = payload.billingInterval ? normalizeBillingInterval(payload.billingInterval) : undefined;

  let updatedSubscription: CommercialSubscription | null = null;
  let onboardingSession: CommercialOnboardingSession | null = null;
  let verificationFailure = '';

  await updateAdminStore((current) => {
    const refreshedSubscriptions = Object.fromEntries(
      Object.entries(current.cloud.commercial.subscriptions).map(([key, subscription]) => [
        key,
        refreshSubscriptionLifecycleState(subscription),
      ]),
    );
    current.cloud.commercial.subscriptions = refreshedSubscriptions;

    const match = Object.values(current.cloud.commercial.subscriptions).find((subscription) => {
      if (subscription.paymentReference !== paymentReference) return false;
      if (subscription.paymentMode !== 'PAID') return false;
      if (subscription.paymentProvider !== payload.provider) return false;
      if (payload.selectedPlanId && subscription.planId !== payload.selectedPlanId) return false;
      if (expectedBillingInterval && subscription.billingInterval !== expectedBillingInterval) return false;
      if (payload.organizationId && subscription.organizationId !== payload.organizationId) return false;
      if (payload.onboardingSessionId) {
        const linkedSession = current.cloud.commercial.onboardingSessions[payload.onboardingSessionId];
        if (!linkedSession || linkedSession.subscriptionId !== subscription.id) return false;
      }
      if (normalizedEmail) {
        const identity = current.cloud.commercial.identities[subscription.identityId];
        if (!identity || identity.email.toLowerCase() !== normalizedEmail) return false;
      }
      if (expectedCountry && normalizeCountry(subscription.country) !== expectedCountry) return false;
      if (payload.currency && subscription.currency !== payload.currency) return false;
      if (typeof payload.amount === 'number' && subscription.amount !== payload.amount) return false;
      return true;
    });

    if (!match) {
      verificationFailure = 'matching paid subscription not found';
      return current;
    }

    updatedSubscription = match;
    onboardingSession = Object.values(current.cloud.commercial.onboardingSessions)
      .filter((session) => session.subscriptionId === match.id)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] || null;

    return {
      ...current,
    };
  });

  if (!updatedSubscription) {
    return { ok: false, reason: verificationFailure || 'payment reference not found' };
  }

  const candidateSubscription = updatedSubscription as CommercialSubscription;
  const candidateOnboardingSession = onboardingSession as CommercialOnboardingSession | null;
  const providerVerification = await verifyPaymentWithProvider({
    provider: payload.provider,
    reference: paymentReference,
    expectedAmount: candidateSubscription.amount,
    expectedCurrency: candidateSubscription.currency,
    expectedCustomerEmail: normalizedEmail,
    expectedMetadata: {
      organizationId: candidateSubscription.organizationId,
      ...(payload.onboardingSessionId ? { onboardingSessionId: payload.onboardingSessionId } : {}),
      ...(payload.selectedPlanId ? { selectedPlanId: payload.selectedPlanId } : {}),
    },
  });

  if (!providerVerification.ok) {
    await updateAdminStore((current) => {
      const subscription = current.cloud.commercial.subscriptions[candidateSubscription.id];
      if (!subscription) return current;
      return {
        ...current,
        cloud: {
          ...current.cloud,
          commercial: {
            ...current.cloud.commercial,
            subscriptions: {
              ...current.cloud.commercial.subscriptions,
              [subscription.id]: {
                ...subscription,
                paymentVerificationStatus: 'FAILED',
                updatedAt: nowIso(),
              },
            },
          },
        },
      };
    });

    return { ok: false, reason: providerVerification.reason || 'provider verification failed' };
  }

  await updateAdminStore((current) => {
    const subscription = current.cloud.commercial.subscriptions[candidateSubscription.id];
    if (!subscription) return current;

    const next: CommercialSubscription = {
      ...subscription,
      status: 'ACTIVE',
      paymentVerificationStatus: 'VERIFIED',
      paymentVerifiedAt: nowIso(),
      updatedAt: nowIso(),
    };

    const active = Object.values(current.cloud.commercial.onboardingSessions)
      .filter((session) => session.subscriptionId === next.id)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] || null;

    return {
      ...current,
      cloud: {
        ...current.cloud,
        commercial: {
          ...current.cloud.commercial,
          subscriptions: {
            ...current.cloud.commercial.subscriptions,
            [next.id]: next,
          },
          onboardingSessions: active
            ? {
                ...current.cloud.commercial.onboardingSessions,
                [active.id]: {
                  ...active,
                  expiresAt: addDaysIso(nowIso(), 2),
                  updatedAt: nowIso(),
                },
              }
            : current.cloud.commercial.onboardingSessions,
        },
      },
    };
  });

  const refreshed = await readAdminStore();
  const verifiedSubscription = refreshed.cloud.commercial.subscriptions[candidateSubscription.id] || candidateSubscription;
  const activeOnboardingSession = Object.values(refreshed.cloud.commercial.onboardingSessions)
    .filter((session) => session.subscriptionId === candidateSubscription.id)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] || candidateOnboardingSession;

  return {
    ok: true,
    subscriptionId: verifiedSubscription.id,
    status: verifiedSubscription.status,
    paymentVerificationStatus: verifiedSubscription.paymentVerificationStatus,
    billingInterval: verifiedSubscription.billingInterval,
    redirectUrl: activeOnboardingSession
      ? buildRedirectUrl(payload.appBaseUrl, activeOnboardingSession.id)
      : null,
  };
}

export async function prepareSubscriptionUpgrade(payload: {
  sessionId?: string;
  email?: string;
  selectedPlanId?: string;
  billingInterval?: CommercialBillingInterval;
  provider?: CommercialPaymentProvider;
  paymentReference?: string;
  appBaseUrl: string;
}) {
  const normalizedEmail = payload.email?.trim().toLowerCase();
  const requestedInterval = payload.billingInterval ? normalizeBillingInterval(payload.billingInterval) : undefined;
  const paymentReference = payload.paymentReference?.trim() || undefined;
  let result:
    | {
        subscription: CommercialSubscription;
        session: CommercialOnboardingSession;
      }
    | null = null;

  await updateAdminStore((current) => {
    const existingSession = payload.sessionId
      ? current.cloud.commercial.onboardingSessions[payload.sessionId] || null
      : null;

    const identity = normalizedEmail
      ? Object.values(current.cloud.commercial.identities).find((item) => item.email.toLowerCase() === normalizedEmail) || null
      : existingSession
        ? current.cloud.commercial.identities[existingSession.identityId] || null
        : null;

    const existingSubscription = existingSession
      ? current.cloud.commercial.subscriptions[existingSession.subscriptionId] || null
      : identity
        ? Object.values(current.cloud.commercial.subscriptions)
            .filter((item) => item.identityId === identity.id)
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] || null
        : null;

    if (!existingSubscription) return current;

    const activePlans = current.cloud.commercial.plans.filter((plan) => plan.active !== false);
    const selectedPlan = activePlans.find((plan) => plan.id === (payload.selectedPlanId || existingSubscription.planId))
      || activePlans.find((plan) => plan.id === existingSubscription.planId)
      || activePlans[0]
      || current.cloud.commercial.plans[0];

    const billingInterval = requestedInterval || existingSubscription.intendedBillingInterval || existingSubscription.billingInterval;
    const effectiveCountryCurrencyMap = {
      ...current.cloud.commercial.countryCurrencyMap,
      ...current.platformSettings.billingCurrencyPolicy.countryCurrencyMap,
    };
    const fallbackCurrency = getCurrencyForCountry(existingSubscription.country, effectiveCountryCurrencyMap);
    const { region, intervalPrice } = getIntervalPrice(
      selectedPlan,
      existingSubscription.country,
      fallbackCurrency,
      billingInterval,
      current.platformSettings.billingCurrencyPolicy,
    );
    const paymentProvider = payload.provider || expectedProviderForCountry(existingSubscription.country, current);

    const upgradedSubscription: CommercialSubscription = {
      ...existingSubscription,
      planId: selectedPlan.id,
      currency: region.currency,
      amount: intervalPrice.amount,
      setupFee: intervalPrice.setupFee || 0,
      billingInterval,
      intendedBillingInterval: billingInterval,
      paymentProvider,
      paymentReference,
      paymentMode: 'PAID',
      paymentVerificationStatus: 'PENDING',
      paymentVerifiedAt: undefined,
      status: 'PAST_DUE',
      updatedAt: nowIso(),
    };

    current.cloud.commercial.subscriptions[upgradedSubscription.id] = upgradedSubscription;

    const session = existingSession || Object.values(current.cloud.commercial.onboardingSessions)
      .filter((item) => item.subscriptionId === upgradedSubscription.id)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
      || {
        id: makeId('onboarding'),
        identityId: upgradedSubscription.identityId,
        organizationId: upgradedSubscription.organizationId,
        subscriptionId: upgradedSubscription.id,
        selectedPlanId: upgradedSubscription.planId,
        billingInterval,
        expiresAt: addDaysIso(nowIso(), 2),
        createdAt: nowIso(),
        updatedAt: nowIso(),
        source: DEFAULT_MARKETING_SOURCE,
      };

    const refreshedSession: CommercialOnboardingSession = {
      ...session,
      selectedPlanId: upgradedSubscription.planId,
      billingInterval,
      expiresAt: addDaysIso(nowIso(), 2),
      updatedAt: nowIso(),
    };

    current.cloud.commercial.onboardingSessions[refreshedSession.id] = refreshedSession;

    result = {
      subscription: upgradedSubscription,
      session: refreshedSession,
    };

    return {
      ...current,
    };
  });

  const resolvedResult = result as
    | {
        subscription: CommercialSubscription;
        session: CommercialOnboardingSession;
      }
    | null;

  if (!resolvedResult) {
    return { ok: false, reason: 'subscription not found for upgrade' };
  }

  return {
    ok: true,
    subscriptionId: resolvedResult.subscription.id,
    organizationId: resolvedResult.subscription.organizationId,
    selectedPlanId: resolvedResult.subscription.planId,
    billingInterval: resolvedResult.subscription.billingInterval,
    intendedBillingInterval: resolvedResult.subscription.intendedBillingInterval,
    provider: resolvedResult.subscription.paymentProvider,
    currency: resolvedResult.subscription.currency,
    amount: resolvedResult.subscription.amount,
    paymentVerificationStatus: resolvedResult.subscription.paymentVerificationStatus,
    redirectUrl: buildRedirectUrl(payload.appBaseUrl, resolvedResult.session.id),
    requiresPaymentVerification: true,
  };
}

export async function recoverOnboardingSession(payload: {
  sessionId?: string;
  email?: string;
  appBaseUrl: string;
}) {
  const normalizedEmail = payload.email?.trim().toLowerCase();
  const now = new Date();
  let recoveryResult: {
    sessionId: string;
    redirectUrl: string;
    selectedPlanId: string;
    selectedTemplateId?: string;
    subscription: CommercialSubscription;
    status: 'RECOVERED' | 'REFRESHED';
  } | null = null;

  await updateAdminStore((current) => {
    const refreshedSubscriptions = Object.fromEntries(
      Object.entries(current.cloud.commercial.subscriptions).map(([key, subscription]) => [
        key,
        refreshSubscriptionLifecycleState(subscription, now),
      ]),
    );
    current.cloud.commercial.subscriptions = refreshedSubscriptions;

    const existingSession = payload.sessionId
      ? current.cloud.commercial.onboardingSessions[payload.sessionId] || null
      : null;

    const identity = normalizedEmail
      ? Object.values(current.cloud.commercial.identities).find((item) => item.email.toLowerCase() === normalizedEmail) || null
      : existingSession
        ? current.cloud.commercial.identities[existingSession.identityId] || null
        : null;

    const subscription = existingSession
      ? current.cloud.commercial.subscriptions[existingSession.subscriptionId] || null
      : identity
        ? Object.values(current.cloud.commercial.subscriptions)
            .filter((item) => item.identityId === identity.id)
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] || null
        : null;

    if (!subscription) return current;

    const refreshedSubscription = refreshSubscriptionLifecycleState(subscription, now);
    current.cloud.commercial.subscriptions[refreshedSubscription.id] = refreshedSubscription;

    let session = existingSession
      || Object.values(current.cloud.commercial.onboardingSessions)
        .filter((item) => item.subscriptionId === refreshedSubscription.id)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
      || null;

    if (!session) {
      session = {
        id: makeId('onboarding'),
        identityId: refreshedSubscription.identityId,
        organizationId: refreshedSubscription.organizationId,
        subscriptionId: refreshedSubscription.id,
        selectedPlanId: refreshedSubscription.planId,
        billingInterval: refreshedSubscription.intendedBillingInterval,
        expiresAt: addDaysIso(nowIso(), 2),
        createdAt: nowIso(),
        updatedAt: nowIso(),
        source: DEFAULT_MARKETING_SOURCE,
      };
      current.cloud.commercial.onboardingSessions[session.id] = session;
      recoveryResult = {
        sessionId: session.id,
        redirectUrl: buildRedirectUrl(payload.appBaseUrl, session.id),
        selectedPlanId: session.selectedPlanId,
        selectedTemplateId: session.selectedTemplateId,
        subscription: refreshedSubscription,
        status: 'RECOVERED',
      };
      return current;
    }

    const refreshedSession: CommercialOnboardingSession = {
      ...session,
      expiresAt: addDaysIso(nowIso(), 2),
      updatedAt: nowIso(),
    };
    current.cloud.commercial.onboardingSessions[refreshedSession.id] = refreshedSession;

    recoveryResult = {
      sessionId: refreshedSession.id,
      redirectUrl: buildRedirectUrl(payload.appBaseUrl, refreshedSession.id),
      selectedPlanId: refreshedSession.selectedPlanId,
      selectedTemplateId: refreshedSession.selectedTemplateId,
      subscription: refreshedSubscription,
      status: 'REFRESHED',
    };

    return current;
  });

  const resolvedRecovery = recoveryResult as
    | {
        sessionId: string;
        redirectUrl: string;
        selectedPlanId: string;
        selectedTemplateId?: string;
        subscription: CommercialSubscription;
        status: 'RECOVERED' | 'REFRESHED';
      }
    | null;

  if (!resolvedRecovery) {
    return { ok: false, reason: 'recoverable onboarding session not found' };
  }

  return {
    ok: true,
    sessionId: resolvedRecovery.sessionId,
    redirectUrl: resolvedRecovery.redirectUrl,
    selectedPlanId: resolvedRecovery.selectedPlanId,
    selectedTemplateId: resolvedRecovery.selectedTemplateId,
    subscriptionStatus: resolvedRecovery.subscription.status,
    billingInterval: resolvedRecovery.subscription.billingInterval,
    intendedBillingInterval: resolvedRecovery.subscription.intendedBillingInterval,
    paymentVerificationStatus: resolvedRecovery.subscription.paymentVerificationStatus,
    recoveryStatus: resolvedRecovery.status,
  };
}

export async function resolveCurrentEntitlement(params: { onboardingSessionId?: string; email?: string }) {
  let store = await readAdminStore();
  const now = new Date();

  const expiredIds = Object.values(store.cloud.commercial.subscriptions)
    .filter((subscription) => {
      const refreshed = refreshSubscriptionLifecycleState(subscription, now);
      return refreshed.status !== subscription.status;
    })
    .map((subscription) => subscription.id);

  if (expiredIds.length > 0) {
    await updateAdminStore((current) => {
      for (const subscriptionId of expiredIds) {
        const subscription = current.cloud.commercial.subscriptions[subscriptionId];
        if (!subscription) continue;
        current.cloud.commercial.subscriptions[subscriptionId] = refreshSubscriptionLifecycleState(subscription, now);
      }

      return {
        ...current,
      };
    });
    store = await readAdminStore();
  }

  const bySession = params.onboardingSessionId
    ? store.cloud.commercial.onboardingSessions[params.onboardingSessionId]
    : null;

  const normalizedEmail = params.email?.trim().toLowerCase();
  const identity = normalizedEmail
    ? Object.values(store.cloud.commercial.identities).find((item) => item.email.toLowerCase() === normalizedEmail) || null
    : null;

  const subscription = bySession
    ? store.cloud.commercial.subscriptions[bySession.subscriptionId] || null
    : identity
      ? Object.values(store.cloud.commercial.subscriptions)
          .filter((item) => item.identityId === identity.id)
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] || null
      : null;

  if (!subscription) {
    return {
      entitled: false,
      reason: 'NO_SUBSCRIPTION',
    };
  }

  if (subscription.status === 'EXPIRED') {
    return {
      entitled: false,
      reason: 'TRIAL_EXPIRED',
      subscription,
    };
  }

  return {
    entitled: isSubscriptionEntitled(subscription.status),
    reason: isSubscriptionEntitled(subscription.status) ? 'OK' : 'NOT_ENTITLED',
    subscription,
  };
}
