import { promises as fs } from 'node:fs';
import path from 'node:path';
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
  avatarUrl?: string;
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

export interface NativePasswordChangeOtp {
  code: string;
  requestedAt: string;
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
    publishableKeyRef: string;
    secretKeyRef: string;
    webhookSecretRef: string;
    webhookUrl: string;
    webhookConfigured: boolean;
    merchantDisplayName: string;
    settlementCurrency: string;
    autoCapture: boolean;
    require3DS: boolean;
  };
  paymentProviders: Record<'PAYSTACK' | 'FLUTTERWAVE' | 'CUSTOM' | 'STRIPE' | 'PAYPAL', {
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
  billingCurrencyPolicy: {
    basePricingCurrency: 'USD' | 'GBP' | 'NGN';
    autoConvertFromBase: boolean;
    countryCurrencyMap: Record<string, 'USD' | 'GBP' | 'NGN'>;
    fxRates: {
      USD: number;
      GBP: number;
      NGN: number;
    };
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
  branding: {
    brandName: string;
    brandByline: string;
    logoUrl: string;
    dashboardLogoUrl: string;
    portalLoginLogoUrl: string;
    faviconUrl: string;
    footerLogoUrl: string;
    primaryColor: string;
    secondaryColor: string;
    websiteUrl: string;
    footerAddressLine: string;
    footerDescription: string;
    footerBadgeText: string;
    footerStatusLabel: string;
    footerStatusUrl: string;
    footerDocsLabel: string;
    footerDocsUrl: string;
    footerGdprLabel: string;
    footerGdprUrl: string;
    footerUnsubscribeLabel: string;
    footerUnsubscribeUrl: string;
  };
  email: {
    enabled: boolean;
    provider: 'SMTP' | 'RESEND' | 'SES_SMTP' | 'WORDPRESS_MAILER';
    host: string;
    port: number;
    secure: boolean;
    username: string;
    password: string;
    fromEmail: string;
    fromName: string;
    replyToEmail: string;
    appBaseUrl: string;
    apiBaseUrl: string;
    supportPortalUrl: string;
    supportEmail: string;
    billingEmail: string;
    deploymentEmail: string;
    userOpsEmail: string;
    sendFailureAlerts: boolean;
    failureAlertRecipients: string[];
  };
  emailTemplates: Record<
    | 'CLIENT_SIGNUP'
    | 'CLIENT_DEPLOYED'
    | 'DEPLOYMENT_FAILED'
    | 'PASSWORD_RESET_REQUESTED'
    | 'PASSWORD_CHANGED'
    | 'PAYMENT_RECEIVED'
    | 'PAYMENT_FAILED'
    | 'BILLING_NOTICE'
    | 'BILLING_SUSPENDED'
    | 'BILLING_REACTIVATED'
    | 'USER_INVITE'
    | 'USER_STATUS_CHANGED'
    | 'SUPPORT_ASSIGNED'
    | 'CONNECTOR_FAILED'
    | 'SYSTEM_FAILURE_ALERT',
    {
      enabled: boolean;
      subject: string;
      preheader: string;
      html: string;
      text: string;
    }
  >;
  reporting: {
    scheduleEnabled: boolean;
    frequency: 'WEEKLY' | 'MONTHLY';
    dayOfWeek: number;
    dayOfMonth: number;
    hourUTC: number;
    recipients: string[];
    includeIncidents: boolean;
    includeComplaints: boolean;
    includeAnalytics: boolean;
    updatedAt: string;
    lastRunAt?: string;
    lastRunStatus?: 'success' | 'failed';
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
  state?: string;
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
export type CommercialPaymentProvider = 'PAYSTACK' | 'FLUTTERWAVE' | 'CUSTOM' | 'STRIPE' | 'PAYPAL';
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
  active: boolean;
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

export const CONTROL_CENTER_MODULE_KEYS = [
  'overview',
  'clients',
  'workspaces',
  'deploymentQueue',
  'supportQueue',
  'launchReadiness',
  'connectors',
  'templates',
  'team',
  'plansBilling',
  'reports',
  'analytics',
  'auditLogs',
  'systemSettings',
] as const;

export const PLATFORM_EMAIL_TEMPLATE_KEYS = [
  'CLIENT_SIGNUP',
  'CLIENT_DEPLOYED',
  'DEPLOYMENT_FAILED',
  'PASSWORD_RESET_REQUESTED',
  'PASSWORD_CHANGED',
  'PAYMENT_RECEIVED',
  'PAYMENT_FAILED',
  'BILLING_NOTICE',
  'BILLING_SUSPENDED',
  'BILLING_REACTIVATED',
  'USER_INVITE',
  'USER_STATUS_CHANGED',
  'SUPPORT_ASSIGNED',
  'CONNECTOR_FAILED',
  'SYSTEM_FAILURE_ALERT',
] as const;

export type AdminModuleKey = (typeof ADMIN_MODULE_KEYS)[number];
export type ControlCenterModuleKey = (typeof CONTROL_CENTER_MODULE_KEYS)[number];
export type PlatformEmailTemplateKey = (typeof PLATFORM_EMAIL_TEMPLATE_KEYS)[number];
export type RoleModuleVisibility = Record<string, Partial<Record<AdminModuleKey, boolean>>>;
export type ControlCenterRoleModuleVisibility = Record<string, Partial<Record<ControlCenterModuleKey, boolean>>>;

export interface AdminConfigStore {
  users: Record<string, ManagedUserState>;
  nativeAuth: {
    identities: Record<string, NativePlatformIdentity>;
    sessions: Record<string, NativePlatformSession>;
    permissions: Record<string, string[]>;
    passwordChangeOtps: Record<string, NativePasswordChangeOtp>;
  };
  platformSettings: PlatformSettings;
  tracking: TrackingConfig;
  smtp: SmtpConfig;
  forms: FormRoutingRule[];
  roleModuleVisibility: RoleModuleVisibility;
  controlCenterRoleVisibility: ControlCenterRoleModuleVisibility;
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

const FULL_CONTROL_CENTER_ACCESS: Record<ControlCenterModuleKey, boolean> = {
  overview: true,
  clients: true,
  workspaces: true,
  deploymentQueue: true,
  supportQueue: true,
  launchReadiness: true,
  connectors: true,
  templates: true,
  team: true,
  plansBilling: true,
  reports: true,
  analytics: true,
  auditLogs: true,
  systemSettings: true,
};

const DEFAULT_EMAIL_TEMPLATES: Record<PlatformEmailTemplateKey, {
  enabled: boolean;
  subject: string;
  preheader: string;
  html: string;
  text: string;
}> = {
  CLIENT_SIGNUP: {
    enabled: true,
    subject: 'Welcome to Marveo',
    preheader: 'Your Marveo account is ready to use.',
    html: '<p>Hello {{clientName}},</p><p>Your Marveo account has been created successfully.</p><p>Login: {{appBaseUrl}}</p>',
    text: 'Hello {{clientName}}, your Marveo account has been created. Login: {{appBaseUrl}}',
  },
  CLIENT_DEPLOYED: {
    enabled: true,
    subject: 'Your website is now live',
    preheader: 'Deployment completed successfully.',
    html: '<p>Hello {{clientName}},</p><p>Your deployment for {{workspaceName}} is complete.</p><p>URL: {{siteUrl}}</p>',
    text: 'Hello {{clientName}}, your deployment for {{workspaceName}} is complete. URL: {{siteUrl}}',
  },
  DEPLOYMENT_FAILED: {
    enabled: true,
    subject: 'Deployment failed for {{workspaceName}}',
    preheader: 'A deployment action needs your attention.',
    html: '<p>Hello {{clientName}},</p><p>Your deployment for {{workspaceName}} failed.</p><p>Error: {{errorMessage}}</p><p>Support: {{supportEmail}}</p>',
    text: 'Hello {{clientName}}, your deployment for {{workspaceName}} failed. Error: {{errorMessage}}. Support: {{supportEmail}}',
  },
  PASSWORD_RESET_REQUESTED: {
    enabled: true,
    subject: 'Password reset requested',
    preheader: 'A password reset request was initiated.',
    html: '<p>Hello {{userName}},</p><p>A password reset was requested for your account.</p><p>If this was not you, contact support immediately.</p>',
    text: 'Hello {{userName}}, a password reset was requested for your account. If this was not you, contact support immediately.',
  },
  PASSWORD_CHANGED: {
    enabled: true,
    subject: 'Password changed successfully',
    preheader: 'Your account password was updated.',
    html: '<p>Hello {{userName}},</p><p>Your password was changed successfully.</p><p>If this was not you, contact support immediately.</p>',
    text: 'Hello {{userName}}, your password was changed successfully. If this was not you, contact support immediately.',
  },
  PAYMENT_RECEIVED: {
    enabled: true,
    subject: 'Payment received',
    preheader: 'We have confirmed your latest payment.',
    html: '<p>Hello {{clientName}},</p><p>We received your payment of {{amount}} {{currency}}.</p><p>Reference: {{paymentReference}}</p>',
    text: 'Hello {{clientName}}, we received your payment of {{amount}} {{currency}}. Reference: {{paymentReference}}',
  },
  PAYMENT_FAILED: {
    enabled: true,
    subject: 'Payment verification failed',
    preheader: 'Payment verification did not complete successfully.',
    html: '<p>Hello {{clientName}},</p><p>Your payment could not be verified.</p><p>Reference: {{paymentReference}}</p><p>Reason: {{errorMessage}}</p>',
    text: 'Hello {{clientName}}, your payment could not be verified. Reference: {{paymentReference}}. Reason: {{errorMessage}}',
  },
  BILLING_NOTICE: {
    enabled: true,
    subject: 'Billing notification',
    preheader: 'Important billing information for your subscription.',
    html: '<p>Hello {{clientName}},</p><p>This is a billing notice for your subscription {{subscriptionId}}.</p>',
    text: 'Hello {{clientName}}, this is a billing notice for your subscription {{subscriptionId}}.',
  },
  BILLING_SUSPENDED: {
    enabled: true,
    subject: 'Subscription suspended',
    preheader: 'Your subscription status changed to suspended.',
    html: '<p>Hello {{clientName}},</p><p>Your subscription {{subscriptionId}} is now suspended.</p><p>Please contact billing support at {{billingEmail}}.</p>',
    text: 'Hello {{clientName}}, your subscription {{subscriptionId}} is now suspended. Contact billing support at {{billingEmail}}.',
  },
  BILLING_REACTIVATED: {
    enabled: true,
    subject: 'Subscription reactivated',
    preheader: 'Your subscription has been reactivated successfully.',
    html: '<p>Hello {{clientName}},</p><p>Your subscription {{subscriptionId}} has been reactivated.</p>',
    text: 'Hello {{clientName}}, your subscription {{subscriptionId}} has been reactivated.',
  },
  USER_INVITE: {
    enabled: true,
    subject: 'You have been invited to Marveo Control Center',
    preheader: 'Your Marveo access invitation is ready.',
    html: '<p>Hello {{userName}},</p><p>You have been invited as {{roleName}}.</p><p><strong>Temporary password:</strong> {{tempPassword}}</p><p>Login: {{loginUrl}}</p><p>After signing in, change your password here: {{changePasswordUrl}}</p>',
    text: 'Hello {{userName}}, you have been invited as {{roleName}}. Temporary password: {{tempPassword}}. Login: {{loginUrl}}. Change password: {{changePasswordUrl}}',
  },
  USER_STATUS_CHANGED: {
    enabled: true,
    subject: 'Account status updated',
    preheader: 'Your account role or status has changed.',
    html: '<p>Hello {{userName}},</p><p>Your Marveo account status is now {{status}}.</p><p>Role: {{roleName}}</p>',
    text: 'Hello {{userName}}, your Marveo account status is now {{status}}. Role: {{roleName}}',
  },
  SUPPORT_ASSIGNED: {
    enabled: true,
    subject: 'Support assigned for {{workspaceName}}',
    preheader: 'A support officer has been assigned to your workspace.',
    html: '<p>Hello {{clientName}},</p><p>{{supportOfficerName}} has been assigned to support your workspace {{workspaceName}}.</p>',
    text: 'Hello {{clientName}}, {{supportOfficerName}} has been assigned to support your workspace {{workspaceName}}.',
  },
  CONNECTOR_FAILED: {
    enabled: true,
    subject: 'Connector verification failed for {{workspaceName}}',
    preheader: 'Connector verification needs attention.',
    html: '<p>Hello {{clientName}},</p><p>Connector verification failed for {{workspaceName}}.</p><p>Error: {{errorMessage}}</p>',
    text: 'Hello {{clientName}}, connector verification failed for {{workspaceName}}. Error: {{errorMessage}}',
  },
  SYSTEM_FAILURE_ALERT: {
    enabled: true,
    subject: 'System failure alert: {{failureType}}',
    preheader: 'Operational failure alert from Marveo.',
    html: '<p>Failure type: {{failureType}}</p><p>Workspace: {{workspaceId}}</p><p>Error: {{errorMessage}}</p>',
    text: 'Failure type: {{failureType}} | Workspace: {{workspaceId}} | Error: {{errorMessage}}',
  },
};

// ─── Database persistence ─────────────────────────────────────────────────────
type StoreBackend = 'vercel_postgres';

function normalizePostgresUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  try {
    const parsed = new URL(rawUrl);
    const sslMode = parsed.searchParams.get('sslmode');
    if (sslMode && ['prefer', 'require', 'verify-ca'].includes(sslMode)) {
      parsed.searchParams.set('uselibpqcompat', 'true');
    }
    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

const POSTGRES_URL = normalizePostgresUrl(process.env.DATABASE_URL || '');
const STORE_BACKEND: StoreBackend = 'vercel_postgres';

const POSTGRES_TABLE = ((process.env.MARVEO_ADMIN_CONFIG_TABLE || 'marveo_admin_config').trim().match(/^[A-Za-z_][A-Za-z0-9_]*$/)?.[0]) || 'marveo_admin_config';
const POSTGRES_KEY = (process.env.MARVEO_ADMIN_CONFIG_KEY || 'global').trim() || 'global';

export function getAdminStoreBackendDiagnostics() {
  let postgresHost = '';
  if (POSTGRES_URL) {
    try {
      postgresHost = new URL(POSTGRES_URL).host;
    } catch {
      postgresHost = '';
    }
  }

  return {
    backend: STORE_BACKEND,
    postgresConfigured: Boolean(POSTGRES_URL),
    postgresHost,
    postgresTable: POSTGRES_TABLE,
    postgresKey: POSTGRES_KEY,
  };
}

type PostgresClient = import('pg').Client;

let pgClientPromise: Promise<PostgresClient> | null = null;

function isRecoverablePostgresError(error: unknown): boolean {
  const message = String((error as { message?: unknown })?.message || error || '').toLowerCase();
  return [
    'not queryable',
    'connection terminated',
    'connection ended unexpectedly',
    'connection error',
    'socket hang up',
    'econnreset',
    'etimedout',
    'terminating connection',
  ].some((fragment) => message.includes(fragment));
}

async function resetPostgresClient() {
  const current = pgClientPromise;
  pgClientPromise = null;

  if (!current) return;

  try {
    const client = await current;
    if (typeof client.end === 'function') {
      await client.end();
    }
  } catch {
    // Ignore cleanup errors when resetting broken client state.
  }
}

async function getPostgresClient() {
  if (!POSTGRES_URL) {
    throw new Error('DATABASE_URL is required. Admin store is Postgres-only.');
  }

  if (!pgClientPromise) {
    pgClientPromise = (async () => {
      const { Client } = await import('pg');
      const client = new Client({
        connectionString: POSTGRES_URL,
        ssl: POSTGRES_URL.includes('localhost') ? false : { rejectUnauthorized: false },
      });
      if (typeof client.on === 'function') {
        client.on('error', () => {
          pgClientPromise = null;
        });
        client.on('end', () => {
          pgClientPromise = null;
        });
      }
      await client.connect();
      return client;
    })();
  }

  return pgClientPromise;
}

async function executePostgresQuery(text: string, params?: unknown[]) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const client = await getPostgresClient();
      return await client.query(text, params);
    } catch (error) {
      if (attempt === 0 && isRecoverablePostgresError(error)) {
        await resetPostgresClient();
        continue;
      }
      throw error;
    }
  }

  throw new Error('Postgres query failed after retry.');
}

async function ensurePostgresStoreTable() {
  await executePostgresQuery(
    `CREATE TABLE IF NOT EXISTS ${POSTGRES_TABLE} (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
  );
}

const LEGACY_STORE_PATH = path.join(process.cwd(), '.admin-data', 'ecommerce-admin-config.json');

const DEFAULT_STORE: AdminConfigStore = {
  users: {},
  nativeAuth: {
    identities: {},
    sessions: {},
    permissions: {},
    passwordChangeOtps: {},
  },
  platformSettings: {
    trialDurationDays: 14,
    pricingVisibility: 'PUBLIC',
    regionalPricingEnabled: true,
    paymentProvider: {
      provider: 'NONE',
      mode: 'sandbox',
      configured: false,
      publishableKeyRef: '',
      secretKeyRef: '',
      webhookSecretRef: '',
      webhookUrl: '',
      webhookConfigured: false,
      merchantDisplayName: 'Marveo',
      settlementCurrency: 'USD',
      autoCapture: true,
      require3DS: false,
    },
    paymentProviders: {
      PAYSTACK: {
        enabled: true,
        configured: false,
        mode: 'sandbox',
        priority: 1,
        applicableMarkets: ['NG'],
        settlementCurrencies: ['NGN'],
        publishableKeyRef: '',
        secretKeyRef: '',
        webhookSecretRef: '',
        webhookUrl: '',
        customEndpoint: '',
      },
      FLUTTERWAVE: {
        enabled: false,
        configured: false,
        mode: 'sandbox',
        priority: 2,
        applicableMarkets: ['NG', 'AE', 'AFRICA_OTHER'],
        settlementCurrencies: ['NGN', 'USD'],
        publishableKeyRef: '',
        secretKeyRef: '',
        webhookSecretRef: '',
        webhookUrl: '',
        customEndpoint: '',
      },
      CUSTOM: {
        enabled: false,
        configured: false,
        mode: 'sandbox',
        priority: 5,
        applicableMarkets: ['NG', 'GB', 'AE', 'CA', 'US', 'AFRICA_OTHER'],
        settlementCurrencies: ['USD', 'GBP', 'NGN'],
        publishableKeyRef: '',
        secretKeyRef: '',
        webhookSecretRef: '',
        webhookUrl: '',
        customEndpoint: '',
      },
      STRIPE: {
        enabled: true,
        configured: false,
        mode: 'sandbox',
        priority: 3,
        applicableMarkets: ['GB', 'AE', 'CA', 'US'],
        settlementCurrencies: ['USD', 'GBP'],
        publishableKeyRef: '',
        secretKeyRef: '',
        webhookSecretRef: '',
        webhookUrl: '',
        customEndpoint: '',
      },
      PAYPAL: {
        enabled: false,
        configured: false,
        mode: 'sandbox',
        priority: 4,
        applicableMarkets: ['GB', 'AE', 'CA', 'US', 'AFRICA_OTHER'],
        settlementCurrencies: ['USD', 'GBP'],
        publishableKeyRef: '',
        secretKeyRef: '',
        webhookSecretRef: '',
        webhookUrl: '',
        customEndpoint: '',
      },
    },
    billingCurrencyPolicy: {
      basePricingCurrency: 'USD',
      autoConvertFromBase: true,
      countryCurrencyMap: {
        NG: 'NGN',
        GB: 'GBP',
        AE: 'USD',
        CA: 'USD',
        US: 'USD',
        AFRICA_OTHER: 'USD',
      },
      fxRates: {
        USD: 1,
        GBP: 0.79,
        NGN: 1550,
      },
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
    branding: {
      brandName: 'Marveo',
      brandByline: 'Commerce Operations Cloud',
      logoUrl: '',
      dashboardLogoUrl: '',
      portalLoginLogoUrl: '',
      faviconUrl: '',
      footerLogoUrl: '',
      primaryColor: '#0f172a',
      secondaryColor: '#0ea5e9',
      websiteUrl: '',
      footerAddressLine: '',
      footerDescription: 'Marveo unifies WordPress, headless CMS, and commerce orchestration.',
      footerBadgeText: 'Built for developers and agencies',
      footerStatusLabel: 'Status',
      footerStatusUrl: '',
      footerDocsLabel: 'Documentation',
      footerDocsUrl: '',
      footerGdprLabel: 'GDPR',
      footerGdprUrl: '',
      footerUnsubscribeLabel: 'Unsubscribe',
      footerUnsubscribeUrl: '',
    },
    email: {
      enabled: true,
      provider: 'SMTP',
      host: '',
      port: 587,
      secure: false,
      username: '',
      password: '',
      fromEmail: '',
      fromName: 'Marveo Operations',
      replyToEmail: '',
      appBaseUrl: process.env.NEXT_PUBLIC_BASE_URL || '',
      apiBaseUrl: process.env.NEXT_PUBLIC_WORDPRESS_API_URL || '',
      supportPortalUrl: '/master/support',
      supportEmail: '',
      billingEmail: '',
      deploymentEmail: '',
      userOpsEmail: '',
      sendFailureAlerts: true,
      failureAlertRecipients: [],
    },
    reporting: {
      scheduleEnabled: false,
      frequency: 'WEEKLY',
      dayOfWeek: 1,
      dayOfMonth: 1,
      hourUTC: 8,
      recipients: [],
      includeIncidents: true,
      includeComplaints: true,
      includeAnalytics: true,
      updatedAt: new Date().toISOString(),
      lastRunAt: '',
      lastRunStatus: undefined,
    },
    emailTemplates: { ...DEFAULT_EMAIL_TEMPLATES },
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
    host: '',
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
    SUPER_ADMIN: { ...FULL_ACCESS },
    ADMIN: { ...FULL_ACCESS },
    SUPPORT_OFFICER: {
      dashboard: true,
      products: false,
      orders: true,
      reports: true,
      customers: true,
      blog: false,
      stores: true,
      siteSettings: false,
      adminSettings: false,
    },
    DEPLOYMENT_MANAGER: {
      dashboard: true,
      products: true,
      orders: false,
      reports: true,
      customers: true,
      blog: true,
      stores: true,
      siteSettings: true,
      adminSettings: false,
    },
    BILLING_MANAGER: {
      dashboard: true,
      products: false,
      orders: true,
      reports: true,
      customers: true,
      blog: false,
      stores: false,
      siteSettings: false,
      adminSettings: false,
    },
    CLIENT_OWNER: {
      dashboard: false,
      products: false,
      orders: false,
      reports: false,
      customers: false,
      blog: false,
      stores: false,
      siteSettings: false,
      adminSettings: false,
    },
    CLIENT_STAFF: {
      dashboard: false,
      products: false,
      orders: false,
      reports: false,
      customers: false,
      blog: false,
      stores: false,
      siteSettings: false,
      adminSettings: false,
    },
  },
  controlCenterRoleVisibility: {
    SUPER_ADMIN: { ...FULL_CONTROL_CENTER_ACCESS },
    ADMIN: {
      ...FULL_CONTROL_CENTER_ACCESS,
      auditLogs: false,
      systemSettings: false,
    },
    SUPPORT_OFFICER: {
      overview: true,
      clients: true,
      workspaces: true,
      deploymentQueue: true,
      supportQueue: true,
      launchReadiness: true,
      connectors: true,
      templates: false,
      team: false,
      plansBilling: false,
      reports: true,
      analytics: true,
      auditLogs: false,
      systemSettings: false,
    },
    DEPLOYMENT_MANAGER: {
      overview: true,
      clients: true,
      workspaces: true,
      deploymentQueue: true,
      supportQueue: true,
      launchReadiness: true,
      connectors: true,
      templates: true,
      team: false,
      plansBilling: false,
      reports: true,
      analytics: true,
      auditLogs: false,
      systemSettings: false,
    },
    BILLING_MANAGER: {
      overview: true,
      clients: true,
      workspaces: true,
      deploymentQueue: false,
      supportQueue: false,
      launchReadiness: false,
      connectors: false,
      templates: false,
      team: false,
      plansBilling: true,
      reports: true,
      analytics: true,
      auditLogs: true,
      systemSettings: false,
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
      businessTypes: ['Retail', 'Service', 'Ecommerce', 'Professional Services', 'Creative Services', 'Health & Wellness', 'Education / Training', 'Hospitality', 'Real Estate', 'Other'],
      businessModels: ['B2C', 'B2B'],
      countries: [
        { code: 'NG', name: 'Nigeria' },
        { code: 'AE', name: 'United Arab Emirates' },
        { code: 'GB', name: 'United Kingdom' },
        { code: 'US', name: 'United States' },
        { code: 'CA', name: 'Canada' },
        { code: 'KE', name: 'Kenya' },
        { code: 'ZA', name: 'South Africa' },
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
          active: true,
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
          active: true,
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
          active: true,
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
      id: String(plan.id ?? '').trim().toLowerCase(),
      name: String(plan.name ?? '').trim(),
      description: String(plan.description ?? '').trim(),
      active: typeof plan.active === 'boolean' ? plan.active : true,
      workspaceLimit: Number.isFinite(Number(plan.workspaceLimit)) ? Math.max(1, Number(plan.workspaceLimit)) : 1,
      featureEntitlements: Array.isArray(plan.featureEntitlements)
        ? plan.featureEntitlements.map((item) => String(item).trim()).filter(Boolean)
        : [],
      trialEnabled: Boolean(plan.trialEnabled),
      trialDurationDays: Number.isFinite(Number(plan.trialDurationDays)) ? Math.max(0, Number(plan.trialDurationDays)) : undefined,
      regions: Array.isArray(plan.regions)
        ? plan.regions.map((region) => {
            const legacyAmount = Number((region as { amount?: number }).amount ?? 0);
            const monthly = region.monthly ?? { amount: legacyAmount, setupFee: (region as { setupFee?: number }).setupFee ?? 0 };
            const annual = region.annual ?? { amount: legacyAmount > 0 ? legacyAmount * 10 : 0, setupFee: (region as { setupFee?: number }).setupFee ?? 0 };

            return {
              country: String(region.country ?? '').trim().toUpperCase(),
              currency: String(region.currency ?? '').trim().toUpperCase(),
              monthly: {
                amount: Math.max(0, Number(monthly.amount ?? 0)),
                setupFee: Math.max(0, Number(monthly.setupFee ?? 0)),
              },
              annual: {
                amount: Math.max(0, Number(annual.amount ?? 0)),
                setupFee: Math.max(0, Number(annual.setupFee ?? 0)),
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
      passwordChangeOtps: parsed.nativeAuth?.passwordChangeOtps ?? {},
    },
    platformSettings: {
      ...DEFAULT_STORE.platformSettings,
      ...(parsed.platformSettings ?? {}),
      paymentProvider: {
        ...DEFAULT_STORE.platformSettings.paymentProvider,
        ...(parsed.platformSettings?.paymentProvider ?? {}),
      },
      paymentProviders: {
        ...DEFAULT_STORE.platformSettings.paymentProviders,
        ...(parsed.platformSettings?.paymentProviders ?? {}),
      },
      billingCurrencyPolicy: {
        ...DEFAULT_STORE.platformSettings.billingCurrencyPolicy,
        ...(parsed.platformSettings?.billingCurrencyPolicy ?? {}),
        countryCurrencyMap: {
          ...DEFAULT_STORE.platformSettings.billingCurrencyPolicy.countryCurrencyMap,
          ...(parsed.platformSettings?.billingCurrencyPolicy?.countryCurrencyMap ?? {}),
        },
        fxRates: {
          ...DEFAULT_STORE.platformSettings.billingCurrencyPolicy.fxRates,
          ...(parsed.platformSettings?.billingCurrencyPolicy?.fxRates ?? {}),
        },
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
      branding: {
        ...DEFAULT_STORE.platformSettings.branding,
        ...(parsed.platformSettings?.branding ?? {}),
      },
      email: {
        ...DEFAULT_STORE.platformSettings.email,
        ...(parsed.platformSettings?.email ?? {}),
        // One-time migration: if host is empty but legacy smtp section has data, promote it.
        host: parsed.platformSettings?.email?.host?.trim() || parsed.smtp?.host?.trim() || DEFAULT_STORE.platformSettings.email.host,
        port: parsed.platformSettings?.email?.port || parsed.smtp?.port || DEFAULT_STORE.platformSettings.email.port,
        secure: typeof parsed.platformSettings?.email?.secure === 'boolean'
          ? parsed.platformSettings.email.secure
          : typeof parsed.smtp?.secure === 'boolean'
            ? parsed.smtp.secure
            : DEFAULT_STORE.platformSettings.email.secure,
        username: parsed.platformSettings?.email?.username?.trim() || parsed.smtp?.username?.trim() || DEFAULT_STORE.platformSettings.email.username,
        password: parsed.platformSettings?.email?.password || parsed.smtp?.password || DEFAULT_STORE.platformSettings.email.password,
        fromEmail: parsed.platformSettings?.email?.fromEmail?.trim() || parsed.smtp?.fromEmail?.trim() || DEFAULT_STORE.platformSettings.email.fromEmail,
        fromName: parsed.platformSettings?.email?.fromName?.trim() || parsed.smtp?.fromName?.trim() || DEFAULT_STORE.platformSettings.email.fromName,
        failureAlertRecipients: Array.isArray(parsed.platformSettings?.email?.failureAlertRecipients)
          ? parsed.platformSettings.email.failureAlertRecipients.map((item) => String(item).trim()).filter(Boolean)
          : DEFAULT_STORE.platformSettings.email.failureAlertRecipients,
      },
      reporting: {
        ...DEFAULT_STORE.platformSettings.reporting,
        ...(parsed.platformSettings?.reporting ?? {}),
        recipients: Array.isArray(parsed.platformSettings?.reporting?.recipients)
          ? parsed.platformSettings.reporting.recipients.map((item) => String(item).trim().toLowerCase()).filter(Boolean)
          : DEFAULT_STORE.platformSettings.reporting.recipients,
        lastRunAt: typeof parsed.platformSettings?.reporting?.lastRunAt === 'string'
          ? parsed.platformSettings.reporting.lastRunAt
          : DEFAULT_STORE.platformSettings.reporting.lastRunAt,
        lastRunStatus:
          parsed.platformSettings?.reporting?.lastRunStatus === 'success' || parsed.platformSettings?.reporting?.lastRunStatus === 'failed'
            ? parsed.platformSettings.reporting.lastRunStatus
            : DEFAULT_STORE.platformSettings.reporting.lastRunStatus,
      },
      emailTemplates: Object.fromEntries(
        PLATFORM_EMAIL_TEMPLATE_KEYS.map((templateKey) => [
          templateKey,
          {
            ...DEFAULT_STORE.platformSettings.emailTemplates[templateKey],
            ...(parsed.platformSettings?.emailTemplates?.[templateKey] ?? {}),
          },
        ]),
      ) as PlatformSettings['emailTemplates'],
    },
    tracking: { ...DEFAULT_STORE.tracking, ...(parsed.tracking ?? {}) },
    smtp: { ...DEFAULT_STORE.smtp, ...(parsed.smtp ?? {}) },
    forms: Array.isArray(parsed.forms) ? parsed.forms : DEFAULT_STORE.forms,
    roleModuleVisibility: {
      ...DEFAULT_STORE.roleModuleVisibility,
      ...(parsed.roleModuleVisibility ?? {}),
    },
    controlCenterRoleVisibility: {
      ...DEFAULT_STORE.controlCenterRoleVisibility,
      ...(parsed.controlCenterRoleVisibility ?? {}),
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

// ─── Vercel Postgres read/write ──────────────────────────────────────────────

async function readFromPostgres(): Promise<AdminConfigStore> {
  await ensurePostgresStoreTable();
  const res = await executePostgresQuery(
    `SELECT data FROM ${POSTGRES_TABLE} WHERE id = $1 LIMIT 1`,
    [POSTGRES_KEY],
  );

  if (!res.rows[0]?.data) {
    return DEFAULT_STORE;
  }

  const raw = res.rows[0].data;
  const parsed = typeof raw === 'string'
    ? (JSON.parse(raw) as Partial<AdminConfigStore>)
    : (raw as Partial<AdminConfigStore>);

  return mergeWithDefaults(parsed);
}

async function writeToPostgres(data: AdminConfigStore): Promise<void> {
  await ensurePostgresStoreTable();
  await executePostgresQuery(
    `INSERT INTO ${POSTGRES_TABLE} (id, data, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (id)
     DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
    [POSTGRES_KEY, JSON.stringify(data)],
  );
}

async function readLegacyStoreFile(): Promise<Partial<AdminConfigStore> | null> {
  try {
    const raw = await fs.readFile(LEGACY_STORE_PATH, 'utf8');
    return JSON.parse(raw) as Partial<AdminConfigStore>;
  } catch {
    return null;
  }
}

let legacyMigrationPromise: Promise<void> | null = null;

async function migrateLegacyFileToPostgresIfNeeded() {
  if (legacyMigrationPromise) {
    await legacyMigrationPromise;
    return;
  }

  legacyMigrationPromise = (async () => {
    await ensurePostgresStoreTable();

    const existing = await executePostgresQuery(
      `SELECT id FROM ${POSTGRES_TABLE} WHERE id = $1 LIMIT 1`,
      [POSTGRES_KEY],
    );
    if (existing.rows[0]?.id) {
      return;
    }

    const legacy = await readLegacyStoreFile();
    if (!legacy) {
      return;
    }

    const merged = mergeWithDefaults(legacy);
    await writeToPostgres(merged);
  })();

  await legacyMigrationPromise;
}

// ─── Public API ───────────────────────────────────────────────────────────────

let cachedStore: AdminConfigStore | null = null;
let cachedAtMs = 0;
let cachedReadPromise: Promise<AdminConfigStore> | null = null;

function getStoreCacheTtlMs(): number {
  const raw = process.env.MARVEO_STORE_CACHE_MS;
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  // Small TTL to collapse bursts of reads during a single request/render cycle.
  return 750;
}

function cacheStore(value: AdminConfigStore) {
  cachedStore = value;
  cachedAtMs = Date.now();
  cachedReadPromise = null;
}

function clearStoreCache() {
  cachedStore = null;
  cachedAtMs = 0;
  cachedReadPromise = null;
}

export async function readAdminStore(): Promise<AdminConfigStore> {
  const ttl = getStoreCacheTtlMs();
  if (ttl > 0 && cachedStore && Date.now() - cachedAtMs < ttl) {
    return cachedStore;
  }
  if (ttl > 0 && cachedReadPromise) {
    return await cachedReadPromise;
  }

  const readPromise = (async () => {
    await migrateLegacyFileToPostgresIfNeeded();
    return await readFromPostgres();
  })();

  if (ttl > 0) cachedReadPromise = readPromise;
  const store = await readPromise;
  if (ttl > 0) cacheStore(store);
  return store;
}

export async function writeAdminStore(next: AdminConfigStore): Promise<void> {
  await writeToPostgres(next);

  cacheStore(next);
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
