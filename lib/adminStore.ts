import { promises as fs } from 'node:fs';
import path from 'node:path';
import { cookies } from 'next/headers';
import { getWordPressApiBase } from '@/src/lib/endpoints';
import type { MaintenanceSettings } from '@/lib/types';

export type PortalAccess = 'b2c' | 'b2b';

export interface ManagedUserState {
  active: boolean;
  portals: PortalAccess[];
  masterRole?:
    | 'SUPER_ADMIN'
    | 'ADMIN'
    | 'SUPPORT_OFFICER'
    | 'DEPLOYMENT_MANAGER'
    | 'BILLING_MANAGER'
    | 'CLIENT_OWNER'
    | 'CLIENT_STAFF'
    | 'CONNECTED_WORDPRESS_ADMIN'
    | 'CONNECTED_WOOCOMMERCE_MANAGER';
  rawAuthRole?: string;
  status?: 'ACTIVE' | 'INVITED' | 'DISABLED';
  assignedWorkspaceId?: string;
  assignedClientOrganizationId?: string;
  invitePending?: boolean;
}

export type NativeRole =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'SUPPORT_OFFICER'
  | 'DEPLOYMENT_MANAGER'
  | 'BILLING_MANAGER'
  | 'CLIENT_OWNER'
  | 'CLIENT_STAFF';

