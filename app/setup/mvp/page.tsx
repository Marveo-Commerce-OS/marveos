'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatedChecklist } from './AnimatedChecklist';
import { AnimatedProgressRail } from './AnimatedProgressRail';
import { GlassCard } from './GlassCard';
import { StatusPill } from './StatusPill';
import { TerminalPanel } from './TerminalPanel';
import { MVP_ONBOARDING_STEP_SEQUENCE, WEBSITE_TYPE_OPTIONS } from '@/src/contexts/onboarding/constants';
import {
  ONBOARDING_BUSINESS_MODEL_OPTIONS,
  ONBOARDING_COUNTRY_OPTIONS,
} from '@/src/config/onboardingProfileOptions';
import {
  businessTypes,
  getProfessionsForSector,
  getSectorsForBusinessType,
  sectorRequiresProfession,
} from '@/config/business-taxonomy';
import { getCitiesForStates, getNigerianStates } from '@/config/locations/nigeria';
import type {
  CustomHeadlessDataContract,
  ExistingWebsiteDataContract,
  NewWebsiteDataContract,
  OnboardingStatusKey,
  WebsiteTypeKey,
} from '@/src/contexts/onboarding/types';
import type { OnboardingFlowContract } from '@/src/contexts/onboarding/onboarding-flow.contract';
import type { LaunchChecklistContract } from '@/src/contexts/onboarding/onboarding-status.contract';
import type { SupportAssignmentContract } from '@/src/contexts/support/support-assignment.contract';

type ConnectorStatusKey =
  | 'NOT_CONNECTED'
  | 'TOKEN_GENERATED'
  | 'PENDING_VERIFICATION'
  | 'CONNECTED'
  | 'FAILED'
  | 'SUPPORT_REQUIRED';

interface ConnectorSiteMetadata {
  siteUrl?: string;
  siteName?: string;
  platform?: string;
  wordpressVersion?: string;
  woocommerceEnabled?: boolean;
  connectorVersion?: string;
  connectorPluginStatus?: string;
  siteId?: string;
  jwtEnabled?: boolean;
  pageCount?: number;
  productCount?: number;
  menuCount?: number;
  mediaCount?: number;
  discoveredAt?: string;
}

type WizardStep =
  | 'plan'
  | 'profile'
  | 'website_type'
  | 'details'
  | 'review'
  | 'deploying'
  | 'ready';

function isInitialOnboardingStepAllowed(step: WizardStep): boolean {
  return step !== 'website_type' && step !== 'details';
}

function getNextAllowedInitialOnboardingStep(step: WizardStep): WizardStep {
  if (step === 'website_type' || step === 'details') {
    return 'profile';
  }

  return step;
}

interface ProfileBasics {
  ownerName: string;
  businessName: string;
  sector: string;
  professionKey: string;
  professionLabel: string;
  businessType: string;
  customBusinessType: string;
  customProfessionName: string;
  country: string;
  paymentCurrency: string;
  coverageStates: string[];
  coverageCities: string[];
  customCoverageAreas: string[];
  businessModel: string;
  contactEmail: string;
  contactPhone: string;
  domain: string;
  termsAccepted: boolean;
}

interface MakeupArtistOnboardingAnswers {
  offersBridalMakeup: boolean;
  offersStudioAppointments: boolean;
  offersHomeService: boolean;
  requiresDepositBeforeBooking: boolean;
  defaultDeposit: string;
  availabilityDays: string;
  serviceLocation: string;
  teamMode: 'ALONE' | 'TEAM';
  enableOnlineBooking: boolean;
  enableWhatsappEnquiriesFirst: boolean;
}

interface DraftState {
  wizardStep: WizardStep;
  planId: string;
  websiteType: WebsiteTypeKey | null;
  profile: ProfileBasics;
  makeupArtist: MakeupArtistOnboardingAnswers;
  selectedTemplateId: string;
  supportRequired: boolean;
  existingConnectionChoice: 'connector' | 'manual';
  newWebsiteData: NewWebsiteDataContract;
  existingWebsiteData: ExistingWebsiteDataContract;
  customHeadlessData: CustomHeadlessDataContract;
}

interface PublicTemplateOption {
  templateId: string;
  name: string;
  slug: string;
  businessType: string;
  description: string;
  previewImage: string;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  visibility: 'INTERNAL' | 'PUBLIC';
  supportedWebsiteTypes: Array<'NEW_WEBSITE' | 'EXISTING_WEBSITE' | 'CUSTOM_HEADLESS'>;
  supportedStacks: Array<'WORDPRESS_NEXTJS' | 'WORDPRESS_ONLY' | 'NEXTJS' | 'CUSTOM'>;
  planAvailability: string[];
  countryAvailability?: string[];
  featureModules: string[];
  requiresSupport: boolean;
}

function isWordPressLikeStack(value: string): boolean {
  const normalized = value.toLowerCase();
  return normalized.includes('wordpress') || normalized.includes('woocommerce');
}

type PhaseStatus = 'pending' | 'running' | 'done' | 'failed';

interface PhaseItem {
  key: 'prepare' | 'connect' | 'support' | 'check';
  label: string;
  status: PhaseStatus;
  note?: string;
}

interface TermsSection {
  title: string;
  body: string;
}

interface ProfileLookupsState {
  businessTypes: string[];
  businessModels: string[];
  countries: string[];
}

const STORAGE_KEY = 'marveo.mvp.onboarding.v1';

interface PersistedOnboardingState {
  draft: Partial<DraftState>;
  workspaceId?: string;
}

interface WorkspaceEntitlementSummary {
  planId: string;
  workspaceLimit: number;
  workspaceCount: number;
  remainingWorkspaces: number;
  hasCapacity: boolean;
}

const PLAN_OPTIONS = [
  { id: 'starter', name: 'Starter', description: 'For early stage brands and pilots.' },
  { id: 'growth', name: 'Growth', description: 'Balanced setup for growing teams.' },
  { id: 'business', name: 'Business', description: 'Legacy internal plan mapping.' },
  { id: 'enterprise', name: 'Enterprise', description: 'Advanced governance and support.' },
];

const CONNECTOR_DOWNLOAD_URL = '/plugin-packages/marveo-connector-1.0.16.zip';
const CONNECTOR_INSTALL_GUIDE_URL = process.env.NEXT_PUBLIC_CONNECTOR_INSTALL_GUIDE_URL || '/docs/connector-installation';

const INITIAL_PHASES: PhaseItem[] = [
  { key: 'prepare', label: 'Prepare workspace', status: 'pending' },
  { key: 'connect', label: 'Connect website', status: 'pending' },
  { key: 'support', label: 'Assign support', status: 'pending' },
  { key: 'check', label: 'Run launch checks', status: 'pending' },
];

const DEFAULT_PROFILE_LOOKUPS: ProfileLookupsState = {
  businessTypes: businessTypes.map((option) => option.key),
  businessModels: ONBOARDING_BUSINESS_MODEL_OPTIONS.map((option) => option.value),
  countries: ONBOARDING_COUNTRY_OPTIONS.map((option) => option.value),
};

const BUSINESS_MODEL_LABELS: Record<string, string> = {
  B2C: 'Business to Consumer',
  B2B: 'Business to Business',
};

const BUSINESS_MODEL_TOOLTIPS: Record<string, string> = {
  B2C: 'Business to Consumer: direct sales to individual customers.',
  B2B: 'Business to Business: sales to companies, usually with account or bulk workflows.',
};

const ONBOARDING_TERMS_SECTIONS: TermsSection[] = [
  {
    title: 'Service Scope',
    body: 'Marveo provisions your workspace, baseline modules, and onboarding records based on the profile you submit. Final production readiness may still require connector validation, domain/DNS updates, and operator review inside Setup Center.',
  },
  {
    title: 'Data Responsibility',
    body: 'You confirm that the business profile, contact information, and operational settings you provide are accurate. Marveo uses this information to configure modules, notifications, and onboarding artifacts.',
  },
  {
    title: 'Security And Access',
    body: 'You are responsible for securing business email accounts, connector tokens, and login credentials. If access details are exposed or lost, rotate credentials immediately and contact support.',
  },
  {
    title: 'Operational Notifications',
    body: 'Marveo attempts to send onboarding and provisioning notifications to the business contact and configured operations recipients. Email delivery depends on valid SMTP/provider configuration and recipient availability.',
  },
  {
    title: 'Post-Onboarding Setup',
    body: 'Website connection and advanced launch tasks continue in OS > Setup Center after workspace creation. Acceptance of these terms confirms you understand that onboarding completion does not guarantee a public launch without final checks.',
  },
  {
    title: 'Support And Changes',
    body: 'Marveo may update onboarding procedures, terms text, and operational policies over time. Continued use of the setup flow indicates acceptance of the current version at the time of onboarding.',
  },
];

function withCurrentOption(options: string[], current: string): string[] {
  const value = current.trim();
  if (!value) return options;
  return options.includes(value) ? options : [value, ...options];
}

