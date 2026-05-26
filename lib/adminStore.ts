import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { MaintenanceSettings } from '@/lib/types';

export type PortalAccess = 'b2c' | 'b2b';

export interface ManagedUserState {
  active: boolean;
  portals: PortalAccess[];
  masterRole?: string;
  rawAuthRole?: string;
  status?: 'ACTIVE' | 'INVITED' | 'DISABLED';
  assignedWorkspaceId?: string;
  assignedClientOrganizationId?: string;
  invitePending?: boolean;
  ticketSignature?: string;
}

export type NativeRole = string;

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

export interface NativeLoginOtpChallenge {
  id: string;
  identifier: string;
  surface: 'master' | 'portal';
  email: string;
  displayName: string;
  otpCode: string;
  requestedAt: string;
  lastSentAt: string;
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
    | 'SUPPORT_ACCESS_REQUESTED'
    | 'SUPPORT_ACCESS_REQUESTED_SUPPORT'
    | 'SUPPORT_ACCESS_APPROVED'
    | 'SUPPORT_ACCESS_APPROVED_SUPPORT'
    | 'USER_INVITE'
    | 'USER_STATUS_CHANGED'
    | 'SUPPORT_ASSIGNED'
    | 'SUPPORT_ASSIGNED_SUPPORT'
    | 'TICKET_ASSIGNED'
    | 'TICKET_ASSIGNED_SUPPORT'
    | 'TICKET_REPLY_CLIENT'
    | 'TICKET_REPLY_SUPPORT'
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
  sessionSecurity: {
    inactivityEnabled: boolean;
    idleTimeoutMinutes: number;
    idleWarningMinutes: number;
    enforceSingleSession: boolean;
  };
  loginProtection: {
    enabled: boolean;
    maxFailedAttempts: number;
    windowMinutes: number;
    lockoutMinutes: number;
    requireOtpChallenge: boolean;
    otpCodeTtlMinutes: number;
  };
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

export type TicketCategory =
  | 'complaint'
  | 'billing'
  | 'technical_support'
  | 'website_support'
  | 'whatsapp_integration'
  | 'general_enquiry';

export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';

export type TicketStatus =
  | 'open'
  | 'awaiting_support'
  | 'awaiting_client'
  | 'in_progress'
  | 'resolved'
  | 'closed';

export interface TicketAttachment {
  id: string;
  name: string;
  url: string;
  size?: number;
  contentType?: string;
  uploadedAt: string;
}

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  workspaceId: string;
  clientUserId: string;
  clientEmail: string;
  clientName: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  subject: string;
  descriptionHtml: string;
  descriptionText: string;
  attachments: TicketAttachment[];
  assignedTo: string | null;
  source: 'os' | 'master' | 'api';
  relatedModule: string;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  lastReplyAt: string | null;
}

export interface SupportTicketMessage {
  id: string;
  ticketId: string;
  authorType: 'client' | 'support' | 'system';
  authorId: string;
  authorName: string;
  messageHtml: string;
  messageText: string;
  attachments: TicketAttachment[];
  isInternalNote: boolean;
  createdAt: string;
}

export type LiveChatSessionStatus = 'queued' | 'active' | 'awaiting_client' | 'ended' | 'converted';