export interface NativePlatformIdentity {
  id: string;
  email: string;
  name: string;
  userType: 'INTERNAL_USER' | 'CLIENT_USER';
  status: 'ACTIVE' | 'INVITED' | 'DISABLED';
  roles: NativeRole[];
  source: 'NATIVE' | 'WORDPRESS_BRIDGE';
  wordpressUserId?: number;
  organizationId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NativePlatformSession {
  id: string;
  userId: string;
  token: string;
  source: 'NATIVE' | 'WORDPRESS_BRIDGE';
  createdAt: string;
  expiresAt: string;
}

export interface PlatformSettings {
  trialDurationDays: number;
  pricingVisibility: 'PUBLIC' | 'INTERNAL';
  regionalPricingEnabled: boolean;
  paymentProvider: {
    provider: 'NONE' | 'PAYSTACK' | 'STRIPE';
    mode: 'sandbox' | 'live';
    configured: boolean;
  };
  demoMode: {
    enabled: boolean;
    allowOperationalMutations: boolean;
  };
  templatePublishRules: {
    requireArtifactValidation: boolean;
    requireSupportApproval: boolean;
  };
  supportDefaults: {
    defaultPriority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    defaultSetupType: 'NEW_WEBSITE' | 'EXISTING_WEBSITE' | 'CUSTOM_HEADLESS';
    defaultAssigneeId: string | null;
  };
}

export interface TrackingConfig {
  ecommerceDomain: string;
  googleAnalyticsId: string;
  googleTagManagerId: string;
  googleSearchConsoleVerification: string;
  metaPixelId: string;
  tiktokPixelId: string;
  whatsappChatEnabled: boolean;
  whatsappChatNumber: string;
  whatsappChatText: string;
  customHeadScripts: string;
  customBodyScripts: string;
  customFooterScripts: string;
}

export interface SmtpConfig {
  provider: 'microsoft365';
  useWordPressMailer: boolean;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  fromEmail: string;
  fromName: string;
}

export interface FormRoutingRule {
  formKey: string;
  formName: string;
  fromEmail: string;
  senderName: string;
  recipients: string[];
}

export interface AuditRecord {
  id: string;
  at: string;
  actorEmail: string;
  action: string;
  target: string;
  details?: string;
}

export type OnboardingStepStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'rolled_back';

export interface OnboardingStepState {
  step: number;
  key: string;
  status: OnboardingStepStatus;
  retryCount: number;
  maxRetries: number;
  startedAt?: string;
  completedAt?: string;
  lastError?: string;
  recoveryActions: string[];
}

export interface VersionedSchema<T> {
  version: number;
  status: 'draft' | 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
  data: T;
}

export interface PageSchemaData {
  pages: Array<{
    id: string;
    title: string;
    slug: string;
    page_type: string;
    source: string;
    seo: Record<string, unknown>;
    components: Array<{ key: string; props?: Record<string, unknown> }>;
    navigation_visibility: boolean;
    frontend_visibility: boolean;
    template: string;
    status: string;
  }>;
}

export interface ComponentSchemaData {
  components: Array<{
    key: string;
    name: string;
    category: string;
    fields: string[];
    allowed_page_types: string[];
    data_source: string;
    visibility: string;
  }>;
}

export interface ConnectorCommandRecord {
  id: string;
  workspaceId: string;
  auditId: string;
  type: 'content_mapping_sync' | 'module_activation';
  payload: Record<string, unknown>;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'rolled_back';
  createdAt: string;
  updatedAt: string;
  attempts: number;
  lastError?: string;
}

export interface WorkspaceOrchestration {
  id: string;
  name: string;
  clientOrganizationId?: string;
  clientOrganizationName?: string;
  clientSubscriptionId?: string;
  clientSubscriptionPlan?: AccountPlan;
  workspaceOwnership?: 'client' | 'internal_demo';
  businessType: string;
  country: string;
  businessModel: string;
  contentSource: 'wordpress' | 'nextjs';
  contentBaseUrl: string;
  planId?: string;
  websiteType?: 'NEW_WEBSITE' | 'EXISTING_WEBSITE' | 'CUSTOM_HEADLESS';
  onboardingStepKey?:
    | 'PLAN_SELECTED'
    | 'PROFILE_CREATED'
    | 'WEBSITE_TYPE_SELECTED'
    | 'BUSINESS_DETAILS_COMPLETED'
    | 'CONNECTOR_TOKEN_GENERATED'
    | 'TEMPLATE_SELECTED'
    | 'DEPLOYMENT_STARTED'
    | 'WORKSPACE_CREATED'
    | 'SUPPORT_ASSIGNED'
    | 'LAUNCH_CHECKLIST_READY';
  onboardingStatus?:
    | 'NOT_STARTED'
    | 'IN_PROGRESS'
    | 'WAITING_FOR_CLIENT'
    | 'WAITING_FOR_SUPPORT'
    | 'DEPLOYING'
    | 'READY_FOR_REVIEW'
    | 'READY_FOR_LAUNCH'
    | 'LIVE'
    | 'FAILED';
  businessProfile?: Record<string, unknown>;
  selectedTemplateId?: string;
  collectedBusinessData?: Record<string, unknown>;
  supportRequired?: boolean;
  onboardingPath?: string;
  architecture?: string;
  selectedModules: string[];
  brandSetup: Record<string, unknown>;
  onboardingSteps: OnboardingStepState[];
  currentStep: number;
  status: 'draft' | 'onboarding' | 'ready_for_launch' | 'launched' | 'blocked';
  deploymentReadiness: {
    onboardingComplete: boolean;
    architectureValidated: boolean;
    apisReachable: boolean;
    modulesValid: boolean;
    frontendValidated: boolean;
    contentMapped: boolean;
    integrationsConfigured: boolean;
  };
  missingRequirements: string[];
  recoverySuggestions: string[];
  rollout: {
    pageSchemaVersion: number;
    componentSchemaVersion: number;
    channel: 'stable' | 'beta';
    promotedAt?: string;
  };
  supportAssignment?: {
    status: 'UNASSIGNED' | 'ASSIGNED' | 'IN_PROGRESS' | 'WAITING_FOR_CLIENT' | 'COMPLETED';
    assignedAt?: string;
    assignedBy?: string;
    supportOfficerId?: string;
    supportOfficerName?: string;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    reason?: string;
    setupType?: 'NEW_WEBSITE' | 'EXISTING_WEBSITE' | 'CUSTOM_HEADLESS';
    requiredSkills?: string[];
    initialNotes?: string;
  };
  launchGuardLastCheckedAt?: string;
  connectorStatus?: ConnectorStatusKey;
  connectorToken?: string;
  connectorConnectedAt?: string;
  connectorLastVerificationAttempt?: string;
  connectorVerificationError?: string;
  connectorSiteMetadata?: ConnectorSiteMetadata;
  createdAt: string;
  updatedAt: string;
}

export type ConnectorStatusKey =
  | 'NOT_CONNECTED'
  | 'TOKEN_GENERATED'
  | 'PENDING_VERIFICATION'
  | 'CONNECTED'
  | 'FAILED'
  | 'SUPPORT_REQUIRED';

export interface ConnectorSiteMetadata {
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
  detectedCapabilities?: {
    statusEndpoint: boolean;
    siteProfile: boolean;
    woocommerceDetection: boolean;
    pagesDiscovery: boolean;
    productsDiscovery: boolean;
    navigationDiscovery: boolean;
    mediaDiscovery: boolean;
    contentInventory: boolean;
  };
  discoveredAt?: string;
}

export type AccountPlan = 'starter' | 'business' | 'enterprise';

export interface DeploymentLink {
  id: string;
  plan: AccountPlan;
  createdAt: string;
  expiresAt: string;
  used: boolean;
  usedAt?: string;
  workspaceId?: string;
  provisioning: {
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    currentStep: number;
    totalSteps: number;
    lastError?: string;
  };
}

export type CommercialSubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELLED' | 'EXPIRED';
export type CommercialPaymentProvider = 'PAYSTACK' | 'STRIPE';
export type CommercialPaymentVerificationStatus = 'NOT_REQUIRED' | 'PENDING' | 'VERIFIED' | 'FAILED' | 'SANDBOX_VERIFIED';
export type CommercialBillingInterval = 'MONTHLY' | 'ANNUAL';
export type CommercialTemplateStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
export type CommercialTemplateVisibility = 'INTERNAL' | 'PUBLIC';
export type CommercialTemplateWebsiteType = 'NEW_WEBSITE' | 'EXISTING_WEBSITE' | 'CUSTOM_HEADLESS';
export type CommercialTemplateStack = 'WORDPRESS_NEXTJS' | 'WORDPRESS_ONLY' | 'NEXTJS' | 'CUSTOM';
export type CommercialTemplatePlanAvailability = 'starter' | 'business' | 'growth' | 'enterprise' | 'all';
export type CommercialTemplateRepoSource = 'MARVEO_TEMPLATES' | 'MANUAL' | 'EXTERNAL';
export type CommercialTemplateArtifactStatus = 'MISSING' | 'FOUND' | 'NOT_VALIDATED';

export interface CommercialPlanIntervalPricing {
  amount: number;
  setupFee?: number;
}

export interface CommercialPlanRegionalPricing {
  country: string;
  currency: string;
  monthly: CommercialPlanIntervalPricing;
  annual: CommercialPlanIntervalPricing;
  annualDiscountPercent?: number;
}

export interface CommercialPlanConfig {
  id: string;
  name: string;
  description: string;
  workspaceLimit: number;
  featureEntitlements: string[];
  trialEnabled: boolean;
  trialDurationDays?: number;
  regions: CommercialPlanRegionalPricing[];
}

export interface CommercialIdentity {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  company?: string;
  wpUserId?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CommercialOrganization {
  id: string;
  name: string;
  ownerIdentityId: string;
  country: string;
  preferredBillingInterval?: CommercialBillingInterval;
  createdAt: string;
  updatedAt: string;
}

export interface CommercialSubscription {
  id: string;
  organizationId: string;
  identityId: string;
  planId: string;
  country: string;
  currency: string;
  amount: number;
  setupFee?: number;
  billingInterval: CommercialBillingInterval;
  intendedBillingInterval: CommercialBillingInterval;
  status: CommercialSubscriptionStatus;
  paymentReference?: string;
  paymentProvider?: CommercialPaymentProvider;
  paymentMode: 'TRIAL' | 'PAID';
  paymentVerificationStatus: CommercialPaymentVerificationStatus;
  paymentVerifiedAt?: string;
  trialEnabled: boolean;
  trialDurationDays?: number;
  trialStartDate?: string;
  trialEndDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CommercialOnboardingSession {
  id: string;
  identityId: string;
  organizationId: string;
  subscriptionId: string;
  selectedPlanId: string;
  selectedTemplateId?: string;
  billingInterval: CommercialBillingInterval;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  source: 'marketing_website' | 'internal';
}

export interface CommercialTemplateConfig {
  templateId: string;
  name: string;
  slug: string;
  businessType: string;
  sector?: string;
  category?: string;
  description: string;
  previewImage: string;
  status: CommercialTemplateStatus;
  visibility: CommercialTemplateVisibility;
  supportedWebsiteTypes: CommercialTemplateWebsiteType[];
  supportedStacks: CommercialTemplateStack[];
  planAvailability: CommercialTemplatePlanAvailability[];
  countryAvailability?: string[];
  featureModules: string[];
  requiresSupport: boolean;
  repoSource: CommercialTemplateRepoSource;
  repoPath?: string;
  version: string;
  artifactStatus: CommercialTemplateArtifactStatus;
  createdAt: string;
  updatedAt: string;
  preview?: {
    tagline?: string;
    palette?: {
      primary: string;
      secondary: string;
      accent: string;
      background: string;
      text: string;
    };
    typography?: {
      heading: string;
      body: string;
    };
    routes?: Array<{ path: string; label: string; description: string }>;
  };
}

export interface CommercialConfig {
  countryCurrencyMap: Record<string, string>;
  plans: CommercialPlanConfig[];
  templates: CommercialTemplateConfig[];
  trialDefaults: {
    trialEnabled: boolean;
    trialDurationDays: number;
  };
  identities: Record<string, CommercialIdentity>;
  organizations: Record<string, CommercialOrganization>;
  subscriptions: Record<string, CommercialSubscription>;
  onboardingSessions: Record<string, CommercialOnboardingSession>;
}

export interface CloudOrchestrationStore {
  workspaces: Record<string, WorkspaceOrchestration>;
  pageSchemas: Record<string, VersionedSchema<PageSchemaData>[]>;
  componentSchemas: Record<string, VersionedSchema<ComponentSchemaData>[]>;
  commands: ConnectorCommandRecord[];
  pagePublications: Record<
    string,
    {
      sourceType: 'wordpress' | 'nextjs';
      baseUrl: string;
      pageId: string;
      title: string;
      sections: Array<Record<string, unknown>>;
      updatedAt: string;
    }
  >;
  deploymentLinks: Record<string, DeploymentLink>;
  accountPlan: AccountPlan;
  accountPlanUpdatedAt: string;
  lookups: {
    businessTypes: string[];
    businessModels: string[];
    countries: Array<{ code: string; name: string }>;
  };
  commercial: CommercialConfig;
}

export const PLAN_WORKSPACE_LIMITS: Record<AccountPlan, number> = {
  starter: 1,
  business: 3,
  enterprise: 999, // Effectively unlimited
};

export const ADMIN_MODULE_KEYS = [
  'dashboard',
  'products',
  'orders',
  'reports',
  'customers',
  'blog',
  'stores',
  'siteSettings',
  'adminSettings',
] as const;

export type AdminModuleKey = (typeof ADMIN_MODULE_KEYS)[number];
export type RoleModuleVisibility = Record<string, Partial<Record<AdminModuleKey, boolean>>>;

export interface AdminConfigStore {
  users: Record<string, ManagedUserState>;
  nativeAuth: {
    identities: Record<string, NativePlatformIdentity>;
    sessions: Record<string, NativePlatformSession>;
    permissions: Record<string, string[]>;
  };
  platformSettings: PlatformSettings;
  tracking: TrackingConfig;
  smtp: SmtpConfig;
  forms: FormRoutingRule[];
  roleModuleVisibility: RoleModuleVisibility;
  maintenance: MaintenanceSettings;
  audit: AuditRecord[];
  cloud: CloudOrchestrationStore;
}

const FULL_ACCESS: Record<AdminModuleKey, boolean> = {
  dashboard: true,
  products: true,
  orders: true,
  reports: true,
  customers: true,
  blog: true,
  stores: true,
  siteSettings: true,
  adminSettings: true,
};

// ─── Optional WordPress compatibility persistence ────────────────────────────
// Native platform persistence is the operational source of truth.
// Set MARVEO_STORE_BACKEND=wordpress_compat only when compatibility is required.
import { getConfig } from '@/src/config/client';

const getWpApiUrl = () => {
  const config = getConfig();
  return config.wordpressApiUrl || getWordPressApiBase();
};

export const WP_API_URL = getWpApiUrl();
const WP_APP_USER = process.env.WP_APP_USER || '';
const WP_APP_PASSWORD = process.env.WP_APP_PASSWORD || '';
const STORE_BACKEND = process.env.MARVEO_STORE_BACKEND || 'native_file';

async function wpAuthHeader(): Promise<Record<string, string>> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_token')?.value;
    if (token) {
      return { Authorization: `Bearer ${token}` };
    }
  } catch {
    // No request cookie context available; fall back to app credentials.
  }

