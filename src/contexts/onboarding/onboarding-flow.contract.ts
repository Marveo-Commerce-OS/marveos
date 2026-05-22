import type {
  CustomHeadlessDataContract,
  ExistingWebsiteDataContract,
  MvpOnboardingRecord,
  NewWebsiteDataContract,
  OnboardingStepKey,
  WebsiteTypeKey,
} from './types';

export interface OnboardingFlowContract {
  stepSequence: OnboardingStepKey[];
  websiteType: WebsiteTypeKey;
  record: MvpOnboardingRecord;
  websiteSetup:
    | {
        websiteType: 'NEW_WEBSITE';
        data: NewWebsiteDataContract;
      }
    | {
        websiteType: 'EXISTING_WEBSITE';
        data: ExistingWebsiteDataContract;
      }
    | {
        websiteType: 'CUSTOM_HEADLESS';
        data: CustomHeadlessDataContract;
      };
}

export interface OnboardingFlowUpdateContract {
  workspaceId?: string;
  currentStep: OnboardingStepKey;
  completedSteps: OnboardingStepKey[];
  nextStep?: OnboardingStepKey;
  notes?: string;
}

export interface OnboardingFlowHandoffSummary {
  clientId: string;
  workspaceId?: string;
  websiteType: WebsiteTypeKey;
  completedSteps: OnboardingStepKey[];
  pendingSteps: OnboardingStepKey[];
  blockers: string[];
}
