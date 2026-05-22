export const ONBOARDING_STEP_KEYS = [
  'PLAN_SELECTED',
  'PROFILE_CREATED',
  'WEBSITE_TYPE_SELECTED',
  'BUSINESS_DETAILS_COMPLETED',
  'CONNECTOR_TOKEN_GENERATED',
  'TEMPLATE_SELECTED',
  'DEPLOYMENT_STARTED',
  'WORKSPACE_CREATED',
  'SUPPORT_ASSIGNED',
  'LAUNCH_CHECKLIST_READY',
] as const;

export type OnboardingStepKey = (typeof ONBOARDING_STEP_KEYS)[number];

export const WEBSITE_TYPE_KEYS = [
  'NEW_WEBSITE',
  'EXISTING_WEBSITE',
  'CUSTOM_HEADLESS',
] as const;

export type WebsiteTypeKey = (typeof WEBSITE_TYPE_KEYS)[number];

export const ONBOARDING_STATUS_KEYS = [
  'NOT_STARTED',
  'IN_PROGRESS',
  'WAITING_FOR_CLIENT',
  'WAITING_FOR_SUPPORT',
  'DEPLOYING',
  'READY_FOR_REVIEW',
  'READY_FOR_LAUNCH',
  'LIVE',
  'FAILED',
] as const;

export type OnboardingStatusKey = (typeof ONBOARDING_STATUS_KEYS)[number];

export interface BrandColors {
  primary: string;
  secondary: string;
  accent?: string;
}

export interface ContactInfo {
  email: string;
  phone?: string;
  whatsapp?: string;
  address?: string;
}

export interface SocialLink {
  platform: string;
  url: string;
}

export interface NewWebsiteDataContract {
  businessName: string;
  businessType: string;
  domain: string;
  frontendDomain: string;
  backendCmsSubdomain: string;
  domainStrategy: 'HEADLESS_WORDPRESS';
  logo: string;
  brandColors: BrandColors;
  pagesNeeded: string[];
  contactInfo: ContactInfo;
  socialLinks: SocialLink[];
  selectedTemplateId: string;
}

export interface ExistingWebsiteDataContract {
  domain: string;
  wordpressAdminUrl: string;
  currentPlatform: string;
  connectionMethod: string;
  connectorToken: string;
  manualAccessRequired: boolean;
  supportRequired: boolean;
}

export interface CustomHeadlessDataContract {
  stack: string;
  apiDetails: string;
  developerContact: string;
  integrationNotes: string;
  supportRequired: boolean;
}

export interface OnboardingStepProgress {
  step: OnboardingStepKey;
  completed: boolean;
  completedAt?: string;
  notes?: string;
}

export interface MvpOnboardingRecord {
  clientId: string;
  workspaceId?: string;
  planId?: string;
  websiteType?: WebsiteTypeKey;
  status: OnboardingStatusKey;
  steps: OnboardingStepProgress[];
  createdAt: string;
  updatedAt: string;
}