  if (!WP_APP_USER || !WP_APP_PASSWORD) return {};
  const encoded = Buffer.from(`${WP_APP_USER}:${WP_APP_PASSWORD}`).toString('base64');
  return { Authorization: `Basic ${encoded}` };
}

// ─── Local filesystem (development) ──────────────────────────────────────────
const STORE_PATH = path.join(process.cwd(), '.admin-data', 'ecommerce-admin-config.json');

const DEFAULT_STORE: AdminConfigStore = {
  users: {},
  nativeAuth: {
    identities: {},
    sessions: {},
    permissions: {},
  },
  platformSettings: {
    trialDurationDays: 14,
    pricingVisibility: 'PUBLIC',
    regionalPricingEnabled: true,
    paymentProvider: {
      provider: 'NONE',
      mode: 'sandbox',
      configured: false,
    },
    demoMode: {
      enabled: process.env.MARVEO_DEMO_MODE === 'true' || process.env.NEXT_PUBLIC_MARVEO_DEMO_MODE === 'true',
      allowOperationalMutations: false,
    },
    templatePublishRules: {
      requireArtifactValidation: true,
      requireSupportApproval: false,
    },
    supportDefaults: {
      defaultPriority: 'MEDIUM',
      defaultSetupType: 'NEW_WEBSITE',
      defaultAssigneeId: null,
    },
  },
  tracking: {
    ecommerceDomain: '',
    googleAnalyticsId: '',
    googleTagManagerId: '',
    googleSearchConsoleVerification: '',
    metaPixelId: '',
    tiktokPixelId: '',
    whatsappChatEnabled: false,
    whatsappChatNumber: '',
    whatsappChatText: 'Chat with us on WhatsApp',
    customHeadScripts: '',
    customBodyScripts: '',
    customFooterScripts: '',
  },
  smtp: {
    provider: 'microsoft365',
    useWordPressMailer: false,
    host: 'smtp.office365.com',
    port: 587,
    secure: false,
    username: '',
    password: '',
    fromEmail: '',
    fromName: 'Marvéo Store',
  },
  forms: [
    {
      formKey: 'contact',
      formName: 'Contact Form',
      fromEmail: '',
      senderName: '',
      recipients: [],
    },
    {
      formKey: 'distributor',
      formName: 'Distributor Application',
      fromEmail: '',
      senderName: '',
      recipients: [],
    },
    {
      formKey: 'checkout',
      formName: 'Checkout Notifications',
      fromEmail: '',
      senderName: '',
      recipients: [],
    },
  ],
  roleModuleVisibility: {
    administrator: { ...FULL_ACCESS },
    shop_manager: {
      dashboard: true,
      products: true,
      orders: true,
      reports: true,
      customers: true,
      blog: true,
      stores: true,
      siteSettings: true,
      adminSettings: false,
    },
    editor: {
      dashboard: true,
      products: false,
      orders: false,
      reports: false,
      customers: false,
      blog: true,
      stores: false,
      siteSettings: false,
      adminSettings: false,
    },
  },
  maintenance: {
    site_under_construction: false,
    under_construction_title: 'We are coming back soon',
    under_construction_message: 'We are currently making improvements to serve you better. Please check back shortly.',
  },
  audit: [],
  cloud: {
    workspaces: {},
    pageSchemas: {},
    componentSchemas: {},
    commands: [],
    pagePublications: {},
    deploymentLinks: {},
    accountPlan: 'starter',
    accountPlanUpdatedAt: new Date().toISOString(),
    lookups: {
      businessTypes: ['Retail', 'Wholesale', 'Services', 'Manufacturing', 'Technology', 'Hospitality', 'Healthcare', 'Education', 'Real Estate'],
      businessModels: ['B2C', 'B2B'],
      countries: [
        { code: 'NG', name: 'Nigeria' },
        { code: 'US', name: 'United States' },
        { code: 'GB', name: 'United Kingdom' },
        { code: 'CA', name: 'Canada' },
        { code: 'AE', name: 'United Arab Emirates' },
        { code: 'AU', name: 'Australia' },
      ],
    },
    commercial: {
      countryCurrencyMap: {
        NG: 'NGN',
        US: 'USD',
        GB: 'GBP',
        CA: 'CAD',
        AE: 'AED',
        AU: 'AUD',
      },
      plans: [
        {
          id: 'starter',
          name: 'Starter Workspace',
          description: 'For founders and growing businesses.',
          workspaceLimit: 1,
          featureEntitlements: ['workspace.basic', 'onboarding.guided', 'support.standard'],
          trialEnabled: true,
          trialDurationDays: 14,
          regions: [
            { country: 'NG', currency: 'NGN', monthly: { amount: 25000, setupFee: 0 }, annual: { amount: 250000, setupFee: 0 }, annualDiscountPercent: 17 },
            { country: 'US', currency: 'USD', monthly: { amount: 49, setupFee: 0 }, annual: { amount: 490, setupFee: 0 }, annualDiscountPercent: 17 },
            { country: 'GB', currency: 'GBP', monthly: { amount: 39, setupFee: 0 }, annual: { amount: 390, setupFee: 0 }, annualDiscountPercent: 17 },
          ],
        },
        {
          id: 'growth',
          name: 'Growth Operations',
          description: 'For teams operating across multiple workflows.',
          workspaceLimit: 5,
          featureEntitlements: ['workspace.multi', 'analytics.advanced', 'support.priority'],
          trialEnabled: true,
          trialDurationDays: 14,
          regions: [
            { country: 'NG', currency: 'NGN', monthly: { amount: 85000, setupFee: 0 }, annual: { amount: 850000, setupFee: 0 }, annualDiscountPercent: 17 },
            { country: 'US', currency: 'USD', monthly: { amount: 149, setupFee: 0 }, annual: { amount: 1490, setupFee: 0 }, annualDiscountPercent: 17 },
            { country: 'GB', currency: 'GBP', monthly: { amount: 119, setupFee: 0 }, annual: { amount: 1190, setupFee: 0 }, annualDiscountPercent: 17 },
          ],
        },
        {
          id: 'enterprise',
          name: 'Enterprise Infrastructure',
          description: 'For enterprise and agency operations at scale.',
          workspaceLimit: 999,
          featureEntitlements: ['workspace.unlimited', 'governance.advanced', 'support.dedicated'],
          trialEnabled: false,
          trialDurationDays: 0,
          regions: [
            { country: 'NG', currency: 'NGN', monthly: { amount: 0, setupFee: 0 }, annual: { amount: 0, setupFee: 0 } },
            { country: 'US', currency: 'USD', monthly: { amount: 0, setupFee: 0 }, annual: { amount: 0, setupFee: 0 } },
            { country: 'GB', currency: 'GBP', monthly: { amount: 0, setupFee: 0 }, annual: { amount: 0, setupFee: 0 } },
          ],
        },
      ],
      templates: [
        {
          templateId: 'template-business-pro',
          name: 'Business Pro',
          slug: 'business-pro',
          businessType: 'Corporate',
          sector: 'landing-pages',
          category: 'business',
          description: 'Professional services and company profile template for fast new-site launch.',
          previewImage: '/images/templates/business-pro.jpg',
          status: 'ACTIVE',
          visibility: 'PUBLIC',
          supportedWebsiteTypes: ['NEW_WEBSITE'],
          supportedStacks: ['WORDPRESS_NEXTJS', 'NEXTJS'],
          planAvailability: ['starter', 'growth', 'all'],
          featureModules: ['lead.capture', 'pages.core', 'blog.basic'],
          requiresSupport: false,
          repoSource: 'MARVEO_TEMPLATES',
          repoPath: 'landing-pages/business-pro/template.json',
          version: '1.0.0',
          artifactStatus: 'FOUND',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          preview: {
            tagline: 'A professional, conversion-focused website for service brands.',
            palette: {
              primary: '#1A1A2E',
              secondary: '#F4F4F8',
              accent: '#4F6EF7',
              background: '#FFFFFF',
              text: '#111111',
            },
            typography: { heading: 'Inter', body: 'Inter' },
            routes: [
              { path: '/', label: 'Home', description: 'Hero, services overview and call to action' },
              { path: '/about', label: 'About', description: 'Company story and team profiles' },
              { path: '/services', label: 'Services', description: 'Service offerings with detail pages' },
              { path: '/contact', label: 'Contact', description: 'Contact form and location details' },
            ],
          },
        },
        {
          templateId: 'template-makeup-artist',
          name: 'Makeup Artist Template',
          slug: 'makeup-artist',
          businessType: 'Beauty',
          sector: 'beauty',
          category: 'service-commerce',
          description: 'Beauty service and commerce template for stylists, salons, and makeup artists.',
          previewImage: '/images/templates/makeup-artist.jpg',
          status: 'ACTIVE',
          visibility: 'PUBLIC',
          supportedWebsiteTypes: ['NEW_WEBSITE'],
          supportedStacks: ['WORDPRESS_NEXTJS', 'WORDPRESS_ONLY'],
          planAvailability: ['growth', 'enterprise', 'all'],
          countryAvailability: ['NG', 'US', 'GB'],
          featureModules: ['catalog.core', 'payments.checkout', 'campaign.landing'],
          requiresSupport: false,
          repoSource: 'MARVEO_TEMPLATES',
          repoPath: 'beauty/makeup-artist/template.json',
          version: '1.0.0',
          artifactStatus: 'FOUND',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          preview: {
            tagline: 'Luxury makeup artistry for brides, editorials, and special occasions.',
            palette: {
              primary: '#C2847A',
              secondary: '#F7EDE9',
              accent: '#8C5E57',
              background: '#FDFAF9',
              text: '#2A1A14',
            },
            typography: { heading: 'Cormorant Garamond', body: 'Nunito Sans' },
            routes: [
              { path: '/', label: 'Home', description: 'Hero, services preview, testimonials, booking CTA' },
              { path: '/services', label: 'Services', description: 'Full service menu with pricing tiers' },
              { path: '/gallery', label: 'Gallery', description: 'Portfolio showcase and work samples' },
              { path: '/contact', label: 'Contact & Book', description: 'Booking enquiry form and contact information' },
            ],
          },
        },
        {
          templateId: 'template-salon',
          name: 'Salon Operations',
          slug: 'salon',
          businessType: 'Beauty',
          sector: 'beauty',
          category: 'service-commerce',
          description: 'A modern salon experience built around craft, community, and care.',
          previewImage: '/images/templates/salon.jpg',
          status: 'ACTIVE',
          visibility: 'PUBLIC',
          supportedWebsiteTypes: ['NEW_WEBSITE'],
          supportedStacks: ['WORDPRESS_NEXTJS', 'WORDPRESS_ONLY'],
          planAvailability: ['growth', 'enterprise', 'all'],
          featureModules: ['catalog.core', 'booking.basic', 'campaign.landing'],
          requiresSupport: false,
          repoSource: 'MARVEO_TEMPLATES',
          repoPath: 'beauty/salon/template.json',
          version: '1.0.0',
          artifactStatus: 'FOUND',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          preview: {
            tagline: 'A modern salon experience built around craft, community, and care.',
            palette: {
              primary: '#2B4E42',
              secondary: '#EEF5F0',
              accent: '#C8A96E',
              background: '#F9FBF9',
              text: '#192720',
            },
            typography: { heading: 'Playfair Display', body: 'Inter' },
            routes: [
              { path: '/', label: 'Home', description: 'Hero, services preview, team intro, booking CTA' },
              { path: '/services', label: 'Services & Pricing', description: 'Full service list with pricing' },
              { path: '/team', label: 'Our Team', description: 'Stylist profiles and specialties' },
              { path: '/contact', label: 'Book Now', description: 'Booking enquiry form and salon details' },
            ],
          },
        },
        {
          templateId: 'template-migration-redesign',
          name: 'Migration Redesign Kit',
          slug: 'migration-redesign-kit',
          businessType: 'Migration',
          sector: 'migration',
          category: 'redesign',
          description: 'Guided redesign starter used for existing website migration and structure cleanup.',
          previewImage: '/images/templates/migration-redesign.jpg',
          status: 'ACTIVE',
          visibility: 'INTERNAL',
          supportedWebsiteTypes: ['EXISTING_WEBSITE'],
          supportedStacks: ['WORDPRESS_ONLY', 'CUSTOM'],
          planAvailability: ['growth', 'enterprise'],
          featureModules: ['migration.audit', 'ia.restructure'],
          requiresSupport: true,
          repoSource: 'MANUAL',
          repoPath: '',
          version: '1.0.0',
          artifactStatus: 'NOT_VALIDATED',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          templateId: 'template-headless-slate',
          name: 'Headless Slate',
          slug: 'headless-slate',
          businessType: 'Technology',
          sector: 'headless',
          category: 'starter',
          description: 'Headless-first template skeleton for custom frontend deployments.',
          previewImage: '/images/templates/headless-slate.jpg',
          status: 'DRAFT',
          visibility: 'INTERNAL',
          supportedWebsiteTypes: ['CUSTOM_HEADLESS'],
          supportedStacks: ['NEXTJS', 'CUSTOM'],
          planAvailability: ['growth', 'enterprise'],
          featureModules: ['headless.adapter', 'content.api'],
          requiresSupport: true,
          repoSource: 'MANUAL',
          repoPath: '',
          version: '0.1.0',
          artifactStatus: 'MISSING',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      trialDefaults: {
        trialEnabled: true,
        trialDurationDays: 14,
      },
      identities: {},
      organizations: {},
      subscriptions: {},
      onboardingSessions: {},
    },
  },
};

function mergeWithDefaults(parsed: Partial<AdminConfigStore>): AdminConfigStore {
  const rawCloud = (parsed.cloud as unknown as Record<string, unknown> | undefined) ?? undefined;
  const legacyPageDrafts = rawCloud?.pageDrafts as Record<string, unknown> | undefined;
  const pagePublicationsRaw = parsed.cloud?.pagePublications as Record<string, unknown> | undefined;

  const sanitizePublications = (input: Record<string, unknown> | undefined) => {
    if (!input) return {} as CloudOrchestrationStore['pagePublications'];

    const output: CloudOrchestrationStore['pagePublications'] = {};
    for (const [key, value] of Object.entries(input)) {
      if (!value || typeof value !== 'object') continue;
      const row = value as Record<string, unknown>;
      const sourceType = String(row.sourceType || '').toLowerCase() === 'nextjs' ? 'nextjs' : 'wordpress';
      const baseUrl = String(row.baseUrl || '').trim();
      const pageId = String(row.pageId || '').trim();
      const title = String(row.title || '').trim();
      const sections = Array.isArray(row.sections)
        ? row.sections.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
        : [];

      if (!baseUrl || !pageId) continue;

      output[key] = {
        sourceType,
        baseUrl,
        pageId,
        title: title || pageId,
        sections,
        updatedAt: String(row.updatedAt || ''),
      };
    }

    return output;
  };

  const mergedPublications = Object.keys(pagePublicationsRaw || {}).length > 0
    ? sanitizePublications(pagePublicationsRaw)
    : sanitizePublications(legacyPageDrafts);

  const normalizeCommercialRegions = (plans: CommercialConfig['plans'] | undefined) => {
    if (!Array.isArray(plans)) return DEFAULT_STORE.cloud.commercial.plans;

    return plans.map((plan) => ({
      ...plan,
      regions: Array.isArray(plan.regions)
        ? plan.regions.map((region) => {
            const legacyAmount = Number((region as { amount?: number }).amount ?? 0);
            const monthly = region.monthly ?? { amount: legacyAmount, setupFee: (region as { setupFee?: number }).setupFee ?? 0 };
            const annual = region.annual ?? { amount: legacyAmount > 0 ? legacyAmount * 10 : 0, setupFee: (region as { setupFee?: number }).setupFee ?? 0 };

            return {
              country: String(region.country ?? '').trim().toUpperCase(),
              currency: String(region.currency ?? '').trim().toUpperCase(),
              monthly: {
                amount: Number(monthly.amount ?? 0),
                setupFee: Number(monthly.setupFee ?? 0),
              },
              annual: {
                amount: Number(annual.amount ?? 0),
                setupFee: Number(annual.setupFee ?? 0),
              },
              annualDiscountPercent: typeof region.annualDiscountPercent === 'number' ? region.annualDiscountPercent : undefined,
            };
          })
        : [],
    }));
  };

  const normalizeCommercialSubscriptions = (subscriptions: CommercialConfig['subscriptions'] | undefined) => {
    if (!subscriptions) return {};

    return Object.fromEntries(
      Object.entries(subscriptions).map(([key, subscription]) => [
        key,
        {
          ...subscription,
          billingInterval: subscription.billingInterval ?? 'MONTHLY',
          intendedBillingInterval: subscription.intendedBillingInterval ?? subscription.billingInterval ?? 'MONTHLY',
        },
      ]),
    );
  };

  const normalizeCommercialTemplates = (templates: CommercialConfig['templates'] | undefined) => {
    if (!Array.isArray(templates) || templates.length === 0) return DEFAULT_STORE.cloud.commercial.templates;

    const validStatuses = new Set(['DRAFT', 'ACTIVE', 'ARCHIVED']);
    const validVisibility = new Set(['INTERNAL', 'PUBLIC']);
    const validWebsiteTypes = new Set(['NEW_WEBSITE', 'EXISTING_WEBSITE', 'CUSTOM_HEADLESS']);
    const validStacks = new Set(['WORDPRESS_NEXTJS', 'WORDPRESS_ONLY', 'NEXTJS', 'CUSTOM']);
    const validPlans = new Set(['starter', 'business', 'growth', 'enterprise', 'all']);
    const validRepoSources = new Set(['MARVEO_TEMPLATES', 'MANUAL', 'EXTERNAL']);
    const validArtifactStatuses = new Set(['MISSING', 'FOUND', 'NOT_VALIDATED']);

    return templates
      .filter((template) => template && template.templateId && template.name)
      .map((template) => {
        const status = String(template.status || 'DRAFT').trim().toUpperCase();
        const visibility = String(template.visibility || 'INTERNAL').trim().toUpperCase();
        const supportedWebsiteTypes = Array.isArray(template.supportedWebsiteTypes)
          ? template.supportedWebsiteTypes
              .map((item) => String(item).trim().toUpperCase())
              .filter((item) => validWebsiteTypes.has(item))
          : [];
        const supportedStacks = Array.isArray(template.supportedStacks)
          ? template.supportedStacks
              .map((item) => String(item).trim().toUpperCase())
              .filter((item) => validStacks.has(item))
          : [];
        const planAvailability = Array.isArray(template.planAvailability)
          ? template.planAvailability
              .map((item) => String(item).trim().toLowerCase())
              .filter((item) => validPlans.has(item))
          : [];
        const repoSource = String(template.repoSource || '').trim().toUpperCase();
        const repoPath = String(template.repoPath || '').trim();
        const version = String(template.version || '').trim() || '1.0.0';
        const artifactStatus = String(template.artifactStatus || '').trim().toUpperCase();
        const resolvedRepoSource = validRepoSources.has(repoSource) ? repoSource : (repoPath ? 'MARVEO_TEMPLATES' : 'MANUAL');
        const resolvedArtifactStatus = validArtifactStatuses.has(artifactStatus)
          ? artifactStatus
          : (repoPath ? 'NOT_VALIDATED' : 'MISSING');

        return {
          templateId: String(template.templateId).trim(),
          name: String(template.name).trim(),
          slug: String(template.slug || template.templateId).trim().toLowerCase(),
          businessType: String(template.businessType || 'General').trim(),
          sector: String(template.sector || '').trim() || undefined,
          category: String(template.category || '').trim() || undefined,
          description: String(template.description || '').trim(),
          previewImage: String(template.previewImage || '').trim(),
          status: (validStatuses.has(status) ? status : 'DRAFT') as CommercialTemplateStatus,
          visibility: (validVisibility.has(visibility) ? visibility : 'INTERNAL') as CommercialTemplateVisibility,
          supportedWebsiteTypes: (supportedWebsiteTypes.length > 0 ? supportedWebsiteTypes : ['NEW_WEBSITE']) as CommercialTemplateWebsiteType[],
          supportedStacks: (supportedStacks.length > 0 ? supportedStacks : ['WORDPRESS_NEXTJS']) as CommercialTemplateStack[],
          planAvailability: (planAvailability.length > 0 ? planAvailability : ['all']) as CommercialTemplatePlanAvailability[],
          countryAvailability: Array.isArray(template.countryAvailability)
            ? template.countryAvailability.map((item) => String(item).trim().toUpperCase()).filter(Boolean)
            : undefined,
          featureModules: Array.isArray(template.featureModules)
            ? template.featureModules.map((item) => String(item).trim()).filter(Boolean)
            : [],
          requiresSupport: Boolean(template.requiresSupport),
          repoSource: resolvedRepoSource as CommercialTemplateRepoSource,
          repoPath: repoPath || undefined,
          version,
          artifactStatus: resolvedArtifactStatus as CommercialTemplateArtifactStatus,
          createdAt: String(template.createdAt || new Date().toISOString()),
          updatedAt: String(template.updatedAt || new Date().toISOString()),
          preview: template.preview ?? undefined,
        };
      });
  };

  const normalizeCommercialSessions = (sessions: CommercialConfig['onboardingSessions'] | undefined) => {
    if (!sessions) return {};

    return Object.fromEntries(
      Object.entries(sessions).map(([key, session]) => [
        key,
        {
          ...session,
          billingInterval: session.billingInterval ?? 'MONTHLY',
        },
      ]),
    );
  };

  return {
    ...DEFAULT_STORE,
    ...parsed,
    users: parsed.users ?? {},
    nativeAuth: {
      identities: parsed.nativeAuth?.identities ?? {},
      sessions: parsed.nativeAuth?.sessions ?? {},
      permissions: parsed.nativeAuth?.permissions ?? {},
    },
    platformSettings: {
      ...DEFAULT_STORE.platformSettings,
      ...(parsed.platformSettings ?? {}),
      paymentProvider: {
        ...DEFAULT_STORE.platformSettings.paymentProvider,
        ...(parsed.platformSettings?.paymentProvider ?? {}),
      },
      demoMode: {
        ...DEFAULT_STORE.platformSettings.demoMode,
        ...(parsed.platformSettings?.demoMode ?? {}),
      },
      templatePublishRules: {
        ...DEFAULT_STORE.platformSettings.templatePublishRules,
        ...(parsed.platformSettings?.templatePublishRules ?? {}),
      },
      supportDefaults: {
        ...DEFAULT_STORE.platformSettings.supportDefaults,
        ...(parsed.platformSettings?.supportDefaults ?? {}),
      },
    },
    tracking: { ...DEFAULT_STORE.tracking, ...(parsed.tracking ?? {}) },
    smtp: { ...DEFAULT_STORE.smtp, ...(parsed.smtp ?? {}) },
    forms: Array.isArray(parsed.forms) ? parsed.forms : DEFAULT_STORE.forms,
    roleModuleVisibility: {
      ...DEFAULT_STORE.roleModuleVisibility,
      ...(parsed.roleModuleVisibility ?? {}),
    },
    maintenance: { ...DEFAULT_STORE.maintenance, ...(parsed.maintenance ?? {}) },
    audit: Array.isArray(parsed.audit) ? parsed.audit : [],
    cloud: {
      ...DEFAULT_STORE.cloud,
      ...(parsed.cloud ?? {}),
      workspaces: parsed.cloud?.workspaces ?? {},
      pageSchemas: parsed.cloud?.pageSchemas ?? {},
      componentSchemas: parsed.cloud?.componentSchemas ?? {},
      commands: Array.isArray(parsed.cloud?.commands) ? parsed.cloud?.commands : [],
      pagePublications: mergedPublications,
      deploymentLinks: parsed.cloud?.deploymentLinks ?? {},
      accountPlan: (['starter', 'business', 'enterprise'].includes(parsed.cloud?.accountPlan ?? '')
        ? (parsed.cloud?.accountPlan as AccountPlan)
        : 'starter'),
      accountPlanUpdatedAt: parsed.cloud?.accountPlanUpdatedAt ?? DEFAULT_STORE.cloud.accountPlanUpdatedAt,
      lookups: {
        businessTypes: Array.isArray(parsed.cloud?.lookups?.businessTypes)
          ? parsed.cloud.lookups.businessTypes.map((item) => String(item)).filter(Boolean)
          : DEFAULT_STORE.cloud.lookups.businessTypes,
        businessModels: Array.isArray(parsed.cloud?.lookups?.businessModels)
          ? parsed.cloud.lookups.businessModels.map((item) => String(item)).filter(Boolean)
          : DEFAULT_STORE.cloud.lookups.businessModels,
        countries: Array.isArray(parsed.cloud?.lookups?.countries)
          ? parsed.cloud.lookups.countries
              .map((item) => ({
                code: String(item?.code ?? '').trim().toUpperCase(),
                name: String(item?.name ?? '').trim(),
              }))
              .filter((item) => item.code && item.name)
          : DEFAULT_STORE.cloud.lookups.countries,
      },
      commercial: {
        countryCurrencyMap: {
          ...DEFAULT_STORE.cloud.commercial.countryCurrencyMap,
          ...((parsed.cloud as Partial<CloudOrchestrationStore> | undefined)?.commercial?.countryCurrencyMap ?? {}),
        },
        plans: normalizeCommercialRegions((parsed.cloud as Partial<CloudOrchestrationStore> | undefined)?.commercial?.plans),
        templates: normalizeCommercialTemplates((parsed.cloud as Partial<CloudOrchestrationStore> | undefined)?.commercial?.templates),
        trialDefaults: {
          ...DEFAULT_STORE.cloud.commercial.trialDefaults,
          ...((parsed.cloud as Partial<CloudOrchestrationStore> | undefined)?.commercial?.trialDefaults ?? {}),
        },
        identities: (parsed.cloud as Partial<CloudOrchestrationStore> | undefined)?.commercial?.identities ?? {},
        organizations: (parsed.cloud as Partial<CloudOrchestrationStore> | undefined)?.commercial?.organizations ?? {},
        subscriptions: normalizeCommercialSubscriptions((parsed.cloud as Partial<CloudOrchestrationStore> | undefined)?.commercial?.subscriptions),
        onboardingSessions: normalizeCommercialSessions((parsed.cloud as Partial<CloudOrchestrationStore> | undefined)?.commercial?.onboardingSessions),
      },
    },
  };
}

// ─── WordPress-backed read/write ──────────────────────────────────────────────

async function readFromWordPress(): Promise<AdminConfigStore> {
  const endpoint = process.env.MARVEO_ADMIN_CONFIG_ENDPOINT || '/wp-json/marveo-core/v1/admin-config';
  const res = await fetch(`${WP_API_URL}${endpoint}`, {
    headers: { 'Content-Type': 'application/json', ...(await wpAuthHeader()) },
    cache: 'no-store',
  });
  if (res.status === 204 || res.status === 404) return DEFAULT_STORE;
  if (!res.ok) throw new Error(`WP admin-config GET failed: ${res.status}`);
  const parsed = (await res.json()) as Partial<AdminConfigStore>;
  return mergeWithDefaults(parsed);
}

async function writeToWordPress(data: AdminConfigStore): Promise<void> {
  const endpoint = process.env.MARVEO_ADMIN_CONFIG_ENDPOINT || '/wp-json/marveo-core/v1/admin-config';
  const res = await fetch(`${WP_API_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await wpAuthHeader()) },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`WP admin-config POST failed: ${res.status}`);
}

// ─── Local filesystem read/write (dev) ───────────────────────────────────────

async function ensureStoreFile() {
  try {
    const dir = path.dirname(STORE_PATH);
    await fs.mkdir(dir, { recursive: true });
    await fs.access(STORE_PATH);
  } catch {
    try {
      await fs.writeFile(STORE_PATH, JSON.stringify(DEFAULT_STORE, null, 2), 'utf8');
    } catch {
      // Read-only env — skip initialization.
    }
  }
}

async function readFromFile(): Promise<AdminConfigStore> {
  await ensureStoreFile();
  const raw = await fs.readFile(STORE_PATH, 'utf8');
  const parsed = JSON.parse(raw) as Partial<AdminConfigStore>;
  return mergeWithDefaults(parsed);
}

async function writeToFile(data: AdminConfigStore): Promise<void> {
  await ensureStoreFile();
  await fs.writeFile(STORE_PATH, JSON.stringify(data, null, 2), 'utf8');
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function readAdminStore(): Promise<AdminConfigStore> {
  try {
    if (STORE_BACKEND === 'wordpress_compat') {
      return await readFromWordPress();
    }
    return await readFromFile();
  } catch {
    return DEFAULT_STORE;
  }
}

export async function writeAdminStore(next: AdminConfigStore): Promise<void> {
  if (STORE_BACKEND === 'wordpress_compat') {
    await writeToWordPress(next);
  } else {
    await writeToFile(next);
  }
}

export async function updateAdminStore(
  updater: (current: AdminConfigStore) => AdminConfigStore,
): Promise<AdminConfigStore> {
  const current = await readAdminStore();
  const updated = updater(current);
  await writeAdminStore(updated);
  return updated;
}

export async function appendAuditLog(record: Omit<AuditRecord, 'id' | 'at'>) {
  await updateAdminStore((current) => {
    const entryId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    const entry: AuditRecord = {
      id: entryId,
      at: new Date().toISOString(),
      ...record,
    };
    return {
      ...current,
      audit: [entry, ...current.audit].slice(0, 500),
    };
  });
}

export async function getWorkspaceSupportAssignment(workspaceId: string) {
  const store = await readAdminStore();
  const workspace = store.cloud.workspaces[workspaceId];
  if (!workspace) return null;
  return workspace.supportAssignment ?? { status: 'UNASSIGNED' as const };
}

export async function setWorkspaceSupportAssignment(
  workspaceId: string,
  assignment: NonNullable<WorkspaceOrchestration['supportAssignment']>,
) {
  let updatedWorkspace: WorkspaceOrchestration | null = null;

  await updateAdminStore((current) => {
    const workspace = current.cloud.workspaces[workspaceId];
    if (!workspace) return current;

    updatedWorkspace = {
      ...workspace,
      supportAssignment: assignment,
      updatedAt: new Date().toISOString(),
    };

    return {
      ...current,
      cloud: {
        ...current.cloud,
        workspaces: {
          ...current.cloud.workspaces,
          [workspaceId]: updatedWorkspace,
        },
      },
    };
  });

  return updatedWorkspace;
}

export async function getWorkspaceConnectorState(workspaceId: string) {
  const store = await readAdminStore();
  const workspace = store.cloud.workspaces[workspaceId];
  if (!workspace) return null;
  return {
    connectorStatus: workspace.connectorStatus ?? ('NOT_CONNECTED' as ConnectorStatusKey),
    connectorToken: workspace.connectorToken ?? null,
    connectorConnectedAt: workspace.connectorConnectedAt ?? null,
    connectorLastVerificationAttempt: workspace.connectorLastVerificationAttempt ?? null,
    connectorVerificationError: workspace.connectorVerificationError ?? null,
    connectorSiteMetadata: workspace.connectorSiteMetadata ?? null,
  };
}

export async function setWorkspaceConnectorState(
  workspaceId: string,
  patch: Partial<Pick<WorkspaceOrchestration,
    | 'connectorStatus'
    | 'supportRequired'
    | 'connectorToken'
    | 'connectorConnectedAt'
    | 'connectorLastVerificationAttempt'
    | 'connectorVerificationError'
    | 'connectorSiteMetadata'
  >>,
) {
  let updated: WorkspaceOrchestration | null = null;

  await updateAdminStore((current) => {
    const workspace = current.cloud.workspaces[workspaceId];
    if (!workspace) return current;

    updated = {
      ...workspace,
      ...patch,
      updatedAt: new Date().toISOString(),
    };

    return {
      ...current,
      cloud: {
        ...current.cloud,
        workspaces: {
          ...current.cloud.workspaces,
          [workspaceId]: updated,
        },
      },
    };
  });

  return updated;
}