function toLabel(raw: string): string {
  return raw
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function prettyWebsiteType(value: WebsiteTypeKey | null): string {
  if (!value) return 'Not selected';
  if (value === 'NEW_WEBSITE') return 'New Website';
  if (value === 'EXISTING_WEBSITE') return 'Existing Website';
  return 'Custom / Headless';
}

function prettyConnectorStatus(value: ConnectorStatusKey): string {
  if (value === 'NOT_CONNECTED') return 'Not connected';
  if (value === 'TOKEN_GENERATED') return 'Token generated';
  if (value === 'PENDING_VERIFICATION') return 'Pending verification';
  if (value === 'CONNECTED') return 'Connected';
  if (value === 'FAILED') return 'Connection failed';
  if (value === 'SUPPORT_REQUIRED') return 'Support required';
  return toLabel(value);
}

function normalizeOrigin(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';

  try {
    const withScheme = trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : `https://${trimmed}`;
    return new URL(withScheme).origin.toLowerCase();
  } catch {
    return trimmed.toLowerCase().replace(/\/$/, '');
  }
}

function prettyWooCommerceState(value: boolean | undefined): string {
  if (typeof value !== 'boolean') return 'Unknown';
  return value ? 'Installed' : 'Not installed';
}

function getNewWebsiteDefaults(profile: Pick<ProfileBasics, 'sector' | 'professionKey'>) {
  const professionKey = profile.professionKey.trim();
  const sector = profile.sector.trim();

  if (professionKey === 'saas-software-platform') {
    return { pagesNeeded: ['Home', 'Features', 'Pricing', 'Contact'] };
  }

  if (professionKey === 'digital-agency') {
    return { pagesNeeded: ['Home', 'Services', 'Case Studies', 'Contact'] };
  }

  if (professionKey === 'it-support-company') {
    return { pagesNeeded: ['Home', 'Services', 'Support Plans', 'Contact'] };
  }

  if (professionKey === 'software-development-company') {
    return { pagesNeeded: ['Home', 'Services', 'Process', 'Contact'] };
  }

  if (professionKey === 'automation-consultant') {
    return { pagesNeeded: ['Home', 'Services', 'Automation Workflows', 'Contact'] };
  }

  if (sector === 'technology-software') {
    return { pagesNeeded: ['Home', 'Services', 'Contact'] };
  }

  return { pagesNeeded: ['Home', 'About', 'Contact'] };
}

function mapCountryToCode(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return 'US';
  if (normalized === 'ng' || normalized.includes('nigeria')) return 'NG';
  if (normalized === 'us' || normalized.includes('united states')) return 'US';
  if (normalized === 'gb' || normalized.includes('united kingdom')) return 'GB';
  if (normalized === 'ca' || normalized.includes('canada')) return 'CA';
  if (normalized === 'ae' || normalized.includes('united arab emirates')) return 'AE';
  if (normalized === 'au' || normalized.includes('australia')) return 'AU';
  if (normalized.length === 2) return normalized.toUpperCase();
  return 'US';
}

function defaultDraft(): DraftState {
  return {
    wizardStep: 'plan',
    planId: 'starter',
    websiteType: 'NEW_WEBSITE',
    profile: {
      ownerName: '',
      businessName: '',
      sector: '',
      professionKey: '',
      professionLabel: '',
      businessType: 'Retail',
      customBusinessType: '',
      customProfessionName: '',
      country: 'United States',
      paymentCurrency: 'USD',
      coverageStates: [],
      coverageCities: [],
      customCoverageAreas: [],
      businessModel: 'B2C',
      contactEmail: '',
      contactPhone: '',
      domain: '',
      termsAccepted: false,
    },
    makeupArtist: {
      offersBridalMakeup: false,
      offersStudioAppointments: false,
      offersHomeService: false,
      requiresDepositBeforeBooking: false,
      defaultDeposit: '',
      availabilityDays: '',
      serviceLocation: '',
      teamMode: 'ALONE',
      enableOnlineBooking: true,
      enableWhatsappEnquiriesFirst: true,
    },
    selectedTemplateId: '',
    supportRequired: false,
    existingConnectionChoice: 'connector',
    newWebsiteData: {
      businessName: '',
      businessType: '',
      domain: '',
      frontendDomain: '',
      backendCmsSubdomain: '',
      domainStrategy: 'HEADLESS_WORDPRESS',
      logo: '',
      brandColors: {
        primary: '#0f172a',
        secondary: '#334155',
      },
      pagesNeeded: ['Home', 'About', 'Contact'],
      contactInfo: {
        email: '',
        phone: '',
      },
      socialLinks: [],
      selectedTemplateId: '',
    },
    existingWebsiteData: {
      domain: '',
      wordpressAdminUrl: '',
      currentPlatform: 'WordPress/WooCommerce',
      connectionMethod: 'connector',
      connectorToken: '',
      manualAccessRequired: false,
      supportRequired: false,
    },
    customHeadlessData: {
      stack: '',
      apiDetails: '',
      developerContact: '',
      integrationNotes: '',
      supportRequired: true,
    },
  };
}

function toApiBaseUrl(domainOrUrl: string): string {
  const input = domainOrUrl.trim();
  if (!input) return 'https://example.com';
  if (input.startsWith('http://') || input.startsWith('https://')) return input;
  return `https://${input}`;
}

async function safeJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function SetupMvpPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const enabled = process.env.NEXT_PUBLIC_ENABLE_MVP_ONBOARDING !== 'false';
  const marketingPricingUrl = process.env.NEXT_PUBLIC_MARKETING_PRICING_URL || 'https://getmarveo.com/pricing';
  const [draft, setDraft] = useState<DraftState>(defaultDraft());
  const [workspaceId, setWorkspaceId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
  const [phases, setPhases] = useState<PhaseItem[]>(INITIAL_PHASES);
  const [checklist, setChecklist] = useState<LaunchChecklistContract | null>(null);
  const [profileLookups, setProfileLookups] = useState<ProfileLookupsState>(DEFAULT_PROFILE_LOOKUPS);
  const [connectionStatus, setConnectionStatus] = useState<ConnectorStatusKey>('NOT_CONNECTED');
  const [connectorSiteMetadata, setConnectorSiteMetadata] = useState<ConnectorSiteMetadata | null>(null);
  const [showConnectorToken, setShowConnectorToken] = useState(false);
  const [connectorTokenFocused, setConnectorTokenFocused] = useState(false);
  const [templateOptions, setTemplateOptions] = useState<PublicTemplateOption[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesError, setTemplatesError] = useState('');
  const [connectorCheck, setConnectorCheck] = useState<{ status: 'idle' | 'checking' | 'ok' | 'failed'; message?: string }>({
    status: 'idle',
  });
  const [stepGuardMessage, setStepGuardMessage] = useState('');
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [workspaceEntitlement, setWorkspaceEntitlement] = useState<WorkspaceEntitlementSummary | null>(null);
  const [entitlementState, setEntitlementState] = useState<{
    status: 'checking' | 'allowed' | 'trial_expired' | 'blocked';
    message?: string;
    upgradeUrl?: string;
  }>({ status: 'checking' });

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<DraftState> | PersistedOnboardingState;
      const persisted =
        parsed && typeof parsed === 'object' && 'draft' in parsed
          ? (parsed as PersistedOnboardingState)
          : null;
      const restoredDraft = persisted?.draft ?? (parsed as Partial<DraftState>);
      const restoredWorkspaceId = typeof persisted?.workspaceId === 'string' ? persisted.workspaceId : '';
      const restoredStep = typeof restoredDraft.wizardStep === 'string' ? (restoredDraft.wizardStep as WizardStep) : undefined;
      const sanitizedStep = restoredStep ? getNextAllowedInitialOnboardingStep(restoredStep) : undefined;
      const blockedStepRecovered = Boolean(restoredStep && !isInitialOnboardingStepAllowed(restoredStep));
      window.setTimeout(() => {
        setDraft((prev) => ({
          ...prev,
          ...restoredDraft,
          wizardStep: sanitizedStep ?? prev.wizardStep,
        }));
        if (restoredWorkspaceId) setWorkspaceId(restoredWorkspaceId);
        if (blockedStepRecovered) {
          setStepGuardMessage('Website setup is available inside OS Setup Center after workspace creation.');
        }
      }, 0);
    } catch {
      // Ignore malformed local draft.
    }
  }, []);

  useEffect(() => {
    try {
      const persisted: PersistedOnboardingState = {
        draft,
        workspaceId: workspaceId || undefined,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
    } catch {
      // Ignore local storage failures.
    }
  }, [draft, workspaceId]);

  useEffect(() => {
    let cancelled = false;

    async function loadProfileLookups() {
      try {
        const response = await fetch('/api/cloud/lookups', { method: 'GET' });
        if (!response.ok) return;

        const data = (await response.json()) as {
          lookups?: {
            businessTypes?: string[];
            businessModels?: string[];
            countries?: Array<{ code?: string; name?: string }>;
          };
        };

        if (cancelled) return;

        const businessTypes = Array.isArray(data?.lookups?.businessTypes)
          ? data.lookups.businessTypes.map((item) => String(item).trim()).filter(Boolean)
          : DEFAULT_PROFILE_LOOKUPS.businessTypes;

        const businessModels = Array.isArray(data?.lookups?.businessModels)
          ? data.lookups.businessModels.map((item) => String(item).trim()).filter(Boolean)
          : DEFAULT_PROFILE_LOOKUPS.businessModels;

        const countries = Array.isArray(data?.lookups?.countries)
          ? data.lookups.countries.map((item) => String(item?.name ?? '').trim()).filter(Boolean)
          : DEFAULT_PROFILE_LOOKUPS.countries;

        setProfileLookups({
          businessTypes: businessTypes.length > 0 ? businessTypes : DEFAULT_PROFILE_LOOKUPS.businessTypes,
          businessModels: businessModels.length > 0 ? businessModels : DEFAULT_PROFILE_LOOKUPS.businessModels,
          countries: countries.length > 0 ? countries : DEFAULT_PROFILE_LOOKUPS.countries,
        });
      } catch {
        // Keep local fallback defaults if API is unavailable.
      }
    }

    void loadProfileLookups();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function checkEntitlement() {
      const onboardingSessionId = searchParams.get('session');
      const params = onboardingSessionId ? `?session=${encodeURIComponent(onboardingSessionId)}` : '';

      try {
        const response = await fetch(`/api/subscription/current${params}`, { method: 'GET', cache: 'no-store' });
        const payload = await safeJson<{
          entitled?: boolean;
          reason?: string;
          redirectTo?: string;
          lockBehavior?: {
            allowLoginView?: boolean;
            blockPublishing?: boolean;
            blockLaunch?: boolean;
            blockNewWorkspace?: boolean;
          };
        }>(response);

        if (cancelled) return;

        if (payload?.entitled) {
          setEntitlementState({ status: 'allowed' });
          return;
        }

        if (payload?.reason === 'TRIAL_EXPIRED') {
          setEntitlementState({
            status: 'trial_expired',
            message: 'Your trial has expired. You can still sign in to review your workspace, but publishing and new workspace actions are locked until you upgrade.',
            upgradeUrl: payload.redirectTo || marketingPricingUrl,
          });
          return;
        }

        const redirectTo = payload?.redirectTo || marketingPricingUrl;
        setEntitlementState({ status: 'blocked' });

        const resolvedRedirect = new URL(redirectTo, window.location.origin);
        if (resolvedRedirect.origin === window.location.origin) {
          router.replace(`${resolvedRedirect.pathname}${resolvedRedirect.search}${resolvedRedirect.hash}`);
        } else {
          window.open(resolvedRedirect.toString(), '_self', 'noopener,noreferrer');
        }
      } catch {
        if (cancelled) return;
        setEntitlementState({
          status: 'blocked',
          message: 'Unable to validate access right now. Please start from pricing to continue onboarding.',
          upgradeUrl: marketingPricingUrl,
        });
      }
    }

    void checkEntitlement();

    return () => {
      cancelled = true;
    };
  }, [marketingPricingUrl, router, searchParams]);

  useEffect(() => {
    let cancelled = false;
    const sessionId = searchParams.get('session');

    async function hydrateFromSession() {
      if (!sessionId) return;

      try {
        const response = await fetch(`/api/public/onboarding/session/${encodeURIComponent(sessionId)}`, { method: 'GET', cache: 'no-store' });
        const payload = await safeJson<{
          ok?: boolean;
          selectedPlanId?: string;
          selectedTemplateId?: string;
          workspaceEntitlement?: WorkspaceEntitlementSummary | null;
        }>(response);

        if (cancelled || !payload?.ok) return;

        setDraft((prev) => ({
          ...prev,
          planId: payload.selectedPlanId || prev.planId,
          selectedTemplateId: payload.selectedTemplateId || prev.selectedTemplateId,
          newWebsiteData: {
            ...prev.newWebsiteData,
            selectedTemplateId: payload.selectedTemplateId || prev.newWebsiteData.selectedTemplateId,
          },
        }));
        setWorkspaceEntitlement(payload.workspaceEntitlement || null);
      } catch {
        // Ignore session hydration failures.
      }
    }

    void hydrateFromSession();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    async function loadTemplateOptions() {
      if (draft.websiteType !== 'NEW_WEBSITE') {
        setTemplatesError('');
        return;
      }

      try {
        setTemplatesLoading(true);
        setTemplatesError('');

        const countryCode = mapCountryToCode(draft.profile.country);
        const params = new URLSearchParams({
          status: 'ACTIVE',
          visibility: 'PUBLIC',
          websiteType: 'NEW_WEBSITE',
          country: countryCode,
          planId: draft.planId,
          businessType: draft.profile.businessType,
          sector: draft.profile.sector,
          professionKey: draft.profile.professionKey,
        });

        const response = await fetch(`/api/public/templates?${params.toString()}`, { method: 'GET', cache: 'no-store' });
        const payload = await safeJson<{ templates?: PublicTemplateOption[] }>(response);

        if (cancelled) return;

        if (!response.ok || !Array.isArray(payload?.templates)) {
          throw new Error('Template catalog unavailable.');
        }

        const templates = payload.templates;
        setTemplateOptions(templates);
        setDraft((prev) => {
          const selected = templates.some((item) => item.templateId === prev.selectedTemplateId)
            ? prev.selectedTemplateId
            : templates[0]?.templateId || '';

          return {
            ...prev,
            selectedTemplateId: selected,
            newWebsiteData: {
              ...prev.newWebsiteData,
              selectedTemplateId: selected,
            },
          };
        });

        if (templates.length === 0) {
          setTemplatesError('No templates are currently available for this plan and country.');
        }
      } catch {
        if (cancelled) return;
        setTemplateOptions([]);
        setTemplatesError('Live template catalog is temporarily unavailable.');
      } finally {
        if (!cancelled) setTemplatesLoading(false);
      }
    }

    void loadTemplateOptions();

    return () => {
      cancelled = true;
    };
  }, [draft.planId, draft.profile.country, draft.websiteType]);

  const supportNeeded = useMemo(() => {
    if (draft.websiteType === 'CUSTOM_HEADLESS') return true;
    if (draft.websiteType === 'EXISTING_WEBSITE') {
      return draft.existingConnectionChoice === 'manual' || draft.existingWebsiteData.supportRequired;
    }
    return draft.supportRequired;
  }, [draft]);

  const flowSummary = useMemo<OnboardingFlowContract | null>(() => {
    if (!draft.websiteType) return null;

    const record = {
      clientId: draft.profile.contactEmail || 'pending-client',
      workspaceId: workspaceId || undefined,
      planId: draft.planId,
      websiteType: draft.websiteType,
      status: 'IN_PROGRESS' as OnboardingStatusKey,
      steps: MVP_ONBOARDING_STEP_SEQUENCE.map((step) => ({ step, completed: false })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (draft.websiteType === 'NEW_WEBSITE') {
      return {
        stepSequence: MVP_ONBOARDING_STEP_SEQUENCE,
        websiteType: draft.websiteType,
        record,
        websiteSetup: { websiteType: 'NEW_WEBSITE', data: draft.newWebsiteData },
      };
    }

    if (draft.websiteType === 'EXISTING_WEBSITE') {
      return {
        stepSequence: MVP_ONBOARDING_STEP_SEQUENCE,
        websiteType: draft.websiteType,
        record,
        websiteSetup: { websiteType: 'EXISTING_WEBSITE', data: draft.existingWebsiteData },
      };
    }

    return {
      stepSequence: MVP_ONBOARDING_STEP_SEQUENCE,
      websiteType: draft.websiteType,
      record,
      websiteSetup: { websiteType: 'CUSTOM_HEADLESS', data: draft.customHeadlessData },
    };
  }, [draft, workspaceId]);

  const canMoveFromPlan = Boolean(draft.planId);
  const canMoveFromType = Boolean(draft.websiteType);

  const discoverySummary = useMemo(() => {
    if (!connectorSiteMetadata) return [];

    const lines = ['We discovered:'];
    if (typeof connectorSiteMetadata.pageCount === 'number') lines.push(`- ${connectorSiteMetadata.pageCount} Pages`);
    if (typeof connectorSiteMetadata.menuCount === 'number') lines.push(`- ${connectorSiteMetadata.menuCount} Menus`);
    if (typeof connectorSiteMetadata.productCount === 'number' && connectorSiteMetadata.woocommerceEnabled) {
      lines.push(`- ${connectorSiteMetadata.productCount} Products`);
    }
    lines.push(`- WooCommerce ${prettyWooCommerceState(connectorSiteMetadata.woocommerceEnabled).toLowerCase()}`);
    lines.push('Ready to continue?');
    return lines;
  }, [connectorSiteMetadata]);

  function setWizardStep(step: WizardStep) {
    if (!isInitialOnboardingStepAllowed(step)) {
      const nextStep = getNextAllowedInitialOnboardingStep(step);
      setStepGuardMessage('Website setup is available inside OS Setup Center after workspace creation.');
      setDraft((prev) => ({ ...prev, wizardStep: nextStep }));
      setError('');
      return;
    }

    setStepGuardMessage('');
    setDraft((prev) => ({ ...prev, wizardStep: step }));
    setError('');
  }

  function withPhaseStatus(key: PhaseItem['key'], status: PhaseStatus, note?: string) {
    setPhases((prev) => prev.map((phase) => (phase.key === key ? { ...phase, status, note } : phase)));
  }

  function parseCsvToArray(value: string): string[] {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function validateProfileStep(): Record<string, string> {
    const nextErrors: Record<string, string> = {};
    const effectiveBusinessType = draft.profile.businessType === 'Other'
      ? draft.profile.customBusinessType.trim()
      : draft.profile.businessType.trim();

    if (!draft.profile.ownerName.trim()) nextErrors.ownerName = 'Owner name is required.';
    if (!draft.profile.contactEmail.trim()) nextErrors.contactEmail = 'Email is required.';
    if (!draft.profile.businessName.trim()) nextErrors.businessName = 'Business name is required.';
    if (!draft.profile.country.trim()) nextErrors.country = 'Country is required.';
    if (!effectiveBusinessType) nextErrors.businessType = 'Business type is required.';
    if (!draft.profile.paymentCurrency.trim()) nextErrors.paymentCurrency = 'Payment currency is required.';

    if (sectorOptions.length > 0 && !draft.profile.sector.trim()) {
      nextErrors.sector = 'Sector is required for this business type.';
    }

    if (professionIsRequired && !draft.profile.professionKey.trim()) {
      nextErrors.professionKey = 'Profession is required for this sector.';
    }

    if (draft.profile.professionKey === 'other' && !draft.profile.customProfessionName.trim()) {
      nextErrors.customProfessionName = 'Custom profession name is required.';
    }

    if (draft.profile.country.toLowerCase().includes('nigeria')) {
      const noStates = draft.profile.coverageStates.length === 0;
      const noCustomCoverage = draft.profile.customCoverageAreas.length === 0;
      if (noStates && noCustomCoverage) {
        nextErrors.coverageStates = 'Select at least one coverage state or add a custom coverage area.';
      }
    } else if (draft.profile.customCoverageAreas.length === 0) {
      nextErrors.customCoverageAreas = 'Add at least one coverage area.';
    }

    if (!draft.profile.termsAccepted) {
      nextErrors.termsAccepted = 'You must accept terms to continue.';
    }

    return nextErrors;
  }

  function continueFromProfile() {
    const nextErrors = validateProfileStep();
    setProfileErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setWizardStep('review');
  }

  async function callOnboardingUpdate(nextWorkspaceId: string, payload: Record<string, unknown>) {
    const res = await fetch(`/api/cloud/workspaces/${nextWorkspaceId}/onboarding`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await safeJson<{ error?: string }>(res);
      const isPublicOnboarding = Boolean(searchParams.get('session'));
      if (isPublicOnboarding && (res.status === 401 || res.status === 403)) {
        return;
      }
      throw new Error(data?.error || 'Failed to save onboarding progress');
    }
  }

  function requestSupportSetup() {
    setDraft((prev) => ({
      ...prev,
      existingConnectionChoice: 'manual',
      existingWebsiteData: {
        ...prev.existingWebsiteData,
        connectionMethod: 'manual',
        manualAccessRequired: true,
        supportRequired: true,
      },
    }));
    setConnectionStatus('SUPPORT_REQUIRED');
    setConnectorCheck({ status: 'failed', message: 'Our setup team can help install the connector, verify your WordPress site, and complete the connection safely.' });
  }

  function clearConnectorToken() {
    setDraft((prev) => ({
      ...prev,
      existingWebsiteData: {
        ...prev.existingWebsiteData,
        connectorToken: '',
      },
    }));
    setConnectionStatus('NOT_CONNECTED');
    setConnectorSiteMetadata(null);
    setConnectorCheck({ status: 'idle' });
    setShowConnectorToken(false);
  }

  async function checkConnectorPlugin() {
    const domain = (draft.existingWebsiteData.domain || draft.profile.domain).trim();
    const token = draft.existingWebsiteData.connectorToken.trim();
    const submittedOrigin = normalizeOrigin(domain);
    if (!domain) {
      setConnectorCheck({ status: 'failed', message: 'Please provide a domain first.' });
      return;
    }
    if (!token) {
      setConnectorCheck({ status: 'failed', message: 'Paste the Generated Secure Connection Token from the WordPress connector first, then verify the WordPress connection.' });
      return;
    }

    setConnectorCheck({ status: 'checking' });
    setConnectionStatus('PENDING_VERIFICATION');

    try {
      const response = await fetch('/api/cloud/connector/preflight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain }),
      });

      const data = await safeJson<{
        verified?: boolean;
        connectorStatus?: ConnectorStatusKey;
        siteMetadata?: ConnectorSiteMetadata;
        error?: string;
        siteOrigin?: string;
      }>(response);

      if (!data?.verified || !data.siteMetadata) {
        setConnectionStatus('FAILED');
        setConnectorSiteMetadata(null);
        setConnectorCheck({ status: 'failed', message: data?.error || 'Plugin endpoint is not reachable.' });
        return;
      }

      const verifiedOrigin = normalizeOrigin(data.siteOrigin || data.siteMetadata.siteUrl || '');
      if (submittedOrigin && verifiedOrigin && submittedOrigin !== verifiedOrigin) {
        setConnectionStatus('FAILED');
        setConnectorSiteMetadata(null);
        setConnectorCheck({
          status: 'failed',
          message: 'This token does not match the website domain entered. Please confirm the WordPress site and token.',
        });
        return;
      }

      setConnectionStatus('CONNECTED');
      setConnectorSiteMetadata(data.siteMetadata);
      setDraft((prev) => ({
        ...prev,
        existingWebsiteData: {
          ...prev.existingWebsiteData,
          currentPlatform: data.siteMetadata?.platform || prev.existingWebsiteData.currentPlatform,
        },
      }));
      setConnectorCheck({ status: 'ok', message: 'Connector verified. Site metadata detected successfully.' });
    } catch {
      setConnectionStatus('FAILED');
      setConnectorCheck({ status: 'failed', message: 'Could not verify plugin right now.' });
    }
  }

  async function startDeployment() {
    if (workspaceEntitlement && !workspaceEntitlement.hasCapacity) {
      setError(
        `Workspace entitlement exhausted (${workspaceEntitlement.planId}: ${workspaceEntitlement.workspaceLimit} max). Upgrade to add another workspace.`,
      );
      return;
    }

    setLoading(true);
    setError('');
    setChecklist(null);
    setPhases(INITIAL_PHASES);
    setWizardStep('deploying');

    try {
      const effectiveBusinessType = draft.profile.businessType === 'Other'
        ? draft.profile.customBusinessType.trim()
        : draft.profile.businessType;
      const effectiveProfessionName = draft.profile.professionKey === 'other'
        ? draft.profile.customProfessionName.trim()
        : draft.profile.professionLabel;

      const businessProfile = {
        ownerName: draft.profile.ownerName,
        businessName: draft.profile.businessName,
        ...(draft.profile.sector ? { sector: draft.profile.sector } : {}),
        ...(draft.profile.professionKey ? { professionKey: draft.profile.professionKey } : {}),
        ...(effectiveProfessionName ? { profession: effectiveProfessionName } : {}),
        businessType: effectiveBusinessType,
        customBusinessType: draft.profile.customBusinessType,
        customProfessionName: draft.profile.customProfessionName,
        country: draft.profile.country,
        paymentCurrency: draft.profile.paymentCurrency,
        coverageStates: draft.profile.coverageStates,
        coverageCities: draft.profile.coverageCities,
        customCoverageAreas: draft.profile.customCoverageAreas,
        businessModel: draft.profile.businessModel,
        contactEmail: draft.profile.contactEmail,
        contactPhone: draft.profile.contactPhone,
        domain: draft.profile.domain,
        termsAccepted: draft.profile.termsAccepted,
        ...(draft.profile.professionKey === 'makeup-artist' ? { professionOnboardingAnswers: draft.makeupArtist } : {}),
      };

      const collectedBusinessData = {
        businessType: effectiveBusinessType,
        sector: draft.profile.sector,
        professionKey: draft.profile.professionKey,
        customBusinessType: draft.profile.customBusinessType,
        customProfessionName: draft.profile.customProfessionName,
        country: draft.profile.country,
        coverageStates: draft.profile.coverageStates,
        coverageCities: draft.profile.coverageCities,
        customCoverageAreas: draft.profile.customCoverageAreas,
        paymentCurrency: draft.profile.paymentCurrency,
        onboardingAnswers: draft.profile.professionKey === 'makeup-artist' ? draft.makeupArtist : undefined,
      };

      const contentBaseUrl =
        toApiBaseUrl(draft.profile.domain || 'pending-website-setup.marveo.local');

      const effectiveSupportNeededBase =
        draft.websiteType === 'EXISTING_WEBSITE'
          ? draft.existingConnectionChoice === 'manual' || draft.existingWebsiteData.supportRequired
          : supportNeeded;
      let effectiveSupportNeeded = effectiveSupportNeededBase;
      const onboardingSessionId = searchParams.get('session');
      const isPublicOnboarding = Boolean(onboardingSessionId);

      withPhaseStatus('prepare', 'running', 'Preparing your workspace');

      const createRes = await fetch('/api/cloud/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: draft.profile.businessName || 'Marveo Workspace',
          businessType: draft.profile.businessType || 'Retail',
          country: draft.profile.country || 'United States',
          businessModel: draft.profile.businessModel || 'B2C',
          contentSource: draft.websiteType === 'CUSTOM_HEADLESS' ? 'nextjs' : 'wordpress',
          contentBaseUrl,
          planId: draft.planId,
          websiteType: draft.websiteType,
          businessProfile,
          selectedTemplateId: draft.websiteType === 'NEW_WEBSITE' ? draft.selectedTemplateId : undefined,
          supportRequired: effectiveSupportNeeded,
          onboardingSessionId: onboardingSessionId || undefined,
        }),
      });

      const createData = await safeJson<{
        workspace?: { id: string };
        error?: string;
        currentPlan?: string;
        workspaceCount?: number;
        workspaceLimit?: number;
        remainingWorkspaces?: number;
      }>(createRes);
      if (!createRes.ok) {
        const exhausted = createRes.status === 402
          && typeof createData?.workspaceLimit === 'number'
          && typeof createData?.workspaceCount === 'number';

        if (exhausted) {
          throw new Error(`${createData?.error || 'Workspace limit reached'} Upgrade is required to create another workspace.`);
        }

        throw new Error(createData?.error || 'Failed to create workspace');
      }

      const nextWorkspaceId = createData?.workspace?.id;
      if (!nextWorkspaceId) throw new Error('Workspace id was not returned.');

      setWorkspaceId(nextWorkspaceId);
      if (
        typeof createData?.workspaceCount === 'number'
        && typeof createData?.workspaceLimit === 'number'
        && typeof createData?.remainingWorkspaces === 'number'
      ) {
        setWorkspaceEntitlement({
          planId: String(createData?.currentPlan || draft.planId || 'starter'),
          workspaceCount: createData.workspaceCount,
          workspaceLimit: createData.workspaceLimit,
          remainingWorkspaces: createData.remainingWorkspaces,
          hasCapacity: createData.remainingWorkspaces > 0,
        });
      } else {
        setWorkspaceEntitlement((prev) => prev ? {
          ...prev,
          workspaceCount: prev.workspaceCount + 1,
          remainingWorkspaces: Math.max(0, prev.remainingWorkspaces - 1),
          hasCapacity: Math.max(0, prev.remainingWorkspaces - 1) > 0,
        } : prev);
      }
      withPhaseStatus('prepare', 'done', 'Workspace prepared');

      withPhaseStatus('connect', 'running', 'Saving onboarding details');

      await callOnboardingUpdate(nextWorkspaceId, {
        step: 1,
        action: 'complete',
        onboardingStepKey: 'PLAN_SELECTED',
        onboardingStatus: 'IN_PROGRESS',
        websiteType: draft.websiteType,
      });

      await callOnboardingUpdate(nextWorkspaceId, {
        onboardingStepKey: 'PROFILE_CREATED',
        action: 'complete',
        onboardingStatus: 'IN_PROGRESS',
      });

      await callOnboardingUpdate(nextWorkspaceId, {
        onboardingStepKey: 'WEBSITE_TYPE_SELECTED',
        action: 'complete',
        websiteType: draft.websiteType,
        onboardingStatus: 'IN_PROGRESS',
      });

      await callOnboardingUpdate(nextWorkspaceId, {
        onboardingStepKey: 'BUSINESS_DETAILS_COMPLETED',
        action: 'complete',
        websiteType: draft.websiteType,
        onboardingStatus: 'IN_PROGRESS',
        collectedBusinessData,
        supportRequired: effectiveSupportNeeded,
      });

      try {
        const profileProvisionRes = await fetch('/api/master/provisioning/profile-complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            onboardingSessionId: onboardingSessionId || undefined,
            workspaceId: nextWorkspaceId,
            workspaceName: draft.profile.businessName || 'Marveo Workspace',
            professionKey: draft.profile.professionKey || undefined,
            onboardingProfile: {
              businessType: effectiveBusinessType,
              sector: draft.profile.sector,
              professionKey: draft.profile.professionKey,
              customBusinessType: draft.profile.customBusinessType,
              customProfessionName: draft.profile.customProfessionName,
              country: draft.profile.country,
              coverageStates: draft.profile.coverageStates,
              coverageCities: draft.profile.coverageCities,
              customCoverageAreas: draft.profile.customCoverageAreas,
              paymentCurrency: draft.profile.paymentCurrency,
            },
            onboardingAnswers: draft.profile.professionKey === 'makeup-artist' ? draft.makeupArtist : undefined,
          }),
        });

        if (!profileProvisionRes.ok) {
          const profileProvisionData = await safeJson<{ error?: string }>(profileProvisionRes);
          withPhaseStatus('prepare', 'done', `Workspace prepared (provisioning warning: ${profileProvisionData?.error || 'profile hook unavailable'})`);
        }
      } catch {
        withPhaseStatus('prepare', 'done', 'Workspace prepared (provisioning hook unavailable, continuing safely)');
      }

      if (draft.websiteType === 'EXISTING_WEBSITE' && draft.existingConnectionChoice === 'connector') {
        const connectorToken = draft.existingWebsiteData.connectorToken.trim();
        if (!connectorToken) {
          effectiveSupportNeeded = true;
          setConnectionStatus('SUPPORT_REQUIRED');
          setConnectorCheck({ status: 'failed', message: 'No connector token provided yet. Account is ready; support can complete integration next.' });
          await fetch(`/api/cloud/workspaces/${nextWorkspaceId}/connector`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'update_status', connectorStatus: 'SUPPORT_REQUIRED' }),
          });
        } else {
          await fetch(`/api/cloud/workspaces/${nextWorkspaceId}/connector`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'set_token', connectorToken }),
          });

          setConnectionStatus('TOKEN_GENERATED');

          await callOnboardingUpdate(nextWorkspaceId, {
            onboardingStepKey: 'CONNECTOR_TOKEN_GENERATED',
            action: 'complete',
            onboardingStatus: 'IN_PROGRESS',
            websiteType: draft.websiteType,
            connectorToken,
          });

          const verifyDomain = draft.existingWebsiteData.domain || draft.profile.domain;
          if (verifyDomain.trim()) {
            const submittedOrigin = normalizeOrigin(verifyDomain);
            setConnectionStatus('PENDING_VERIFICATION');
            const verifyRes = await fetch(`/api/cloud/workspaces/${nextWorkspaceId}/connector/verify`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ domain: verifyDomain, connectorToken }),
            });

            const verifyData = await safeJson<{
              verified?: boolean;
              connectorStatus?: ConnectorStatusKey;
              siteMetadata?: ConnectorSiteMetadata;
              error?: string;
              siteOrigin?: string;
            }>(verifyRes);

            if (!verifyRes.ok || !verifyData?.verified) {
              effectiveSupportNeeded = true;
              setConnectionStatus('FAILED');
              setConnectorCheck({ status: 'failed', message: verifyData?.error || 'Connector verification failed. Support setup required.' });

              await fetch(`/api/cloud/workspaces/${nextWorkspaceId}/connector`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'update_status', connectorStatus: 'FAILED' }),
              });
            } else {
              const verifiedOrigin = normalizeOrigin(verifyData.siteOrigin || verifyData.siteMetadata?.siteUrl || '');
              if (submittedOrigin && verifiedOrigin && submittedOrigin !== verifiedOrigin) {
                effectiveSupportNeeded = true;
                setConnectionStatus('FAILED');
                setConnectorSiteMetadata(null);
                setConnectorCheck({
                  status: 'failed',
                  message: 'Token-domain mismatch detected. Account is ready; support will finalize integration safely.',
                });

                await fetch(`/api/cloud/workspaces/${nextWorkspaceId}/connector`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: 'update_status', connectorStatus: 'FAILED' }),
                });
              } else {
                setConnectionStatus('CONNECTED');
                setConnectorSiteMetadata(verifyData.siteMetadata || null);
                setDraft((prev) => ({
                  ...prev,
                  existingWebsiteData: {
                    ...prev.existingWebsiteData,
                    currentPlatform: verifyData.siteMetadata?.platform || prev.existingWebsiteData.currentPlatform,
                  },
                }));
                setConnectorCheck({ status: 'ok', message: 'Connector verified and linked to workspace.' });
              }
            }
          } else {
            effectiveSupportNeeded = true;
            setConnectionStatus('SUPPORT_REQUIRED');
            setConnectorCheck({ status: 'failed', message: 'No domain provided yet. Account is ready; support can complete integration next.' });

            await fetch(`/api/cloud/workspaces/${nextWorkspaceId}/connector`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'update_status', connectorStatus: 'SUPPORT_REQUIRED' }),
            });
          }
        }
      } else if (draft.websiteType === 'EXISTING_WEBSITE' && draft.existingConnectionChoice === 'manual') {
        setConnectionStatus('SUPPORT_REQUIRED');
        await fetch(`/api/cloud/workspaces/${nextWorkspaceId}/connector`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'update_status', connectorStatus: 'SUPPORT_REQUIRED' }),
        });
      }

      if (draft.websiteType === 'NEW_WEBSITE') {
        await callOnboardingUpdate(nextWorkspaceId, {
          onboardingStepKey: 'TEMPLATE_SELECTED',
          action: 'complete',
          onboardingStatus: 'IN_PROGRESS',
          websiteType: draft.websiteType,
        });
      }

      if (isPublicOnboarding) {
        withPhaseStatus('connect', 'done', 'Onboarding details saved');

        withPhaseStatus('support', 'running', 'Sending onboarding access notifications');
        const completionRes = await fetch('/api/public/onboarding/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            onboardingSessionId: onboardingSessionId || undefined,
            workspaceId: nextWorkspaceId,
            workspaceName: draft.profile.businessName || 'Marveo Workspace',
            clientEmail: draft.profile.contactEmail,
            clientName: draft.profile.ownerName || draft.profile.businessName,
          }),
        });

        const completionData = await safeJson<{
          clientEmailSent?: boolean;
          opsEmailSent?: boolean;
        }>(completionRes);

        if (!completionRes.ok) {
          const completionError = await safeJson<{ error?: string }>(completionRes);
          withPhaseStatus('support', 'done', `Workspace ready (notification warning: ${completionError?.error || 'email dispatch unavailable'})`);
        } else {
          const clientEmailSent = Boolean(completionData?.clientEmailSent);
          const opsEmailSent = Boolean(completionData?.opsEmailSent);
          withPhaseStatus(
            'support',
            'done',
            clientEmailSent && opsEmailSent
              ? 'Client and operations notifications sent'
              : 'Workspace ready (some notifications were skipped)',
          );
        }

        withPhaseStatus('check', 'running', 'Finalizing onboarding handoff');
        await callOnboardingUpdate(nextWorkspaceId, {
          onboardingStepKey: 'LAUNCH_CHECKLIST_READY',
          action: 'complete',
          onboardingStatus: 'READY_FOR_REVIEW',
          websiteType: draft.websiteType,
        });
        withPhaseStatus('check', 'done', 'Handoff completed. Continue in OS Setup Center');
        setWizardStep('ready');
        return;
      }

      await callOnboardingUpdate(nextWorkspaceId, {
        onboardingStepKey: 'DEPLOYMENT_STARTED',
        action: 'complete',
        onboardingStatus: 'DEPLOYING',
        websiteType: draft.websiteType,
      });

      await callOnboardingUpdate(nextWorkspaceId, {
        onboardingStepKey: 'WORKSPACE_CREATED',
        action: 'complete',
        onboardingStatus: 'IN_PROGRESS',
        websiteType: draft.websiteType,
      });

      withPhaseStatus('connect', 'done', 'Website setup details saved');

      withPhaseStatus('support', 'running', 'Assigning support officer');

      if (effectiveSupportNeeded) {
        const supportPayload: SupportAssignmentContract = {
          workspaceId: nextWorkspaceId,
          clientId: draft.profile.contactEmail || draft.profile.businessName,
          priority: draft.websiteType === 'CUSTOM_HEADLESS' ? 'HIGH' : 'MEDIUM',
          reason:
            draft.websiteType === 'CUSTOM_HEADLESS'
              ? 'Custom integration onboarding'
              : draft.existingConnectionChoice === 'manual'
                ? 'Client requested manual support setup for WordPress connector installation'
                : 'Onboarding support required',
          setupType: draft.websiteType || 'NEW_WEBSITE',
          requiredSkills:
            draft.websiteType === 'CUSTOM_HEADLESS'
              ? ['API Integration', 'Headless Architecture']
              : draft.websiteType === 'EXISTING_WEBSITE'
                ? ['WordPress', 'Migration']
                : ['Template Setup', 'Content Structure'],
          initialNotes: 'Please prioritize onboarding handoff.',
        };

        const supportRes = await fetch(`/api/cloud/workspaces/${nextWorkspaceId}/support-assignment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...supportPayload,
            supportOfficerId: 'support-queue',
            supportOfficerName: 'Marveo Support Queue',
          }),
        });

        if (!supportRes.ok) {
          const supportData = await safeJson<{ error?: string }>(supportRes);
          throw new Error(supportData?.error || 'Support assignment failed');
        }

        await callOnboardingUpdate(nextWorkspaceId, {
          onboardingStepKey: 'SUPPORT_ASSIGNED',
          action: 'complete',
          onboardingStatus: 'READY_FOR_REVIEW',
          websiteType: draft.websiteType,
        });

        withPhaseStatus('support', 'done', 'Support officer assigned');
      } else {
        withPhaseStatus('support', 'done', 'Support assignment not required');
      }

      withPhaseStatus('check', 'running', 'Checking launch readiness');

      const checklistRes = await fetch(`/api/cloud/workspaces/${nextWorkspaceId}/launch-checklist`, { method: 'GET' });

      if (!checklistRes.ok) {
        const checklistData = await safeJson<{ error?: string }>(checklistRes);
        throw new Error(checklistData?.error || 'Launch checklist could not be loaded');
      }

      const checklistData = await safeJson<LaunchChecklistContract>(checklistRes);
      if (checklistData) setChecklist(checklistData);

      await callOnboardingUpdate(nextWorkspaceId, {
        onboardingStepKey: 'LAUNCH_CHECKLIST_READY',
        action: 'complete',
        onboardingStatus: checklistData?.readyForLaunch ? 'READY_FOR_LAUNCH' : 'READY_FOR_REVIEW',
        websiteType: draft.websiteType,
      });

      withPhaseStatus('check', 'done', 'Launch readiness checked');
      setWizardStep('ready');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong while preparing onboarding.';
      setError(message);
      setPhases((prev) => {
        const active = prev.find((phase) => phase.status === 'running');
        if (!active) return prev;
        return prev.map((phase) => (phase.key === active.key ? { ...phase, status: 'failed', note: message } : phase));
      });
    } finally {
      setLoading(false);
    }
  }

  const currentWizardStep = isInitialOnboardingStepAllowed(draft.wizardStep)
    ? draft.wizardStep
    : getNextAllowedInitialOnboardingStep(draft.wizardStep);

  const progressStep =
    currentWizardStep === 'plan'
      ? 0
      : currentWizardStep === 'profile'
        ? 1
        : currentWizardStep === 'review'
          ? 2
          : currentWizardStep === 'deploying'
            ? 3
            : 4;

  const terminalLogs = phases.map((p) => `${p.label}: ${p.note || p.status}`);
  const businessModelOptions = withCurrentOption(profileLookups.businessModels, draft.profile.businessModel);
  const countryOptions = withCurrentOption(profileLookups.countries, draft.profile.country);
  const sectorOptions = getSectorsForBusinessType(draft.profile.businessType);
  const professionOptions = getProfessionsForSector(draft.profile.sector);
  const professionIsRequired = sectorRequiresProfession(draft.profile.sector);
  const nigerianStates = getNigerianStates();
  const nigerianCities = getCitiesForStates(draft.profile.coverageStates);

  if (!enabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a1020] to-[#101c2c]">
        <GlassCard className="max-w-2xl w-full p-10 border-blue-900/30">
          <p className="text-xs uppercase tracking-[0.3em] text-blue-400 font-semibold mb-2">Marveo OS Installation</p>
          <h1 className="text-3xl font-bold text-white mb-2">Onboarding is currently disabled</h1>
          <p className="text-slate-300 mb-6">Ask your administrator to enable this onboarding flow or continue with the standard setup flow.</p>
          <div className="flex gap-3">
            <a href="/setup" className="px-5 py-3 rounded-full bg-blue-800 text-white font-semibold">Back to setup</a>
            <a href="/setup/activate" className="px-5 py-3 rounded-full bg-slate-800 text-blue-200 font-semibold">Open current setup</a>
          </div>
        </GlassCard>
      </div>
    );
  }

  if (entitlementState.status === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a1020] to-[#101c2c]">
        <GlassCard className="max-w-2xl w-full p-10 border-blue-900/30">
          <p className="text-xs uppercase tracking-[0.3em] text-blue-400 font-semibold mb-2">Marveo OS Installation</p>
          <h1 className="text-3xl font-bold text-white mb-2">Checking your onboarding access</h1>
          <p className="text-slate-300">Verifying trial/subscription entitlement and onboarding session.</p>
        </GlassCard>
      </div>
    );
  }

  if (entitlementState.status === 'trial_expired') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a1020] to-[#101c2c]">
        <GlassCard className="max-w-2xl w-full p-10 border-amber-700/40">
          <p className="text-xs uppercase tracking-[0.3em] text-amber-300 font-semibold mb-2">Subscription Required</p>
          <h1 className="text-3xl font-bold text-white mb-2">Trial expired</h1>
          <p className="text-slate-300 mb-6">{entitlementState.message}</p>
          <div className="flex gap-3">
            <a href="/login" className="px-5 py-3 rounded-full bg-slate-800 text-white font-semibold">Sign in</a>
            <a href={entitlementState.upgradeUrl || marketingPricingUrl} className="px-5 py-3 rounded-full bg-amber-500 text-slate-950 font-semibold">Upgrade plan</a>
          </div>
        </GlassCard>
      </div>
    );
  }

  if (entitlementState.status === 'blocked') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a1020] to-[#101c2c]">
        <GlassCard className="max-w-2xl w-full p-10 border-blue-900/30">
          <p className="text-xs uppercase tracking-[0.3em] text-blue-400 font-semibold mb-2">Marveo OS Installation</p>
          <h1 className="text-3xl font-bold text-white mb-2">Start from pricing to continue</h1>
          <p className="text-slate-300 mb-6">{entitlementState.message || 'You need an active trial or subscription to access onboarding.'}</p>
          <a href={entitlementState.upgradeUrl || marketingPricingUrl} className="px-5 py-3 rounded-full bg-blue-700 text-white font-semibold">Open pricing</a>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#0a1020] to-[#101c2c] relative overflow-hidden">
      <div className="pointer-events-none absolute -left-16 top-10 h-56 w-56 rounded-full bg-cyan-500/20 blur-3xl animate-float-slow" />
      <div className="pointer-events-none absolute -right-12 bottom-12 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl animate-float-slower" />
      <div className="absolute inset-0 pointer-events-none z-0 animate-fade-in">
        <svg width="100%" height="100%" className="absolute inset-0 w-full h-full" style={{ opacity: 0.12 }}>
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#3b4261" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      <div className="relative z-10 mx-auto max-w-4xl px-3 py-10 md:px-0 md:py-16 flex flex-col gap-8">
        <GlassCard className="p-8 md:p-12 border-blue-900/30 shadow-2xl mvp-panel-enter">
          <p className="text-xs uppercase tracking-[0.3em] text-blue-400 font-semibold mb-2">Marveo OS Installation</p>
          <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-2">Installing Marveo OS for your business</h1>
          <p className="text-slate-300 max-w-2xl mb-3">A premium guided install with secure handoff, production-safe defaults, and launch readiness checks.</p>
          <p className="text-slate-400 text-sm max-w-2xl">Estimated setup time: 3-5 minutes. You can pause and resume from this browser at any point.</p>

          <AnimatedProgressRail
            steps={['Plan', 'Profile', 'Review', 'Install', 'Ready']}
            currentStep={progressStep}
          />

          <div className="mt-4 grid gap-2 md:grid-cols-3 text-xs">
            <div className="rounded-full border border-cyan-800/70 bg-cyan-950/40 px-3 py-2 text-cyan-200">Secure onboarding contract</div>
            <div className="rounded-full border border-indigo-800/70 bg-indigo-950/40 px-3 py-2 text-indigo-200">Support handoff automation</div>
            <div className="rounded-full border border-emerald-800/70 bg-emerald-950/40 px-3 py-2 text-emerald-200">Launch checklist verification</div>
          </div>

          {error ? <p className="mt-4 text-red-300 text-sm">{error}</p> : null}
          {stepGuardMessage ? <p className="mt-3 text-xs text-cyan-200">{stepGuardMessage}</p> : null}

          {currentWizardStep === 'plan' && (
            <section className="mt-8 space-y-4">
              <h2 className="text-2xl text-white font-semibold">Choose your plan</h2>
              <p className="text-sm text-slate-400">Pick a baseline. You can adjust plan details after workspace provisioning.</p>
              <div className="grid md:grid-cols-3 gap-3">
                {PLAN_OPTIONS.map((plan) => (
                  <button
                    key={plan.id}
                    onClick={() => setDraft((prev) => ({ ...prev, planId: plan.id }))}
                    className={`rounded-2xl border p-4 text-left transition ${
                      draft.planId === plan.id
                        ? 'border-blue-400 bg-blue-900/40 text-white'
                        : 'border-slate-600 bg-slate-900/50 text-slate-200 hover:border-slate-400'
                    }`}
                  >
                    <p className="font-semibold">{plan.name}</p>
                    <p className="text-sm mt-1 opacity-80">{plan.description}</p>
                  </button>
                ))}
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => setWizardStep('profile')}
                  disabled={!canMoveFromPlan}
                  className="px-5 py-3 rounded-full bg-blue-700 text-white font-semibold disabled:opacity-50"
                >
                  Continue
                </button>
              </div>
            </section>
          )}

          {currentWizardStep === 'profile' && (
            <section className="mt-8 space-y-4">
              <h2 className="text-2xl text-white font-semibold">Business profile</h2>
              <p className="text-sm text-slate-400">This information configures workspace identity, profession-aware provisioning, and operational defaults.</p>
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <input value={draft.profile.ownerName} onChange={(e) => setDraft((prev) => ({ ...prev, profile: { ...prev.profile, ownerName: e.target.value } }))} placeholder="Owner name" className="w-full rounded-xl bg-slate-900/70 border border-slate-600 px-4 py-3 text-white" />
                  {profileErrors.ownerName ? <p className="mt-1 text-xs text-red-300">{profileErrors.ownerName}</p> : null}
                </div>
                <div>
                <input value={draft.profile.businessName} onChange={(e) => setDraft((prev) => ({ ...prev, profile: { ...prev.profile, businessName: e.target.value } }))} placeholder="Business name" className="rounded-xl bg-slate-900/70 border border-slate-600 px-4 py-3 text-white" />
                  {profileErrors.businessName ? <p className="mt-1 text-xs text-red-300">{profileErrors.businessName}</p> : null}
                </div>
                <label className="rounded-xl bg-slate-900/70 border border-slate-600 px-4 py-3 text-white">
                  <span className="mb-1 block text-xs uppercase tracking-wide text-slate-400">Business type</span>
                  <select
                    value={draft.profile.businessType}
                    onChange={(e) => setDraft((prev) => ({
                      ...prev,
                      profile: {
                        ...prev.profile,
                        businessType: e.target.value,
                        sector: '',
                        professionKey: '',
                        professionLabel: '',
                        customProfessionName: '',
                      },
                    }))}
                    className="w-full bg-transparent text-white focus:outline-none"
                  >
                    {businessTypes.map((option) => (
                      <option key={option.key} value={option.key} className="bg-slate-900 text-white">
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {profileErrors.businessType ? <p className="mt-1 text-xs text-red-300">{profileErrors.businessType}</p> : null}
                </label>
                {draft.profile.businessType === 'Other' ? (
                  <div>
                    <input
                      value={draft.profile.customBusinessType}
                      onChange={(e) => setDraft((prev) => ({ ...prev, profile: { ...prev.profile, customBusinessType: e.target.value } }))}
                      placeholder="Custom business type"
                      className="w-full rounded-xl bg-slate-900/70 border border-slate-600 px-4 py-3 text-white"
                    />
                    <p className="mt-1 text-xs text-slate-400">Optional unless Business Type is Other.</p>
                  </div>
                ) : null}
                <label className="rounded-xl bg-slate-900/70 border border-slate-600 px-4 py-3 text-white">
                  <span className="mb-1 block text-xs uppercase tracking-wide text-slate-400">Sector</span>
                  <select
                    value={draft.profile.sector}
                    onChange={(e) => setDraft((prev) => ({
                      ...prev,
                      profile: {
                        ...prev.profile,
                        sector: e.target.value,
                      },
                      newWebsiteData: prev.websiteType === 'NEW_WEBSITE'
                        ? {
                            ...prev.newWebsiteData,
                            ...getNewWebsiteDefaults({ sector: e.target.value, professionKey: prev.profile.professionKey }),
                          }
                        : prev.newWebsiteData,
                    }))}
                    className="w-full bg-transparent text-white focus:outline-none"
                  >
                    <option value="" className="bg-slate-900 text-white">Select sector</option>
                    {sectorOptions.map((option) => (
                      <option key={option.key} value={option.key} className="bg-slate-900 text-white">{option.label}</option>
                    ))}
                  </select>
                  {profileErrors.sector ? <p className="mt-1 text-xs text-red-300">{profileErrors.sector}</p> : null}
                </label>
                <label className="rounded-xl bg-slate-900/70 border border-slate-600 px-4 py-3 text-white">
                  <span className="mb-1 block text-xs uppercase tracking-wide text-slate-400">Profession</span>
                  <select
                    value={draft.profile.professionKey}
                    onChange={(e) => setDraft((prev) => ({
                      ...prev,
                      profile: {
                        ...prev.profile,
                        professionKey: e.target.value,
                        professionLabel: professionOptions.find((item) => item.key === e.target.value)?.label || '',
                      },
                      newWebsiteData: prev.websiteType === 'NEW_WEBSITE'
                        ? {
                            ...prev.newWebsiteData,
                            ...getNewWebsiteDefaults({ sector: prev.profile.sector, professionKey: e.target.value }),
                          }
                        : prev.newWebsiteData,
                    }))}
                    className="w-full bg-transparent text-white focus:outline-none"
                  >
                    <option value="" className="bg-slate-900 text-white">Select profession{professionIsRequired ? '' : ' (optional)'}</option>
                    {professionOptions.map((option) => (
                      <option key={option.key} value={option.key} className="bg-slate-900 text-white">{option.label}</option>
                    ))}
                  </select>
                  {profileErrors.professionKey ? <p className="mt-1 text-xs text-red-300">{profileErrors.professionKey}</p> : null}
                </label>
                {draft.profile.professionKey === 'other' ? (
                  <div>
                    <input
                      value={draft.profile.customProfessionName}
                      onChange={(e) => setDraft((prev) => ({ ...prev, profile: { ...prev.profile, customProfessionName: e.target.value, professionLabel: e.target.value } }))}
                      placeholder="Custom profession name"
                      className="w-full rounded-xl bg-slate-900/70 border border-slate-600 px-4 py-3 text-white"
                    />
                    {profileErrors.customProfessionName ? <p className="mt-1 text-xs text-red-300">{profileErrors.customProfessionName}</p> : null}
                  </div>
                ) : null}
                <label className="rounded-xl bg-slate-900/70 border border-slate-600 px-4 py-3 text-white">
                  <span className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-slate-400">
                    Business model
                    <span
                      className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-500 text-[10px] font-bold text-slate-300"
                      title="Business to Consumer: direct sales to individual customers. Business to Business: sales to companies, usually with account or bulk workflows."
                    >
                      ?
                    </span>
                  </span>
                  <select
                    value={draft.profile.businessModel}
                    onChange={(e) => setDraft((prev) => ({ ...prev, profile: { ...prev.profile, businessModel: e.target.value } }))}
                    className="w-full bg-transparent text-white focus:outline-none"
                  >
                    {businessModelOptions.map((option) => (
                      <option
                        key={option}
                        value={option}
                        className="bg-slate-900 text-white"
                        title={BUSINESS_MODEL_TOOLTIPS[option] ?? option}
                      >
                        {BUSINESS_MODEL_LABELS[option] ?? option}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="rounded-xl bg-slate-900/70 border border-slate-600 px-4 py-3 text-white">
                  <span className="mb-1 block text-xs uppercase tracking-wide text-slate-400">Country</span>
                  <select
                    value={draft.profile.country}
                    onChange={(e) => setDraft((prev) => ({ ...prev, profile: { ...prev.profile, country: e.target.value } }))}
                    className="w-full bg-transparent text-white focus:outline-none"
                  >
                    {countryOptions.map((option) => (
                      <option key={option} value={option} className="bg-slate-900 text-white">
                        {option}
                      </option>
                    ))}
                  </select>
                  {profileErrors.country ? <p className="mt-1 text-xs text-red-300">{profileErrors.country}</p> : null}
                </label>
                <label className="rounded-xl bg-slate-900/70 border border-slate-600 px-4 py-3 text-white">
                  <span className="mb-1 block text-xs uppercase tracking-wide text-slate-400">Payment currency</span>
                  <select
                    value={draft.profile.paymentCurrency}
                    onChange={(e) => setDraft((prev) => ({ ...prev, profile: { ...prev.profile, paymentCurrency: e.target.value } }))}
                    className="w-full bg-transparent text-white focus:outline-none"
                  >
                    {['USD', 'NGN', 'GBP', 'EUR'].map((currency) => (
                      <option key={currency} value={currency} className="bg-slate-900 text-white">{currency}</option>
                    ))}
                  </select>
                  {profileErrors.paymentCurrency ? <p className="mt-1 text-xs text-red-300">{profileErrors.paymentCurrency}</p> : null}
                </label>
                <div>
                  <input value={draft.profile.contactEmail} onChange={(e) => setDraft((prev) => ({ ...prev, profile: { ...prev.profile, contactEmail: e.target.value } }))} placeholder="Contact email" className="w-full rounded-xl bg-slate-900/70 border border-slate-600 px-4 py-3 text-white" />
                  {profileErrors.contactEmail ? <p className="mt-1 text-xs text-red-300">{profileErrors.contactEmail}</p> : null}
                </div>
                <input value={draft.profile.contactPhone} onChange={(e) => setDraft((prev) => ({ ...prev, profile: { ...prev.profile, contactPhone: e.target.value } }))} placeholder="Contact phone (optional)" className="rounded-xl bg-slate-900/70 border border-slate-600 px-4 py-3 text-white" />
                <input value={draft.profile.domain} onChange={(e) => setDraft((prev) => ({ ...prev, profile: { ...prev.profile, domain: e.target.value } }))} placeholder="Website URL (optional)" className="rounded-xl bg-slate-900/70 border border-slate-600 px-4 py-3 text-white" />
              </div>

              <div className="rounded-2xl border border-slate-700 bg-slate-900/40 p-4 space-y-3">
                <p className="text-sm font-semibold text-white">Coverage area</p>
                {draft.profile.country.toLowerCase().includes('nigeria') ? (
                  <>
                    <div>
                      <p className="text-xs text-slate-300 mb-2">Select one or more states</p>
                      <div className="grid md:grid-cols-3 gap-2 text-sm">
                        {nigerianStates.map((state) => (
                          <label key={state} className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-slate-200">
                            <input
                              type="checkbox"
                              checked={draft.profile.coverageStates.includes(state)}
                              onChange={(e) => setDraft((prev) => ({
                                ...prev,
                                profile: {
                                  ...prev.profile,
                                  coverageStates: e.target.checked
                                    ? [...prev.profile.coverageStates, state]
                                    : prev.profile.coverageStates.filter((item) => item !== state),
                                  coverageCities: e.target.checked
                                    ? prev.profile.coverageCities
                                    : prev.profile.coverageCities.filter((city) => getCitiesForStates(prev.profile.coverageStates.filter((item) => item !== state)).includes(city)),
                                },
                              }))}
                            />
                            {state}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-slate-300 mb-2">Select one or more cities</p>
                      <div className="grid md:grid-cols-3 gap-2 text-sm">
                        {nigerianCities.map((city) => (
                          <label key={city} className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-slate-200">
                            <input
                              type="checkbox"
                              checked={draft.profile.coverageCities.includes(city)}
                              onChange={(e) => setDraft((prev) => ({
                                ...prev,
                                profile: {
                                  ...prev.profile,
                                  coverageCities: e.target.checked
                                    ? [...prev.profile.coverageCities, city]
                                    : prev.profile.coverageCities.filter((item) => item !== city),
                                },
                              }))}
                            />
                            {city}
                          </label>
                        ))}
                      </div>
                    </div>
                  </>
                ) : null}
                <div>
                  <textarea
                    value={draft.profile.customCoverageAreas.join(', ')}
                    onChange={(e) => setDraft((prev) => ({
                      ...prev,
                      profile: {
                        ...prev.profile,
                        customCoverageAreas: parseCsvToArray(e.target.value),
                      },
                    }))}
                    placeholder="Custom coverage areas (comma separated)"
                    className="w-full rounded-xl bg-slate-900/70 border border-slate-600 px-4 py-3 text-white"
                  />
                  <p className="mt-1 text-xs text-slate-400">Use this when your city is not listed.</p>
                  {profileErrors.coverageStates ? <p className="mt-1 text-xs text-red-300">{profileErrors.coverageStates}</p> : null}
                  {profileErrors.customCoverageAreas ? <p className="mt-1 text-xs text-red-300">{profileErrors.customCoverageAreas}</p> : null}
                </div>
              </div>

              <label className="flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-slate-200 text-sm">
                <input type="checkbox" checked={draft.profile.termsAccepted} onChange={(e) => setDraft((prev) => ({ ...prev, profile: { ...prev.profile, termsAccepted: e.target.checked } }))} />
                <span>
                  I accept the
                  {' '}
                  <button
                    type="button"
                    onClick={() => setShowTermsModal(true)}
                    className="text-cyan-300 underline underline-offset-2 hover:text-cyan-200"
                  >
                    onboarding terms
                  </button>
                  {' '}
                  and operational setup policies.
                </span>
              </label>
              <p className="text-xs text-slate-400">
                You can also open the full page at
                {' '}
                <a href="/legal/onboarding-terms" target="_blank" rel="noreferrer" className="text-cyan-300 underline underline-offset-2 hover:text-cyan-200">/legal/onboarding-terms</a>
                .
              </p>
              {profileErrors.termsAccepted ? <p className="text-xs text-red-300">{profileErrors.termsAccepted}</p> : null}

              {draft.profile.professionKey === 'makeup-artist' && (
                <div className="rounded-2xl border border-fuchsia-900/30 bg-fuchsia-950/10 p-4 space-y-3">
                  <p className="text-sm font-semibold text-fuchsia-100">Makeup Artist onboarding</p>
                  <p className="text-xs text-fuchsia-200/80">Answer these to personalize your workspace modules, checklist, and dashboard.</p>

                  <div className="grid md:grid-cols-2 gap-3 text-sm">
                    <label className="flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-slate-200">
                      <input type="checkbox" checked={draft.makeupArtist.offersBridalMakeup} onChange={(e) => setDraft((prev) => ({ ...prev, makeupArtist: { ...prev.makeupArtist, offersBridalMakeup: e.target.checked } }))} />
                      Do you offer bridal makeup?
                    </label>
                    <label className="flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-slate-200">
                      <input type="checkbox" checked={draft.makeupArtist.offersStudioAppointments} onChange={(e) => setDraft((prev) => ({ ...prev, makeupArtist: { ...prev.makeupArtist, offersStudioAppointments: e.target.checked } }))} />
                      Do you offer studio appointments?
                    </label>
                    <label className="flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-slate-200">
                      <input type="checkbox" checked={draft.makeupArtist.offersHomeService} onChange={(e) => setDraft((prev) => ({ ...prev, makeupArtist: { ...prev.makeupArtist, offersHomeService: e.target.checked } }))} />
                      Do you offer home service?
                    </label>
                    <label className="flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-slate-200">
                      <input type="checkbox" checked={draft.makeupArtist.requiresDepositBeforeBooking} onChange={(e) => setDraft((prev) => ({ ...prev, makeupArtist: { ...prev.makeupArtist, requiresDepositBeforeBooking: e.target.checked } }))} />
                      Do you require deposit before booking?
                    </label>
                  </div>

                  <div className="grid md:grid-cols-2 gap-3">
                    <input value={draft.makeupArtist.defaultDeposit} onChange={(e) => setDraft((prev) => ({ ...prev, makeupArtist: { ...prev.makeupArtist, defaultDeposit: e.target.value } }))} placeholder="Default deposit (e.g. 30% or 5000 NGN)" className="rounded-xl bg-slate-900/70 border border-slate-600 px-4 py-3 text-white" />
                    <input value={draft.makeupArtist.availabilityDays} onChange={(e) => setDraft((prev) => ({ ...prev, makeupArtist: { ...prev.makeupArtist, availabilityDays: e.target.value } }))} placeholder="Available days (e.g. Tue-Sun)" className="rounded-xl bg-slate-900/70 border border-slate-600 px-4 py-3 text-white" />
                    <input value={draft.makeupArtist.serviceLocation} onChange={(e) => setDraft((prev) => ({ ...prev, makeupArtist: { ...prev.makeupArtist, serviceLocation: e.target.value } }))} placeholder="City/location served" className="rounded-xl bg-slate-900/70 border border-slate-600 px-4 py-3 text-white" />
                    <label className="rounded-xl bg-slate-900/70 border border-slate-600 px-4 py-3 text-white">
                      <span className="mb-1 block text-xs uppercase tracking-wide text-slate-400">Do you work alone or with a team?</span>
                      <select value={draft.makeupArtist.teamMode} onChange={(e) => setDraft((prev) => ({ ...prev, makeupArtist: { ...prev.makeupArtist, teamMode: e.target.value === 'TEAM' ? 'TEAM' : 'ALONE' } }))} className="w-full bg-transparent text-white focus:outline-none">
                        <option value="ALONE" className="bg-slate-900 text-white">I work alone</option>
                        <option value="TEAM" className="bg-slate-900 text-white">I work with a team</option>
                      </select>
                    </label>
                  </div>

                  <div className="grid md:grid-cols-2 gap-3 text-sm">
                    <label className="flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-slate-200">
                      <input type="checkbox" checked={draft.makeupArtist.enableOnlineBooking} onChange={(e) => setDraft((prev) => ({ ...prev, makeupArtist: { ...prev.makeupArtist, enableOnlineBooking: e.target.checked } }))} />
                      Do you want clients to book online?
                    </label>
                    <label className="flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-slate-200">
                      <input type="checkbox" checked={draft.makeupArtist.enableWhatsappEnquiriesFirst} onChange={(e) => setDraft((prev) => ({ ...prev, makeupArtist: { ...prev.makeupArtist, enableWhatsappEnquiriesFirst: e.target.checked } }))} />
                      Do you want WhatsApp enquiries enabled first?
                    </label>
                  </div>
                </div>
              )}

              <div className="flex justify-between">
                <button onClick={() => setWizardStep('plan')} className="px-5 py-3 rounded-full bg-slate-700 text-white font-semibold">Back</button>
                <button onClick={continueFromProfile} className="px-5 py-3 rounded-full bg-blue-700 text-white font-semibold">Continue</button>
              </div>
            </section>
          )}

          {currentWizardStep === 'website_type' && (
            <section className="mt-8 space-y-4">
              <h2 className="text-2xl text-white font-semibold">Select website type</h2>
              <p className="text-sm text-slate-400">Choose how Marveo OS integrates with your current architecture.</p>
              <div className="grid md:grid-cols-3 gap-3">
                {WEBSITE_TYPE_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    onClick={() =>
                      setDraft((prev) => ({
                        ...prev,
                        websiteType: option.key,
                        selectedTemplateId: option.key === 'NEW_WEBSITE' ? prev.selectedTemplateId : '',
                        newWebsiteData: {
                          ...prev.newWebsiteData,
                          selectedTemplateId: option.key === 'NEW_WEBSITE' ? prev.newWebsiteData.selectedTemplateId : '',
                        },
                      }))
                    }
                    className={`rounded-2xl border p-4 text-left ${
                      draft.websiteType === option.key
                        ? 'border-blue-400 bg-blue-900/40 text-white'
                        : 'border-slate-600 bg-slate-900/50 text-slate-200'
                    }`}
                  >
                    <p className="font-semibold">{option.label}</p>
                  </button>
                ))}
              </div>
              <div className="flex justify-between">
                <button onClick={() => setWizardStep('profile')} className="px-5 py-3 rounded-full bg-slate-700 text-white font-semibold">Back</button>
                <button onClick={() => setWizardStep('details')} disabled={!canMoveFromType} className="px-5 py-3 rounded-full bg-blue-700 text-white font-semibold disabled:opacity-50">Continue</button>
              </div>
            </section>
          )}

          {currentWizardStep === 'details' && (
            <section className="mt-8 space-y-4">
              <h2 className="text-2xl text-white font-semibold">Setup details</h2>
              <p className="text-sm text-slate-400">Provide deployment details so we can build the exact onboarding path for your stack.</p>

              {draft.websiteType === 'NEW_WEBSITE' && (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-cyan-900/40 bg-cyan-950/20 p-4 text-sm text-slate-200">
                    <p className="font-semibold text-white">Website domain strategy</p>
                    <p className="mt-1 text-slate-300">Frontend domain is what customers will visit. Backend CMS subdomain is where WordPress will run behind the scenes.</p>
                  </div>
                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <input
                        value={draft.newWebsiteData.frontendDomain}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            newWebsiteData: {
                              ...prev.newWebsiteData,
                              frontendDomain: e.target.value,
                              domain: e.target.value,
                              domainStrategy: 'HEADLESS_WORDPRESS',
                            },
                          }))
                        }
                        placeholder="Frontend domain (example.com)"
                        className="rounded-xl bg-slate-900/70 border border-slate-600 px-4 py-3 text-white w-full"
                      />
                      <p className="text-xs text-slate-400">Frontend domain: your public website, e.g. example.com</p>
                    </div>
                    <div className="space-y-2">
                      <input
                        value={draft.newWebsiteData.backendCmsSubdomain}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            newWebsiteData: {
                              ...prev.newWebsiteData,
                              backendCmsSubdomain: e.target.value,
                              domainStrategy: 'HEADLESS_WORDPRESS',
                            },
                          }))
                        }
                        placeholder="Backend CMS subdomain (cms.example.com)"
                        className="rounded-xl bg-slate-900/70 border border-slate-600 px-4 py-3 text-white w-full"
                      />
                      <p className="text-xs text-slate-400">Backend CMS subdomain: your WordPress admin/backend, e.g. cms.example.com</p>
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-3">
                    <input value={draft.newWebsiteData.domain} onChange={(e) => setDraft((prev) => ({ ...prev, newWebsiteData: { ...prev.newWebsiteData, domain: e.target.value, frontendDomain: e.target.value } }))} placeholder="Primary website domain" className="rounded-xl bg-slate-900/70 border border-slate-600 px-4 py-3 text-white" />
                    <input value={draft.newWebsiteData.contactInfo.email} onChange={(e) => setDraft((prev) => ({ ...prev, newWebsiteData: { ...prev.newWebsiteData, contactInfo: { ...prev.newWebsiteData.contactInfo, email: e.target.value } } }))} placeholder="Contact email" className="rounded-xl bg-slate-900/70 border border-slate-600 px-4 py-3 text-white" />
                  </div>
                  {templatesLoading ? (
                    <div className="rounded-2xl border border-slate-700 bg-slate-900/50 p-4 text-sm text-slate-300">Loading templates...</div>
                  ) : templateOptions.length === 0 ? (
                    <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100">
                      No publishable templates are currently available for this plan and country.
                    </div>
                  ) : (
                    <div className="grid md:grid-cols-3 gap-3">
                      {templateOptions.map((template) => (
                        <button
                          key={template.templateId}
                          onClick={() => setDraft((prev) => ({ ...prev, selectedTemplateId: template.templateId, newWebsiteData: { ...prev.newWebsiteData, selectedTemplateId: template.templateId } }))}
                          className={`rounded-2xl border p-4 text-left ${draft.selectedTemplateId === template.templateId ? 'border-blue-400 bg-blue-900/40 text-white' : 'border-slate-600 bg-slate-900/50 text-slate-200'}`}
                        >
                          <p className="font-semibold">{template.name}</p>
                          <p className="text-xs opacity-80 mt-1">{template.description}</p>
                          <p className="mt-2 text-[11px] uppercase tracking-wide opacity-70">{template.businessType}</p>
                        </button>
                      ))}
                    </div>
                  )}
                  {templatesError ? (
                    <p className="text-xs text-amber-200">{templatesError}</p>
                  ) : null}
                </div>
              )}

              {draft.websiteType === 'EXISTING_WEBSITE' && (
                <div className="space-y-3">
                  <div className="grid md:grid-cols-2 gap-3">
                    <input value={draft.existingWebsiteData.domain} onChange={(e) => setDraft((prev) => ({ ...prev, existingWebsiteData: { ...prev.existingWebsiteData, domain: e.target.value } }))} placeholder="Current website domain" className="rounded-xl bg-slate-900/70 border border-slate-600 px-4 py-3 text-white" />
                    <div className="space-y-2">
                      <input
                        value={draft.existingWebsiteData.wordpressAdminUrl || ''}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            existingWebsiteData: { ...prev.existingWebsiteData, wordpressAdminUrl: e.target.value },
                          }))
                        }
                        placeholder="WordPress Admin URL"
                        className="rounded-xl bg-slate-900/70 border border-slate-600 px-4 py-3 text-white w-full"
                      />
                      <p className="text-xs text-slate-400">Example: https://example.com/wp-admin</p>
                    </div>
                    <input value={connectorSiteMetadata?.platform || draft.existingWebsiteData.currentPlatform} readOnly placeholder="Detected platform" className="rounded-xl bg-slate-900/70 border border-slate-600 px-4 py-3 text-white md:col-span-2" />
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button onClick={() => setDraft((prev) => ({ ...prev, existingConnectionChoice: 'connector', existingWebsiteData: { ...prev.existingWebsiteData, connectionMethod: 'connector', supportRequired: false } }))} className={`px-4 py-2 rounded-full ${draft.existingConnectionChoice === 'connector' ? 'bg-blue-700 text-white' : 'bg-slate-700 text-slate-200'}`}>Connector setup</button>
                    <button onClick={requestSupportSetup} className={`px-4 py-2 rounded-full ${draft.existingConnectionChoice === 'manual' ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-200'}`}>Let a Marveo specialist assist</button>
                  </div>
                  <div className="rounded-2xl border border-amber-800/50 bg-amber-950/20 p-4 text-sm text-amber-100">
                    <p className="font-semibold text-amber-50">Prefer guided setup?</p>
                    <p className="mt-1">Our setup team can help install the connector, verify your WordPress site, and complete the connection safely.</p>
                  </div>
                  {draft.existingConnectionChoice === 'connector' && (
                    <div className="space-y-3">
                      <div className="rounded-2xl border border-blue-900/40 bg-blue-950/30 p-4 text-sm text-slate-200">
                        <p className="font-semibold text-white">Existing Website Connector Setup</p>
                        <ol className="mt-2 list-decimal pl-5 space-y-2 text-slate-300">
                          <li>
                            <span className="font-semibold text-slate-100">Download Connector</span>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <a
                                href={CONNECTOR_DOWNLOAD_URL}
                                className="inline-flex items-center rounded-full bg-cyan-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-600"
                              >
                                Download Connector Plugin (.zip)
                              </a>
                              <a
                                href={CONNECTOR_INSTALL_GUIDE_URL}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center rounded-full bg-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-slate-600"
                              >
                                View Installation Guide
                              </a>
                            </div>
                          </li>
                          <li><span className="font-semibold text-slate-100">Install Connector on WordPress</span></li>
                          <li><span className="font-semibold text-slate-100">Generate Secure Connection Token in WordPress Connector</span></li>
                          <li>
                            <span className="font-semibold text-slate-100">Paste Generated Secure Connection Token in Marveo</span>
                            <div className="mt-2">
                              <input
                                value={draft.existingWebsiteData.connectorToken}
                                type={connectorTokenFocused || showConnectorToken ? 'text' : 'password'}
                                onFocus={() => setConnectorTokenFocused(true)}
                                onBlur={() => setConnectorTokenFocused(false)}
                                onChange={(e) => {
                                  const nextToken = e.target.value;
                                  setDraft((prev) => ({
                                    ...prev,
                                    existingWebsiteData: {
                                      ...prev.existingWebsiteData,
                                      connectorToken: nextToken,
                                    },
                                  }));
                                  const hasToken = nextToken.trim().length > 0;
                                  setConnectionStatus(hasToken ? 'TOKEN_GENERATED' : 'NOT_CONNECTED');
                                }}
                                placeholder="Paste the Generated Secure Connection Token from WordPress"
                                className="rounded-xl bg-slate-950/90 border border-slate-700 px-4 py-3 text-white w-full font-mono"
                              />
                              <p className="mt-2 text-xs text-slate-400">Find this in WordPress Admin → Marvéo Connector → Connection Token. Copy the token and paste it here.</p>
                              <p className="mt-1 text-xs text-amber-200">Do not share this token publicly. It securely links your WordPress site to Marvéo.</p>
                              <div className="mt-3 flex flex-wrap gap-2">
                                <button onClick={() => setShowConnectorToken((current) => !current)} className="rounded-full bg-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-slate-600">
                                  {showConnectorToken ? 'Hide token' : 'Show token'}
                                </button>
                                <button onClick={clearConnectorToken} disabled={loading || connectorCheck.status === 'checking' || !draft.existingWebsiteData.connectorToken.trim()} className="rounded-full bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50">
                                  Clear token
                                </button>
                              </div>
                            </div>
                          </li>
                          <li>
                            <span className="font-semibold text-slate-100">Verify WordPress Connection</span>
                            <p className="mt-1 text-xs text-slate-400">Paste token into plugin settings, save connector, then click Verify WordPress Connection.</p>
                          </li>
                        </ol>
                      </div>
                      <div className="flex items-center gap-3">
                        <button onClick={checkConnectorPlugin} disabled={connectorCheck.status === 'checking'} className="px-4 py-2 rounded-full bg-blue-700 text-white text-sm font-semibold disabled:opacity-50">{connectorCheck.status === 'checking' ? 'Checking...' : 'Verify WordPress Connection'}</button>
                        {connectorCheck.message ? <p className="text-sm text-slate-300">{connectorCheck.message}</p> : null}
                      </div>
                      {connectorSiteMetadata ? (
                        <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-4 text-sm text-slate-200">
                          <p className="text-base font-semibold text-white">{discoverySummary[0]}</p>
                          <ul className="mt-2 space-y-1 text-slate-200">
                            {discoverySummary.slice(1, -1).map((line) => (
                              <li key={line}>{line}</li>
                            ))}
                          </ul>
                          <p className="mt-3 text-cyan-200">{discoverySummary[discoverySummary.length - 1]}</p>
                          <p className="mt-3 text-xs text-slate-400">WordPress version: {connectorSiteMetadata.wordpressVersion || 'Unknown'}</p>
                        </div>
                      ) : null}
                      <div className="text-sm text-slate-300">Connection status: {prettyConnectorStatus(connectionStatus)}</div>
                      <button onClick={requestSupportSetup} className="px-4 py-2 rounded-full bg-amber-700 text-white text-sm font-semibold">Let a Marveo specialist assist</button>
                    </div>
                  )}
                </div>
              )}

              {draft.websiteType === 'CUSTOM_HEADLESS' && (
                <div className="space-y-3">
                  <div className="grid md:grid-cols-2 gap-3">
                    <input value={draft.customHeadlessData.stack} onChange={(e) => setDraft((prev) => ({ ...prev, customHeadlessData: { ...prev.customHeadlessData, stack: e.target.value } }))} placeholder="Stack (Next.js, Nuxt, etc.)" className="rounded-xl bg-slate-900/70 border border-slate-600 px-4 py-3 text-white" />
                    <input value={draft.customHeadlessData.developerContact} onChange={(e) => setDraft((prev) => ({ ...prev, customHeadlessData: { ...prev.customHeadlessData, developerContact: e.target.value } }))} placeholder="Developer contact" className="rounded-xl bg-slate-900/70 border border-slate-600 px-4 py-3 text-white" />
                  </div>

                  {isWordPressLikeStack(draft.customHeadlessData.stack) ? (
                    <div className="rounded-2xl border border-blue-900/40 bg-blue-950/20 p-4 text-sm text-slate-200">
                      <p className="font-semibold text-white">Optional: Connect WordPress Backend</p>
                      <p className="mt-1 text-slate-300">Because your stack includes WordPress/WooCommerce, you can install Marveo Connector and verify a backend connection during onboarding.</p>
                    </div>
                  ) : null}
                </div>
              )}

              <div className="flex justify-between">
                <button onClick={() => setWizardStep('website_type')} className="px-5 py-3 rounded-full bg-slate-700 text-white font-semibold">Back</button>
                <button onClick={() => setWizardStep('review')} className="px-5 py-3 rounded-full bg-blue-700 text-white font-semibold">Review</button>
              </div>
            </section>
          )}

          {currentWizardStep === 'review' && (
            <section className="mt-8 space-y-4">
              <h2 className="text-2xl text-white font-semibold">Review and launch</h2>
              <p className="text-sm text-slate-400">Validate this summary, then start installation and orchestration.</p>
              <div className="rounded-2xl border border-slate-600 bg-slate-900/50 p-4 text-slate-200 text-sm space-y-1">
                <p>Plan: {draft.planId}</p>
                <p>Onboarding mode: Profile-first</p>
                <p>Business: {draft.profile.businessName || '-'}</p>
                <p>Email: {draft.profile.contactEmail || '-'}</p>
                <p>Support required: {supportNeeded || connectionStatus === 'SUPPORT_REQUIRED' ? 'Yes' : 'No'}</p>
                <p>Flow summary ready: {flowSummary ? 'Yes' : 'No'}</p>
                {workspaceEntitlement ? (
                  <>
                    <p>Active plan entitlement: {workspaceEntitlement.planId}</p>
                    <p>
                      Workspace allowance: {workspaceEntitlement.workspaceCount}/{workspaceEntitlement.workspaceLimit}
                      {' '}
                      used ({workspaceEntitlement.remainingWorkspaces} remaining)
                    </p>
                  </>
                ) : null}
              </div>
              {workspaceEntitlement && !workspaceEntitlement.hasCapacity ? (
                <p className="text-sm text-amber-200">
                  Workspace limit reached for your active plan. Upgrade to add another business workspace.
                </p>
              ) : null}
              <div className="flex justify-between">
                <button onClick={() => setWizardStep('profile')} className="px-5 py-3 rounded-full bg-slate-700 text-white font-semibold">Back</button>
                <button onClick={startDeployment} disabled={loading || Boolean(workspaceEntitlement && !workspaceEntitlement.hasCapacity)} className="px-5 py-3 rounded-full bg-emerald-700 text-white font-semibold disabled:opacity-50">Start installation</button>
              </div>
            </section>
          )}

          {currentWizardStep === 'deploying' && (
            <section className="mt-8 space-y-5">
              <h2 className="text-2xl text-white font-semibold">Installing workspace</h2>
              <p className="text-sm text-slate-400">Provisioning infrastructure and syncing onboarding milestones in real time.</p>
              <AnimatedChecklist progress={Math.min(phases.filter((p) => p.status === 'done').length, 6)} />
              <div className="space-y-2">
                {phases.map((phase) => (
                  <div key={phase.key} className="flex items-center justify-between rounded-xl bg-slate-900/50 border border-slate-700 px-4 py-3">
                    <div>
                      <p className="text-white text-sm font-semibold">{phase.label}</p>
                      {phase.note ? <p className="text-xs text-slate-300">{phase.note}</p> : null}
                    </div>
                    <StatusPill status={phase.status} />
                  </div>
                ))}
              </div>
              <TerminalPanel logs={terminalLogs} running={loading} />
            </section>
          )}

          {currentWizardStep === 'ready' && (
            <section className="mt-8 space-y-4">
              <h2 className="text-2xl text-white font-semibold">Workspace ready</h2>
              <p className="text-slate-300">Your Marveo OS workspace is provisioned and onboarding has completed successfully.</p>
              <div className="rounded-2xl border border-slate-600 bg-slate-900/50 p-4 text-slate-200 text-sm">
                <p>Workspace ID: {workspaceId || '-'}</p>
                <p>Launch ready: {checklist?.readyForLaunch ? 'Yes' : 'Needs review'}</p>
                <p>Checklist blockers: {checklist?.blockers.length || 0}</p>
                {workspaceEntitlement ? (
                  <p>
                    Workspace entitlement: {workspaceEntitlement.workspaceCount}/{workspaceEntitlement.workspaceLimit}
                    {' '}
                    used ({workspaceEntitlement.remainingWorkspaces} remaining)
                  </p>
                ) : null}
              </div>
              {workspaceEntitlement && !workspaceEntitlement.hasCapacity ? (
                <p className="text-sm text-amber-200">You have reached your workspace limit. Upgrade your plan to create another workspace.</p>
              ) : null}
              <div className="flex gap-3">
                <a href={workspaceId ? `/dashboard?workspaceId=${workspaceId}` : '/dashboard'} className="px-5 py-3 rounded-full bg-emerald-700 text-white font-semibold">Open dashboard</a>
                <button
                  onClick={() => {
                    setDraft(defaultDraft());
                    setWorkspaceId('');
                    setChecklist(null);
                    setPhases(INITIAL_PHASES);
                    setError('');
                    setStepGuardMessage('');
                  }}
                  className="px-5 py-3 rounded-full bg-slate-700 text-white font-semibold"
                >
                  Create another workspace
                </button>
              </div>
            </section>
          )}

          {showTermsModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4">
              <div className="w-full max-w-3xl rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-semibold text-white">Onboarding Terms</h3>
                    <p className="mt-1 text-sm text-slate-300">Version draft for pilot rollout. You can refine this text later in content/legal review.</p>
                  </div>
                  <button type="button" onClick={() => setShowTermsModal(false)} className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-semibold text-slate-200 hover:bg-slate-700">Close</button>
                </div>
                <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-2">
                  {ONBOARDING_TERMS_SECTIONS.map((section) => (
                    <div key={section.title} className="rounded-xl border border-slate-700 bg-slate-950/50 p-3">
                      <p className="text-sm font-semibold text-white">{section.title}</p>
                      <p className="mt-1 text-sm leading-relaxed text-slate-300">{section.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}

export default function SetupMvpPage() {
  return (
    <Suspense fallback={null}>
      <SetupMvpPageContent />
    </Suspense>
  );
}
