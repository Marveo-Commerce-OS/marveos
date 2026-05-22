import type { OnboardingStatusKey, OnboardingStepKey } from './types';

export interface OnboardingStatusContract {
  status: OnboardingStatusKey;
  currentStep?: OnboardingStepKey;
  reason?: string;
  updatedAt: string;
}

export interface OnboardingStatusTransitionContract {
  from: OnboardingStatusKey;
  to: OnboardingStatusKey;
  allowed: boolean;
  reason?: string;
}

export interface LaunchChecklistItem {
  key: string;
  label: string;
  completed: boolean;
  required: boolean;
  notes?: string;
}

export interface LaunchChecklistContract {
  workspaceId: string;
  clientId: string;
  readyForLaunch: boolean;
  items: LaunchChecklistItem[];
  blockers: string[];
  generatedAt: string;
}