export interface LiveChatSession {
  id: string;
  sessionNumber: string;
  workspaceId: string;
  clientEmail: string;
  clientName: string;
  category: TicketCategory;
  subject: string;
  status: LiveChatSessionStatus;
  assignedResponderId: string | null;
  assignedResponderName?: string;
  lastClientAt: string | null;
  lastSupportAt: string | null;
  lastPresenceAt: string | null;
  linkedTicketId: string | null;
  linkedTicketNumber: string | null;
  convertedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LiveChatSessionMessage {
  id: string;
  sessionId: string;
  authorType: 'client' | 'support' | 'system';
  authorId: string;
  authorName: string;
  messageHtml: string;
  messageText: string;
  attachments: TicketAttachment[];
  createdAt: string;
}

export interface LiveChatPresenceRecord {
  sessionId: string;
  clientOnline: boolean;
  supportOnline: boolean;
  lastClientSeenAt: string | null;
  lastSupportSeenAt: string | null;
  updatedAt: string;
}

export interface TicketingStore {
  tickets: Record<string, SupportTicket>;
  messages: Record<string, SupportTicketMessage[]>;
  liveSessions: Record<string, LiveChatSession>;
  liveMessages: Record<string, LiveChatSessionMessage[]>;
  livePresence: Record<string, LiveChatPresenceRecord>;
  definedReplies: Record<string, {
    id: string;
    title: string;
    contentHtml: string;
    contentText: string;
    createdAt: string;
    updatedAt: string;
  }>;
  knowledgeArticles: Record<string, {
    id: string;
    title: string;
    summary: string;
    audience: 'internal' | 'client' | 'both';
    sourceDoc?: string;
    heroImageUrl?: string;
    videoUrl?: string;
    contentHtml: string;
    contentText: string;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
  }>;
  counters: {
    nextTicketSequence: number;
    nextLiveSessionSequence: number;
  };
}

export type OperationalAssignmentEntity =
  | 'ticket'
  | 'deployment'
  | 'support_queue'
  | 'launch_readiness'
  | 'support_session';

export type OperationalAssignmentStatus =
  | 'unassigned'
  | 'assigned'
  | 'in_progress'
  | 'awaiting_response'
  | 'escalated'
  | 'completed';

export interface OperationalAssignmentRecord {
  id: string;
  entityType: OperationalAssignmentEntity;
  entityId: string;
  workspaceId?: string;
  assignedToUserId: string;
  assignedToName: string;
  assignedRole: string;
  assignedAt: string;
  assignedBy: string;
  assignmentStatus: OperationalAssignmentStatus;
  metadata?: Record<string, unknown>;
}

export interface OperationalActivityEvent {
  id: string;
  type:
    | 'ticket_assigned'
    | 'deployment_assigned'
    | 'connector_failed'
    | 'payment_failed'
    | 'launch_approved'
    | 'support_session_started'
    | 'template_selected'
    | 'website_connected';
  actor: string;
  target: string;
  workspaceId?: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface OperationalAuditEvent {
  id: string;
  actor: string;
  action: string;
  entity: string;
  entityId: string;
  workspaceId?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface MasterOperationsStore {
  assignments: Record<string, OperationalAssignmentRecord>;
  activityFeed: OperationalActivityEvent[];
  auditTrail: OperationalAuditEvent[];
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
    supportOfficerType?: 'CUSTOMER_SUPPORT' | 'TECHNICAL_SUPPORT';
    ticketId?: string;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    reason?: string;
    setupType?: 'NEW_WEBSITE' | 'EXISTING_WEBSITE' | 'CUSTOM_HEADLESS';
    requiredSkills?: string[];
    initialNotes?: string;
    technicalSupportOfficerId?: string;
    technicalSupportOfficerName?: string;
    escalationStatus?: 'NONE' | 'REQUESTED' | 'ASSIGNED' | 'RESOLVED';
    escalatedAt?: string;
  };
  launchGuardLastCheckedAt?: string;
  connectorStatus?: ConnectorStatusKey;
  connectorToken?: string;
  connectorConnectedAt?: string;
  connectorLastVerificationAttempt?: string;
  connectorVerificationError?: string;
  connectorSiteMetadata?: ConnectorSiteMetadata;
  supportChatPin?: string;
  supportChatPinUpdatedAt?: string;
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
  introductoryMonthly?: CommercialPlanIntervalPricing;
  introductoryAnnual?: CommercialPlanIntervalPricing;
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
  renewalAmount: number;
  renewalSetupFee?: number;
  firstBillAmount?: number;
  firstBillSetupFee?: number;
  billingInterval: CommercialBillingInterval;
  intendedBillingInterval: CommercialBillingInterval;
  billingPeriodStartAt?: string;
  billingPeriodEndAt?: string;
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
  lastInvoiceId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CommercialInvoiceRecord {
  id: string;
  invoiceNumber: string;
  subscriptionId: string;
  organizationId: string;
  identityId: string;
  planId: string;
  customerEmail: string;
  customerName?: string;
  currency: string;
  amount: number;
  billingInterval: CommercialBillingInterval;
  billingType: 'FIRST_BILL' | 'RENEWAL' | 'CYCLE_CHANGE';
  issuedAt: string;
  dueAt?: string;
  pdfFileName?: string;
  pdfSentAt?: string;
}

export interface CommercialBillingCycleChangeRequest {
  id: string;
  subscriptionId: string;
  organizationId: string;
  requestedBy: string;
  requestedByRole: string;
  currentBillingInterval: CommercialBillingInterval;
  targetBillingInterval: CommercialBillingInterval;
  proratedAmount: number;
  reason?: string;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'APPLIED';
  requestedAt: string;
  approvedAt?: string;
  approvedBy?: string;
  appliedAt?: string;
  appliedBy?: string;
  rejectionReason?: string;
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
  professionKeys?: string[];
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
  invoices: Record<string, CommercialInvoiceRecord>;
  billingCycleChangeRequests: Record<string, CommercialBillingCycleChangeRequest>;
}

export type FinanceLedgerType = 'income' | 'expense';
export type FinanceIncomeStatus = 'pending' | 'paid' | 'failed' | 'refunded';
export type FinanceExpenseStatus = 'pending' | 'approved' | 'paid' | 'cancelled';
export type FinanceLedgerStatus = FinanceIncomeStatus | FinanceExpenseStatus;

export interface FinanceLedgerEntry {
  id: string;
  type: FinanceLedgerType;
  category: string;
  subcategory: string;
  amount: number;
  currency: string;
  description: string;
  reference: string;
  source: string;
  sourceId: string;
  workspaceId?: string;
  clientId?: string;
  status: FinanceLedgerStatus;
  createdBy: string;
  createdAt: string;
  transactionDate: string;
  vendor?: string;
  paymentMethod?: string;
  receipt?: string;
  notes?: string;
  incurredDate?: string;
}

export interface FinanceStore {
  ledger: Record<string, FinanceLedgerEntry>;
  categories: {
    income: string[];
    expense: string[];
  };
  counters: {
    nextLedgerSequence: number;
  };
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
  operations: MasterOperationsStore;
  ticketing: TicketingStore;
  commercial: CommercialConfig;
  finance: FinanceStore;
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
  'tickets',
  'knowledgeCenter',
  'definedReplies',
  'launchReadiness',
  'connectors',
  'templates',
  'team',
  'finance',
  'plansBilling',
  'reports',
  'analytics',
  'auditLogs',
  'systemSettings',
  'rolePrivileges',
] as const;

export const MASTER_PERMISSION_ACTION_KEYS = [
  'view',
  'create',
  'update',
  'delete',
  'assign',
  'approve',
  'export',
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
  'SUPPORT_ACCESS_REQUESTED',
  'SUPPORT_ACCESS_REQUESTED_SUPPORT',
  'SUPPORT_ACCESS_APPROVED',
  'SUPPORT_ACCESS_APPROVED_SUPPORT',
  'USER_INVITE',
  'USER_STATUS_CHANGED',
  'SUPPORT_ASSIGNED',
  'SUPPORT_ASSIGNED_SUPPORT',
  'TICKET_ASSIGNED',
  'TICKET_ASSIGNED_SUPPORT',
  'TICKET_REPLY_CLIENT',
  'TICKET_REPLY_SUPPORT',
  'CONNECTOR_FAILED',
  'SYSTEM_FAILURE_ALERT',
] as const;

export type AdminModuleKey = (typeof ADMIN_MODULE_KEYS)[number];
export type ControlCenterModuleKey = (typeof CONTROL_CENTER_MODULE_KEYS)[number];
export type MasterPermissionActionKey = (typeof MASTER_PERMISSION_ACTION_KEYS)[number];
export type PlatformEmailTemplateKey = (typeof PLATFORM_EMAIL_TEMPLATE_KEYS)[number];
export type RoleModuleVisibility = Record<string, Partial<Record<AdminModuleKey, boolean>>>;
export type ControlCenterRoleModuleVisibility = Record<string, Partial<Record<ControlCenterModuleKey, boolean>>>;
export type ControlCenterRoleActionPermissions = Record<
  string,
  Partial<Record<ControlCenterModuleKey, Partial<Record<MasterPermissionActionKey, boolean>>>>
>;

export interface AdminConfigStore {
  users: Record<string, ManagedUserState>;
  nativeAuth: {
    identities: Record<string, NativePlatformIdentity>;
    sessions: Record<string, NativePlatformSession>;
    permissions: Record<string, string[]>;
    passwordChangeOtps: Record<string, NativePasswordChangeOtp>;
    loginOtpChallenges: Record<string, NativeLoginOtpChallenge>;
  };
  platformSettings: PlatformSettings;
  tracking: TrackingConfig;
  smtp: SmtpConfig;
  forms: FormRoutingRule[];
  roleModuleVisibility: RoleModuleVisibility;
  controlCenterRoleVisibility: ControlCenterRoleModuleVisibility;
  controlCenterRoleActionPermissions: ControlCenterRoleActionPermissions;
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
  tickets: true,
  knowledgeCenter: true,
  definedReplies: true,
  launchReadiness: true,
  connectors: true,
  templates: true,
  team: true,
  finance: true,
  plansBilling: true,
  reports: true,
  analytics: true,
  auditLogs: true,
  systemSettings: true,
  rolePrivileges: true,
};

const FULL_ACTION_ACCESS: Record<MasterPermissionActionKey, boolean> = {
  view: true,
  create: true,
  update: true,
  delete: true,
  assign: true,
  approve: true,
  export: true,
};

const VIEW_ONLY_ACTION_ACCESS: Record<MasterPermissionActionKey, boolean> = {
  view: true,
  create: false,
  update: false,
  delete: false,
  assign: false,
  approve: false,
  export: false,
};

const NO_ACTION_ACCESS: Record<MasterPermissionActionKey, boolean> = {
  view: false,
  create: false,
  update: false,
  delete: false,
  assign: false,
  approve: false,
  export: false,
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
  SUPPORT_ACCESS_REQUESTED: {
    enabled: true,
    subject: 'Support access requested for {{workspaceName}}',
    preheader: 'A temporary support access code was sent to your client.',
    html: '<p>Hello {{clientName}},</p><p>A support officer requested temporary access for <strong>{{workspaceName}}</strong>.</p><p><strong>Verification code:</strong> {{otpCode}}</p><p>Reason: {{reason}}</p><p>Expires at: {{expiresAt}}</p>',
    text: 'Hello {{clientName}}, a support officer requested temporary access for {{workspaceName}}. Verification code: {{otpCode}}. Reason: {{reason}}. Expires at: {{expiresAt}}.',
  },
  SUPPORT_ACCESS_REQUESTED_SUPPORT: {
    enabled: true,
    subject: 'Support access request sent for {{workspaceName}}',
    preheader: 'The client has been sent a verification code.',
    html: '<p>Hello {{supportOfficerName}},</p><p>The verification code has been sent to {{clientName}} ({{clientEmail}}) for <strong>{{workspaceName}}</strong>.</p><p>Expires at: {{expiresAt}}</p><p>Reason: {{reason}}</p>',
    text: 'Hello {{supportOfficerName}}, the verification code has been sent to {{clientName}} ({{clientEmail}}) for {{workspaceName}}. Expires at: {{expiresAt}}. Reason: {{reason}}.',
  },
  SUPPORT_ACCESS_APPROVED: {
    enabled: true,
    subject: 'Support access approved for {{workspaceName}}',
    preheader: 'Your support request was approved.',
    html: '<p>Hello {{clientName}},</p><p>Your support access request for <strong>{{workspaceName}}</strong> has been approved.</p><p>Session reference: {{sessionId}}</p><p>Expires at: {{expiresAt}}</p>',
    text: 'Hello {{clientName}}, your support access request for {{workspaceName}} has been approved. Session reference: {{sessionId}}. Expires at: {{expiresAt}}.',
  },
  SUPPORT_ACCESS_APPROVED_SUPPORT: {
    enabled: true,
    subject: 'Support access session issued for {{workspaceName}}',
    preheader: 'Support access is now active.',
    html: '<p>Hello {{supportOfficerName}},</p><p>Support access is now active for <strong>{{workspaceName}}</strong>.</p><p>Client: {{clientEmail}}</p><p>Session reference: {{sessionId}}</p><p>Expires at: {{expiresAt}}</p>',
    text: 'Hello {{supportOfficerName}}, support access is now active for {{workspaceName}}. Client: {{clientEmail}}. Session reference: {{sessionId}}. Expires at: {{expiresAt}}.',
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
  SUPPORT_ASSIGNED_SUPPORT: {
    enabled: true,
    subject: 'Support assignment for {{workspaceName}}',
    preheader: 'You have been assigned to a workspace support request.',
    html: '<p>Hello {{supportOfficerName}},</p><p>You have been assigned to support <strong>{{workspaceName}}</strong>.</p><p>Client: {{clientEmail}}</p><p>Ticket reference: {{ticketId}}</p><p>Priority: {{priority}}</p>',
    text: 'Hello {{supportOfficerName}}, you have been assigned to support {{workspaceName}}. Client: {{clientEmail}}. Ticket reference: {{ticketId}}. Priority: {{priority}}.',
  },
  TICKET_ASSIGNED: {
    enabled: true,
    subject: 'Ticket assigned: {{ticketNumber}}',
    preheader: 'A support ticket was assigned to your team.',
    html: '<p>Hello {{clientName}},</p><p>Your ticket <strong>{{ticketNumber}}</strong> is now assigned.</p><p>Workspace: {{workspaceName}}</p><p>Status: {{ticketStatus}}</p>',
    text: 'Hello {{clientName}}, your ticket {{ticketNumber}} is now assigned. Workspace: {{workspaceName}}. Status: {{ticketStatus}}.',
  },
  TICKET_ASSIGNED_SUPPORT: {
    enabled: true,
    subject: 'Ticket assigned: {{ticketNumber}}',
    preheader: 'You have a new assigned support ticket.',
    html: '<p>Hello {{supportOfficerName}},</p><p>You have been assigned ticket <strong>{{ticketNumber}}</strong>.</p><p>Workspace: {{workspaceName}}</p><p>Subject: {{ticketSubject}}</p><p>Client: {{clientEmail}}</p>',
    text: 'Hello {{supportOfficerName}}, you have been assigned ticket {{ticketNumber}}. Workspace: {{workspaceName}}. Subject: {{ticketSubject}}. Client: {{clientEmail}}.',
  },
  TICKET_REPLY_CLIENT: {
    enabled: true,
    subject: 'You have a new reply to your support ticket {{ticketNumber}}',
    preheader: 'A Marveo support specialist replied to your ticket.',
    html: '<p>Hello {{clientName}},</p><p>You have a new reply to your support ticket.</p><p><strong>Ticket Reference:</strong> {{ticketNumber}}</p><p><strong>From:</strong> {{supportOfficerName}} ({{supportOfficerRole}})</p><p><strong>Message:</strong></p><div>{{messageBody}}</div><p>To respond, log into your Marveo workspace support center where you can view your full ticket history.</p><p>Thank you,<br/>{{brandName}}</p>',
    text: 'Hello {{clientName}}, you have a new reply to your support ticket {{ticketNumber}}. From: {{supportOfficerName}} ({{supportOfficerRole}}). Message: {{messageText}}. Reply from your Marveo workspace support center. Thank you, {{brandName}}.',
  },
  TICKET_REPLY_SUPPORT: {
    enabled: true,
    subject: 'Client replied on ticket {{ticketNumber}}',
    preheader: 'A client has responded and needs follow-up.',
    html: '<p>Hello {{supportOfficerName}},</p><p>The client replied on ticket <strong>{{ticketNumber}}</strong>.</p><p><strong>Workspace:</strong> {{workspaceName}}</p><p><strong>Client:</strong> {{clientEmail}}</p><p><strong>Message:</strong></p><div>{{messageBody}}</div>',
    text: 'Hello {{supportOfficerName}}, the client replied on ticket {{ticketNumber}}. Workspace: {{workspaceName}}. Client: {{clientEmail}}. Message: {{messageText}}.',
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

function buildActionPermissionsFromModuleVisibility(
  visibility: ControlCenterRoleModuleVisibility,
): ControlCenterRoleActionPermissions {
  const operationalEditor = {
    view: true,
    create: true,
    update: true,
    delete: false,
    assign: true,
    approve: false,
    export: true,
  };

  const resolveRoleDefault = (
    role: string,
    moduleKey: ControlCenterModuleKey,
    enabled: boolean,
  ): Record<MasterPermissionActionKey, boolean> => {
    if (!enabled) return { ...NO_ACTION_ACCESS };
    if (role === 'SUPER_ADMIN') return { ...FULL_ACTION_ACCESS };

    if (role === 'ADMIN') {
      if (moduleKey === 'systemSettings' || moduleKey === 'rolePrivileges') return { ...NO_ACTION_ACCESS };
      const next = { ...operationalEditor };
      if (moduleKey === 'deploymentQueue' || moduleKey === 'launchReadiness') next.approve = true;
      return next;
    }

    if (role === 'CUSTOMER_SUPPORT') {
      if (moduleKey === 'tickets') return { view: true, create: true, update: true, delete: false, assign: false, approve: false, export: true };
      if (moduleKey === 'supportQueue' || moduleKey === 'definedReplies' || moduleKey === 'knowledgeCenter') return { view: true, create: true, update: true, delete: false, assign: false, approve: false, export: false };
      return { ...VIEW_ONLY_ACTION_ACCESS };
    }

    if (role === 'TECHNICAL_SUPPORT') {
      if (moduleKey === 'deploymentQueue' || moduleKey === 'launchReadiness' || moduleKey === 'connectors' || moduleKey === 'supportQueue' || moduleKey === 'tickets') {
        return { view: true, create: false, update: true, delete: false, assign: true, approve: false, export: false };
      }
      return { ...VIEW_ONLY_ACTION_ACCESS };
    }

    if (role === 'DEPLOYMENT_MANAGER') {
      if (moduleKey === 'deploymentQueue' || moduleKey === 'launchReadiness') {
        return { view: true, create: false, update: true, delete: false, assign: true, approve: true, export: true };
      }
      if (moduleKey === 'workspaces' || moduleKey === 'supportQueue') {
        return { view: true, create: false, update: true, delete: false, assign: true, approve: false, export: false };
      }
      return { ...VIEW_ONLY_ACTION_ACCESS };
    }

    if (role === 'BILLING_MANAGER') {
      if (moduleKey === 'finance') {
        return { view: true, create: true, update: true, delete: false, assign: false, approve: true, export: true };
      }
      if (moduleKey === 'plansBilling') {
        return { view: true, create: false, update: true, delete: false, assign: false, approve: true, export: true };
      }
      if (moduleKey === 'reports') {
        return { view: true, create: false, update: false, delete: false, assign: false, approve: false, export: true };
      }
      if (moduleKey === 'tickets') {
        return { view: true, create: false, update: true, delete: false, assign: false, approve: false, export: false };
      }
      return { ...VIEW_ONLY_ACTION_ACCESS };
    }

    return { ...VIEW_ONLY_ACTION_ACCESS };
  };

  return Object.fromEntries(
    Object.entries(visibility).map(([role, moduleMap]) => [
      role,
      Object.fromEntries(
        CONTROL_CENTER_MODULE_KEYS.map((moduleKey) => {
          const enabled = Boolean(moduleMap?.[moduleKey]);
          return [moduleKey, resolveRoleDefault(role, moduleKey, enabled)];
        }),
      ),
    ]),
  ) as ControlCenterRoleActionPermissions;
}

const DEFAULT_CONTROL_CENTER_ROLE_VISIBILITY: ControlCenterRoleModuleVisibility = {
  SUPER_ADMIN: { ...FULL_CONTROL_CENTER_ACCESS },
  ADMIN: {
    overview: true,
    clients: true,
    workspaces: true,
    deploymentQueue: true,
    supportQueue: true,
    tickets: true,
    knowledgeCenter: true,
    definedReplies: false,
    launchReadiness: true,
    connectors: false,
    templates: false,
    team: false,
    finance: true,
    plansBilling: false,
    reports: true,
    analytics: false,
    auditLogs: false,
    systemSettings: false,
    rolePrivileges: false,
  },
  CUSTOMER_SUPPORT: {
    overview: true,
    clients: false,
    workspaces: false,
    deploymentQueue: false,
    supportQueue: true,
    tickets: true,
    knowledgeCenter: true,
    definedReplies: true,
    launchReadiness: false,
    connectors: false,
    templates: false,
    team: false,
    finance: false,
    plansBilling: false,
    reports: false,
    analytics: false,
    auditLogs: false,
    systemSettings: false,
    rolePrivileges: false,
  },
  TECHNICAL_SUPPORT: {
    overview: true,
    clients: false,
    workspaces: true,
    deploymentQueue: true,
    supportQueue: true,
    tickets: true,
    knowledgeCenter: true,
    definedReplies: true,
    launchReadiness: true,
    connectors: true,
    templates: false,
    team: false,
    finance: false,
    plansBilling: false,
    reports: false,
    analytics: false,
    auditLogs: false,
    systemSettings: false,
    rolePrivileges: false,
  },
  DEPLOYMENT_MANAGER: {
    overview: true,
    clients: false,
    workspaces: true,
    deploymentQueue: true,
    supportQueue: true,
    tickets: false,
    knowledgeCenter: true,
    definedReplies: false,
    launchReadiness: true,
    connectors: false,
    templates: true,
    team: false,
    finance: false,
    plansBilling: false,
    reports: false,
    analytics: false,
    auditLogs: false,
    systemSettings: false,
    rolePrivileges: false,
  },
  BILLING_MANAGER: {
    overview: true,
    clients: true,
    workspaces: false,
    deploymentQueue: false,
    supportQueue: false,
    tickets: true,
    knowledgeCenter: true,
    definedReplies: false,
    launchReadiness: false,
    connectors: false,
    templates: false,
    team: false,
    finance: true,
    plansBilling: true,
    reports: true,
    analytics: false,
    auditLogs: false,
    systemSettings: false,
    rolePrivileges: false,
  },
};

const DEFAULT_STORE: AdminConfigStore = {
  users: {},
  nativeAuth: {
    identities: {},
    sessions: {},
    permissions: {},
    passwordChangeOtps: {},
    loginOtpChallenges: {},
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
      supportPortalUrl: '/os/support',
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
    sessionSecurity: {
      inactivityEnabled: true,
      idleTimeoutMinutes: 30,
      idleWarningMinutes: 2,
      enforceSingleSession: true,
    },
    loginProtection: {
      enabled: true,
      maxFailedAttempts: 5,
      windowMinutes: 10,
      lockoutMinutes: 15,
      requireOtpChallenge: true,
      otpCodeTtlMinutes: 10,
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
    CUSTOMER_SUPPORT: {
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
    TECHNICAL_SUPPORT: {
      dashboard: true,
      products: true,
      orders: false,
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
  controlCenterRoleVisibility: { ...DEFAULT_CONTROL_CENTER_ROLE_VISIBILITY },
  controlCenterRoleActionPermissions: buildActionPermissionsFromModuleVisibility(DEFAULT_CONTROL_CENTER_ROLE_VISIBILITY),
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
    operations: {
      assignments: {},
      activityFeed: [],
      auditTrail: [],
    },
    ticketing: {
      tickets: {},
      messages: {},
      liveSessions: {},
      liveMessages: {},
      livePresence: {},
      definedReplies: {},
      knowledgeArticles: {},
      counters: {
        nextTicketSequence: 1,
        nextLiveSessionSequence: 1,
      },
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
            { country: 'NG', currency: 'NGN', monthly: { amount: 25000, setupFee: 0 }, annual: { amount: 250000, setupFee: 0 }, introductoryMonthly: { amount: 19999, setupFee: 0 }, introductoryAnnual: { amount: 199999, setupFee: 0 }, annualDiscountPercent: 17 },
            { country: 'US', currency: 'USD', monthly: { amount: 49, setupFee: 0 }, annual: { amount: 490, setupFee: 0 }, introductoryMonthly: { amount: 39, setupFee: 0 }, introductoryAnnual: { amount: 390, setupFee: 0 }, annualDiscountPercent: 17 },
            { country: 'GB', currency: 'GBP', monthly: { amount: 39, setupFee: 0 }, annual: { amount: 390, setupFee: 0 }, introductoryMonthly: { amount: 29, setupFee: 0 }, introductoryAnnual: { amount: 290, setupFee: 0 }, annualDiscountPercent: 17 },
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
            { country: 'NG', currency: 'NGN', monthly: { amount: 85000, setupFee: 0 }, annual: { amount: 850000, setupFee: 0 }, introductoryMonthly: { amount: 65000, setupFee: 0 }, introductoryAnnual: { amount: 650000, setupFee: 0 }, annualDiscountPercent: 17 },
            { country: 'US', currency: 'USD', monthly: { amount: 149, setupFee: 0 }, annual: { amount: 1490, setupFee: 0 }, introductoryMonthly: { amount: 129, setupFee: 0 }, introductoryAnnual: { amount: 1290, setupFee: 0 }, annualDiscountPercent: 17 },
            { country: 'GB', currency: 'GBP', monthly: { amount: 119, setupFee: 0 }, annual: { amount: 1190, setupFee: 0 }, introductoryMonthly: { amount: 99, setupFee: 0 }, introductoryAnnual: { amount: 990, setupFee: 0 }, annualDiscountPercent: 17 },
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
        {
          templateId: 'template-saas-platform',
          name: 'SaaS Platform',
          slug: 'saas-platform',
          businessType: 'Professional Services / Technology',
          sector: 'technology-software',
          professionKeys: ['saas-software-platform'],
          category: 'subscription-platform',
          description: 'Subscription-led SaaS template for product companies and software platforms.',
          previewImage: '/images/templates/business-pro.jpg',
          status: 'ACTIVE',
          visibility: 'PUBLIC',
          supportedWebsiteTypes: ['NEW_WEBSITE'],
          supportedStacks: ['WORDPRESS_NEXTJS', 'NEXTJS'],
          planAvailability: ['starter', 'growth', 'all'],
          featureModules: ['subscriptions-lite', 'billing-lite', 'analytics', 'onboarding-requests'],
          requiresSupport: true,
          repoSource: 'MANUAL',
          repoPath: '',
          version: '1.0.0',
          artifactStatus: 'NOT_VALIDATED',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          templateId: 'template-digital-agency',
          name: 'Agency Growth',
          slug: 'agency-growth',
          businessType: 'Professional Services / Technology',
          sector: 'technology-software',
          professionKeys: ['digital-agency'],
          category: 'service-commerce',
          description: 'Lead-generation and project pipeline template for digital agencies.',
          previewImage: '/images/templates/product-launch.jpg',
          status: 'ACTIVE',
          visibility: 'PUBLIC',
          supportedWebsiteTypes: ['NEW_WEBSITE'],
          supportedStacks: ['WORDPRESS_NEXTJS', 'NEXTJS'],
          planAvailability: ['growth', 'enterprise', 'all'],
          featureModules: ['campaigns', 'projects', 'milestones', 'invoices'],
          requiresSupport: true,
          repoSource: 'MANUAL',
          repoPath: '',
          version: '1.0.0',
          artifactStatus: 'NOT_VALIDATED',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          templateId: 'template-it-support',
          name: 'IT Support Center',
          slug: 'it-support-center',
          businessType: 'Professional Services / Technology',
          sector: 'technology-software',
          professionKeys: ['it-support-company'],
          category: 'support-operations',
          description: 'Service desk and client support template for managed IT teams.',
          previewImage: '/images/templates/business-pro.jpg',
          status: 'ACTIVE',
          visibility: 'PUBLIC',
          supportedWebsiteTypes: ['NEW_WEBSITE'],
          supportedStacks: ['WORDPRESS_NEXTJS', 'WORDPRESS_ONLY', 'NEXTJS'],
          planAvailability: ['growth', 'enterprise', 'all'],
          featureModules: ['tickets', 'live-chat', 'service-requests', 'assets'],
          requiresSupport: true,
          repoSource: 'MANUAL',
          repoPath: '',
          version: '1.0.0',
          artifactStatus: 'NOT_VALIDATED',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          templateId: 'template-software-development',
          name: 'Dev Studio',
          slug: 'dev-studio',
          businessType: 'Professional Services / Technology',
          sector: 'technology-software',
          professionKeys: ['software-development-company'],
          category: 'delivery-operations',
          description: 'Project and milestone-driven template for software development teams.',
          previewImage: '/images/templates/product-launch.jpg',
          status: 'ACTIVE',
          visibility: 'PUBLIC',
          supportedWebsiteTypes: ['NEW_WEBSITE'],
          supportedStacks: ['WORDPRESS_NEXTJS', 'NEXTJS'],
          planAvailability: ['growth', 'enterprise', 'all'],
          featureModules: ['projects', 'milestones', 'tickets', 'analytics'],
          requiresSupport: true,
          repoSource: 'MANUAL',
          repoPath: '',
          version: '1.0.0',
          artifactStatus: 'NOT_VALIDATED',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          templateId: 'template-automation-consultant',
          name: 'Automation Consultant',
          slug: 'automation-consultant',
          businessType: 'Professional Services / Technology',
          sector: 'technology-software',
          professionKeys: ['automation-consultant'],
          category: 'consulting',
          description: 'Consulting and automation delivery template for workflow specialists.',
          previewImage: '/images/templates/business-pro.jpg',
          status: 'ACTIVE',
          visibility: 'PUBLIC',
          supportedWebsiteTypes: ['NEW_WEBSITE'],
          supportedStacks: ['WORDPRESS_NEXTJS', 'NEXTJS', 'CUSTOM'],
          planAvailability: ['growth', 'enterprise', 'all'],
          featureModules: ['consultations', 'automations', 'invoices', 'campaigns'],
          requiresSupport: true,
          repoSource: 'MANUAL',
          repoPath: '',
          version: '1.0.0',
          artifactStatus: 'NOT_VALIDATED',
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
      invoices: {},
      billingCycleChangeRequests: {},
    },
    finance: {
      ledger: {},
      categories: {
        income: [
          'subscriptions',
          'workspace_setup',
          'deployment_services',
          'template_sales',
          'ai_addons',
          'website_support',
          'domain_hosting',
          'custom_development',
          'consulting',
          'training',
          'partner_revenue',
        ],
        expense: [
          'cloud_hosting',
          'infrastructure',
          'software_subscriptions',
          'domains',
          'marketing_ads',
          'staff_salaries',
          'contractors',
          'refunds',
          'operations',
          'office_admin',
          'customer_support',
          'development_costs',
          'payment_gateway_charges',
          'taxes_compliance',
        ],
      },
      counters: {
        nextLedgerSequence: 1,
      },
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
            const introductoryMonthly = region.introductoryMonthly ?? monthly;
            const introductoryAnnual = region.introductoryAnnual ?? annual;

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
              introductoryMonthly: {
                amount: Math.max(0, Number(introductoryMonthly.amount ?? 0)),
                setupFee: Math.max(0, Number(introductoryMonthly.setupFee ?? 0)),
              },
              introductoryAnnual: {
                amount: Math.max(0, Number(introductoryAnnual.amount ?? 0)),
                setupFee: Math.max(0, Number(introductoryAnnual.setupFee ?? 0)),
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
          renewalAmount: Number(subscription.renewalAmount ?? subscription.amount ?? 0),
          renewalSetupFee: Number(subscription.renewalSetupFee ?? subscription.setupFee ?? 0),
          firstBillAmount: Number(subscription.firstBillAmount ?? subscription.amount ?? 0),
          firstBillSetupFee: Number(subscription.firstBillSetupFee ?? subscription.setupFee ?? 0),
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
          professionKeys: Array.isArray(template.professionKeys)
            ? template.professionKeys.map((item) => String(item).trim()).filter(Boolean)
            : undefined,
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

  const normalizeCommercialInvoices = (invoices: CommercialConfig['invoices'] | undefined) => {
    if (!invoices) return {};

    return Object.fromEntries(
      Object.entries(invoices).map(([key, invoice]) => [
        key,
        {
          ...invoice,
          amount: Number(invoice.amount ?? 0),
          billingInterval: invoice.billingInterval ?? 'MONTHLY',
          billingType: invoice.billingType ?? 'FIRST_BILL',
        },
      ]),
    );
  };

  const normalizeBillingCycleChangeRequests = (requests: CommercialConfig['billingCycleChangeRequests'] | undefined) => {
    if (!requests) return {};

    return Object.fromEntries(
      Object.entries(requests).map(([key, request]) => [
        key,
        {
          ...request,
          currentBillingInterval: request.currentBillingInterval ?? 'MONTHLY',
          targetBillingInterval: request.targetBillingInterval ?? 'MONTHLY',
          proratedAmount: Number(request.proratedAmount ?? 0),
          status: request.status ?? 'PENDING_APPROVAL',
        },
      ]),
    );
  };

  const normalizeTicketing = (ticketing: Partial<TicketingStore> | undefined): TicketingStore => {
    const tickets = Object.fromEntries(
      Object.entries(ticketing?.tickets ?? {}).map(([key, ticket]) => [
        key,
        {
          ...ticket,
          assignedTo: ticket.assignedTo ?? null,
          source: ticket.source ?? 'os',
          relatedModule: String(ticket.relatedModule ?? ''),
          closedAt: ticket.closedAt ?? null,
          lastReplyAt: ticket.lastReplyAt ?? null,
          attachments: Array.isArray(ticket.attachments) ? ticket.attachments : [],
        },
      ]),
    ) as Record<string, SupportTicket>;

    const messages = Object.fromEntries(
      Object.entries(ticketing?.messages ?? {}).map(([key, rows]) => [
        key,
        Array.isArray(rows)
          ? rows.map((message) => ({
              ...message,
              attachments: Array.isArray(message.attachments) ? message.attachments : [],
              isInternalNote: Boolean(message.isInternalNote),
            }))
          : [],
      ]),
    ) as Record<string, SupportTicketMessage[]>;

    const liveSessions = Object.fromEntries(
      Object.entries(ticketing?.liveSessions ?? {}).map(([key, session]) => [
        key,
        {
          id: String(session.id || key),
          sessionNumber: String(session.sessionNumber || key),
          workspaceId: String(session.workspaceId || '').trim(),
          clientEmail: String(session.clientEmail || '').trim().toLowerCase(),
          clientName: String(session.clientName || '').trim() || 'Client',
          category: session.category,
          subject: String(session.subject || '').trim(),
          status: session.status || 'queued',
          assignedResponderId: session.assignedResponderId ? String(session.assignedResponderId).trim() : null,
          assignedResponderName: session.assignedResponderName ? String(session.assignedResponderName).trim() : undefined,
          lastClientAt: session.lastClientAt || null,
          lastSupportAt: session.lastSupportAt || null,
          lastPresenceAt: session.lastPresenceAt || null,
          linkedTicketId: session.linkedTicketId || null,
          linkedTicketNumber: session.linkedTicketNumber || null,
          convertedAt: session.convertedAt || null,
          endedAt: session.endedAt || null,
          createdAt: String(session.createdAt || new Date().toISOString()),
          updatedAt: String(session.updatedAt || new Date().toISOString()),
        },
      ]),
    ) as TicketingStore['liveSessions'];

    const liveMessages = Object.fromEntries(
      Object.entries(ticketing?.liveMessages ?? {}).map(([key, rows]) => [
        key,
        Array.isArray(rows)
          ? rows.map((message) => ({
              ...message,
              sessionId: String(message.sessionId || key),
              attachments: Array.isArray(message.attachments) ? message.attachments : [],
              createdAt: String(message.createdAt || new Date().toISOString()),
            }))
          : [],
      ]),
    ) as TicketingStore['liveMessages'];

    const livePresence = Object.fromEntries(
      Object.entries(ticketing?.livePresence ?? {}).map(([key, presence]) => [
        key,
        {
          sessionId: String(presence.sessionId || key),
          clientOnline: Boolean(presence.clientOnline),
          supportOnline: Boolean(presence.supportOnline),
          lastClientSeenAt: presence.lastClientSeenAt || null,
          lastSupportSeenAt: presence.lastSupportSeenAt || null,
          updatedAt: String(presence.updatedAt || new Date().toISOString()),
        },
      ]),
    ) as TicketingStore['livePresence'];

    const definedReplies = Object.fromEntries(
      Object.entries(ticketing?.definedReplies ?? {}).map(([key, reply]) => [
        key,
        {
          id: String(reply.id || key),
          title: String(reply.title || '').trim(),
          contentHtml: String(reply.contentHtml || '').trim(),
          contentText: String(reply.contentText || '').trim(),
          createdAt: String(reply.createdAt || new Date().toISOString()),
          updatedAt: String(reply.updatedAt || new Date().toISOString()),
        },
      ]).filter(([, reply]) => {
        const normalized = reply as { title?: string; contentHtml?: string };
        return Boolean(normalized.title && normalized.contentHtml);
      }),
    ) as TicketingStore['definedReplies'];

    const knowledgeArticles = Object.fromEntries(
      Object.entries(ticketing?.knowledgeArticles ?? {}).map(([key, article]) => [
        key,
        {
          id: String(article.id || key),
          title: String(article.title || '').trim(),
          summary: String(article.summary || '').trim(),
          audience: article.audience === 'internal' || article.audience === 'client' || article.audience === 'both'
            ? article.audience
            : 'both',
          sourceDoc: String(article.sourceDoc || '').trim() || undefined,
          heroImageUrl: String(article.heroImageUrl || '').trim() || undefined,
          videoUrl: String(article.videoUrl || '').trim() || undefined,
          contentHtml: String(article.contentHtml || '').trim(),
          contentText: String(article.contentText || '').trim(),
          createdBy: String(article.createdBy || 'system'),
          createdAt: String(article.createdAt || new Date().toISOString()),
          updatedAt: String(article.updatedAt || new Date().toISOString()),
        },
      ]).filter(([, article]) => {
        const normalized = article as { title?: string; contentHtml?: string };
        return Boolean(normalized.title && normalized.contentHtml);
      }),
    ) as TicketingStore['knowledgeArticles'];

    return {
      tickets,
      messages,
      liveSessions,
      liveMessages,
      livePresence,
      definedReplies,
      knowledgeArticles,
      counters: {
        nextTicketSequence: Number.isFinite(Number(ticketing?.counters?.nextTicketSequence))
          ? Math.max(1, Number(ticketing?.counters?.nextTicketSequence))
          : DEFAULT_STORE.cloud.ticketing.counters.nextTicketSequence,
        nextLiveSessionSequence: Number.isFinite(Number(ticketing?.counters?.nextLiveSessionSequence))
          ? Math.max(1, Number(ticketing?.counters?.nextLiveSessionSequence))
          : DEFAULT_STORE.cloud.ticketing.counters.nextLiveSessionSequence,
      },
    };
  };

  const normalizeOperations = (
    operations: Partial<MasterOperationsStore> | undefined,
  ): MasterOperationsStore => {
    const assignments = Object.fromEntries(
      Object.entries(operations?.assignments ?? {}).map(([key, assignment]) => [
        key,
        {
          id: String(assignment.id || key),
          entityType: assignment.entityType || 'ticket',
          entityId: String(assignment.entityId || ''),
          workspaceId: assignment.workspaceId ? String(assignment.workspaceId) : undefined,
          assignedToUserId: String(assignment.assignedToUserId || ''),
          assignedToName: String(assignment.assignedToName || '').trim(),
          assignedRole: String(assignment.assignedRole || '').trim(),
          assignedAt: String(assignment.assignedAt || new Date().toISOString()),
          assignedBy: String(assignment.assignedBy || '').trim(),
          assignmentStatus: assignment.assignmentStatus || 'assigned',
          metadata: assignment.metadata && typeof assignment.metadata === 'object'
            ? assignment.metadata
            : undefined,
        },
      ]),
    ) as Record<string, OperationalAssignmentRecord>;

    const activityFeed = Array.isArray(operations?.activityFeed)
      ? operations.activityFeed
          .map((event) => ({
            id: String(event.id || ''),
            type: event.type,
            actor: String(event.actor || '').trim(),
            target: String(event.target || '').trim(),
            workspaceId: event.workspaceId ? String(event.workspaceId) : undefined,
            createdAt: String(event.createdAt || new Date().toISOString()),
            metadata: event.metadata && typeof event.metadata === 'object' ? event.metadata : undefined,
          }))
          .filter((event) => Boolean(event.id && event.type))
      : [];

    const auditTrail = Array.isArray(operations?.auditTrail)
      ? operations.auditTrail
          .map((event) => ({
            id: String(event.id || ''),
            actor: String(event.actor || '').trim(),
            action: String(event.action || '').trim(),
            entity: String(event.entity || '').trim(),
            entityId: String(event.entityId || '').trim(),
            workspaceId: event.workspaceId ? String(event.workspaceId) : undefined,
            timestamp: String(event.timestamp || new Date().toISOString()),
            metadata: event.metadata && typeof event.metadata === 'object' ? event.metadata : undefined,
          }))
          .filter((event) => Boolean(event.id && event.action && event.entity && event.entityId))
      : [];

    return {
      assignments,
      activityFeed,
      auditTrail,
    };
  };

  const normalizeFinance = (finance: Partial<FinanceStore> | undefined): FinanceStore => {
    const ledger = Object.fromEntries(
      Object.entries(finance?.ledger ?? {}).map(([key, entry]) => {
        const type = entry.type === 'expense' ? 'expense' : 'income';
        const status = String(entry.status || (type === 'income' ? 'pending' : 'pending')).toLowerCase();

        const normalizedStatus: FinanceLedgerStatus = type === 'income'
          ? (status === 'paid' || status === 'failed' || status === 'refunded' || status === 'pending' ? status : 'pending')
          : (status === 'approved' || status === 'paid' || status === 'cancelled' || status === 'pending' ? status : 'pending');

        return [
          key,
          {
            id: String(entry.id || key),
            type,
            category: String(entry.category || '').trim(),
            subcategory: String(entry.subcategory || '').trim(),
            amount: Math.max(0, Number(entry.amount || 0)),
            currency: String(entry.currency || 'USD').trim().toUpperCase(),
            description: String(entry.description || '').trim(),
            reference: String(entry.reference || '').trim(),
            source: String(entry.source || '').trim(),
            sourceId: String(entry.sourceId || '').trim(),
            workspaceId: entry.workspaceId ? String(entry.workspaceId).trim() : undefined,
            clientId: entry.clientId ? String(entry.clientId).trim() : undefined,
            status: normalizedStatus,
            createdBy: String(entry.createdBy || 'system').trim(),
            createdAt: String(entry.createdAt || new Date().toISOString()),
            transactionDate: String(entry.transactionDate || entry.createdAt || new Date().toISOString()),
            vendor: entry.vendor ? String(entry.vendor).trim() : undefined,
            paymentMethod: entry.paymentMethod ? String(entry.paymentMethod).trim() : undefined,
            receipt: entry.receipt ? String(entry.receipt).trim() : undefined,
            notes: entry.notes ? String(entry.notes).trim() : undefined,
            incurredDate: entry.incurredDate ? String(entry.incurredDate).trim() : undefined,
          } as FinanceLedgerEntry,
        ];
      }),
    ) as FinanceStore['ledger'];

    return {
      ledger,
      categories: {
        income: Array.isArray(finance?.categories?.income)
          ? finance.categories.income.map((item) => String(item).trim()).filter(Boolean)
          : DEFAULT_STORE.cloud.finance.categories.income,
        expense: Array.isArray(finance?.categories?.expense)
          ? finance.categories.expense.map((item) => String(item).trim()).filter(Boolean)
          : DEFAULT_STORE.cloud.finance.categories.expense,
      },
      counters: {
        nextLedgerSequence: Number.isFinite(Number(finance?.counters?.nextLedgerSequence))
          ? Math.max(1, Number(finance?.counters?.nextLedgerSequence))
          : DEFAULT_STORE.cloud.finance.counters.nextLedgerSequence,
      },
    };
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
      loginOtpChallenges: parsed.nativeAuth?.loginOtpChallenges ?? {},
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
        supportPortalUrl: (() => {
          const configured = String(parsed.platformSettings?.email?.supportPortalUrl || '').trim();
          if (!configured) return DEFAULT_STORE.platformSettings.email.supportPortalUrl;
          if (configured === '/master/support') return '/os/support';
          return configured;
        })(),
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
      sessionSecurity: {
        ...DEFAULT_STORE.platformSettings.sessionSecurity,
        ...(parsed.platformSettings?.sessionSecurity ?? {}),
        inactivityEnabled: typeof parsed.platformSettings?.sessionSecurity?.inactivityEnabled === 'boolean'
          ? parsed.platformSettings.sessionSecurity.inactivityEnabled
          : DEFAULT_STORE.platformSettings.sessionSecurity.inactivityEnabled,
        idleTimeoutMinutes: Number.isFinite(Number(parsed.platformSettings?.sessionSecurity?.idleTimeoutMinutes))
          ? Math.min(240, Math.max(5, Number(parsed.platformSettings?.sessionSecurity?.idleTimeoutMinutes)))
          : DEFAULT_STORE.platformSettings.sessionSecurity.idleTimeoutMinutes,
        idleWarningMinutes: Number.isFinite(Number(parsed.platformSettings?.sessionSecurity?.idleWarningMinutes))
          ? Math.min(30, Math.max(1, Number(parsed.platformSettings?.sessionSecurity?.idleWarningMinutes)))
          : DEFAULT_STORE.platformSettings.sessionSecurity.idleWarningMinutes,
        enforceSingleSession: typeof parsed.platformSettings?.sessionSecurity?.enforceSingleSession === 'boolean'
          ? parsed.platformSettings.sessionSecurity.enforceSingleSession
          : DEFAULT_STORE.platformSettings.sessionSecurity.enforceSingleSession,
      },
      loginProtection: {
        ...DEFAULT_STORE.platformSettings.loginProtection,
        ...(parsed.platformSettings?.loginProtection ?? {}),
        enabled: typeof parsed.platformSettings?.loginProtection?.enabled === 'boolean'
          ? parsed.platformSettings.loginProtection.enabled
          : DEFAULT_STORE.platformSettings.loginProtection.enabled,
        maxFailedAttempts: Number.isFinite(Number(parsed.platformSettings?.loginProtection?.maxFailedAttempts))
          ? Math.min(20, Math.max(3, Number(parsed.platformSettings?.loginProtection?.maxFailedAttempts)))
          : DEFAULT_STORE.platformSettings.loginProtection.maxFailedAttempts,
        windowMinutes: Number.isFinite(Number(parsed.platformSettings?.loginProtection?.windowMinutes))
          ? Math.min(60, Math.max(1, Number(parsed.platformSettings?.loginProtection?.windowMinutes)))
          : DEFAULT_STORE.platformSettings.loginProtection.windowMinutes,
        lockoutMinutes: Number.isFinite(Number(parsed.platformSettings?.loginProtection?.lockoutMinutes))
          ? Math.min(240, Math.max(1, Number(parsed.platformSettings?.loginProtection?.lockoutMinutes)))
          : DEFAULT_STORE.platformSettings.loginProtection.lockoutMinutes,
        requireOtpChallenge: typeof parsed.platformSettings?.loginProtection?.requireOtpChallenge === 'boolean'
          ? parsed.platformSettings.loginProtection.requireOtpChallenge
          : DEFAULT_STORE.platformSettings.loginProtection.requireOtpChallenge,
        otpCodeTtlMinutes: Number.isFinite(Number(parsed.platformSettings?.loginProtection?.otpCodeTtlMinutes))
          ? Math.min(30, Math.max(2, Number(parsed.platformSettings?.loginProtection?.otpCodeTtlMinutes)))
          : DEFAULT_STORE.platformSettings.loginProtection.otpCodeTtlMinutes,
      },
    },
    tracking: { ...DEFAULT_STORE.tracking, ...(parsed.tracking ?? {}) },
    smtp: { ...DEFAULT_STORE.smtp, ...(parsed.smtp ?? {}) },
    forms: Array.isArray(parsed.forms) ? parsed.forms : DEFAULT_STORE.forms,
    roleModuleVisibility: {
      ...DEFAULT_STORE.roleModuleVisibility,
      ...(parsed.roleModuleVisibility ?? {}),
    },
    controlCenterRoleVisibility: Object.fromEntries(
      Object.entries(DEFAULT_STORE.controlCenterRoleVisibility).map(([role, defaults]) => [
        role,
        {
          ...defaults,
          ...(parsed.controlCenterRoleVisibility?.[role] ?? {}),
        },
      ]),
    ) as ControlCenterRoleModuleVisibility,
    controlCenterRoleActionPermissions: Object.fromEntries(
      Object.entries(DEFAULT_STORE.controlCenterRoleActionPermissions).map(([role, moduleDefaults]) => [
        role,
        Object.fromEntries(
          CONTROL_CENTER_MODULE_KEYS.map((moduleKey) => {
            const storedActions = parsed.controlCenterRoleActionPermissions?.[role]?.[moduleKey];
            const storedVisibility = parsed.controlCenterRoleVisibility?.[role]?.[moduleKey];

            if (storedActions && typeof storedActions === 'object') {
              return [
                moduleKey,
                {
                  ...moduleDefaults[moduleKey],
                  ...storedActions,
                },
              ];
            }

            if (typeof storedVisibility === 'boolean') {
              return [
                moduleKey,
                storedVisibility ? { ...moduleDefaults[moduleKey] } : { ...NO_ACTION_ACCESS },
              ];
            }

            return [moduleKey, { ...moduleDefaults[moduleKey] }];
          }),
        ),
      ]),
    ) as ControlCenterRoleActionPermissions,
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
      operations: normalizeOperations((parsed.cloud as Partial<CloudOrchestrationStore> | undefined)?.operations),
      ticketing: normalizeTicketing((parsed.cloud as Partial<CloudOrchestrationStore> | undefined)?.ticketing),
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
        invoices: normalizeCommercialInvoices((parsed.cloud as Partial<CloudOrchestrationStore> | undefined)?.commercial?.invoices),
        billingCycleChangeRequests: normalizeBillingCycleChangeRequests((parsed.cloud as Partial<CloudOrchestrationStore> | undefined)?.commercial?.billingCycleChangeRequests),
      },
      finance: normalizeFinance((parsed.cloud as Partial<CloudOrchestrationStore> | undefined)?.finance),
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

function createSupportChatPin(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function ensureWorkspaceSupportChatPin(workspaceId: string): Promise<string | null> {
  let resolvedPin: string | null = null;

  await updateAdminStore((current) => {
    const workspace = current.cloud.workspaces[workspaceId];
    if (!workspace) return current;

    if (workspace.supportChatPin) {
      resolvedPin = workspace.supportChatPin;
      return current;
    }

    const now = new Date().toISOString();
    const generated = createSupportChatPin();
    resolvedPin = generated;

    return {
      ...current,
      cloud: {
        ...current.cloud,
        workspaces: {
          ...current.cloud.workspaces,
          [workspaceId]: {
            ...workspace,
            supportChatPin: generated,
            supportChatPinUpdatedAt: now,
            updatedAt: now,
          },
        },
      },
    };
  });

  return resolvedPin;
}

export async function getWorkspaceSupportChatPin(workspaceId: string): Promise<string | null> {
  const store = await readAdminStore();
  const workspace = store.cloud.workspaces[workspaceId];
  if (!workspace) return null;
  return workspace.supportChatPin || null;
}

export async function verifyWorkspaceSupportChatPin(workspaceId: string, submittedPin: string): Promise<boolean> {
  const expected = await ensureWorkspaceSupportChatPin(workspaceId);
  if (!expected) return false;
  return String(submittedPin || '').trim() === expected;
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
