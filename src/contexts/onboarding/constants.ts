import type { OnboardingStepKey, OnboardingStatusKey, WebsiteTypeKey } from './types';

export const MVP_ONBOARDING_STEP_SEQUENCE: OnboardingStepKey[] = [
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
];

export const WEBSITE_TYPE_OPTIONS: Array<{ key: WebsiteTypeKey; label: string }> = [
  { key: 'NEW_WEBSITE', label: 'New Website' },
  { key: 'EXISTING_WEBSITE', label: 'Existing Website' },
  { key: 'CUSTOM_HEADLESS', label: 'Custom Headless' },
];

export const ONBOARDING_STATUS_OPTIONS: Array<{ key: OnboardingStatusKey; label: string }> = [
  { key: 'NOT_STARTED', label: 'Not Started' },
  { key: 'IN_PROGRESS', label: 'In Progress' },
  { key: 'WAITING_FOR_CLIENT', label: 'Waiting for Client' },
  { key: 'WAITING_FOR_SUPPORT', label: 'Waiting for Support' },
  { key: 'DEPLOYING', label: 'Deploying' },
  { key: 'READY_FOR_REVIEW', label: 'Ready for Review' },
  { key: 'READY_FOR_LAUNCH', label: 'Ready for Launch' },
  { key: 'LIVE', label: 'Live' },
  { key: 'FAILED', label: 'Failed' },
];
