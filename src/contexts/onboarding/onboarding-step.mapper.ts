import type { OnboardingStepKey } from './types';

export const LEGACY_TO_MVP_STEP_MAP: Record<number, OnboardingStepKey> = {
  1: 'PLAN_SELECTED',
  2: 'CONNECTOR_TOKEN_GENERATED',
  3: 'WEBSITE_TYPE_SELECTED',
  4: 'BUSINESS_DETAILS_COMPLETED',
  5: 'PROFILE_CREATED',
  6: 'TEMPLATE_SELECTED',
  7: 'DEPLOYMENT_STARTED',
  8: 'WORKSPACE_CREATED',
  9: 'SUPPORT_ASSIGNED',
  10: 'LAUNCH_CHECKLIST_READY',
  11: 'LAUNCH_CHECKLIST_READY',
};

const MVP_TO_LEGACY_STEP_MAP: Partial<Record<OnboardingStepKey, number>> = {
  PLAN_SELECTED: 1,
  CONNECTOR_TOKEN_GENERATED: 2,
  WEBSITE_TYPE_SELECTED: 3,
  BUSINESS_DETAILS_COMPLETED: 4,
  PROFILE_CREATED: 5,
  TEMPLATE_SELECTED: 6,
  DEPLOYMENT_STARTED: 7,
  WORKSPACE_CREATED: 8,
  SUPPORT_ASSIGNED: 9,
  LAUNCH_CHECKLIST_READY: 11,
};

export function mapLegacyStepToMvpStepKey(step: number): OnboardingStepKey | null {
  if (!Number.isFinite(step)) return null;
  const mapped = LEGACY_TO_MVP_STEP_MAP[step];
  return mapped ?? null;
}

export function mapMvpStepKeyToLegacyStep(stepKey: OnboardingStepKey): number | null {
  return MVP_TO_LEGACY_STEP_MAP[stepKey] ?? null;
}

export function resolveCompatibleStep(input: {
  step?: number;
  onboardingStepKey?: string;
}): { step: number | null; onboardingStepKey: OnboardingStepKey | null } {
  const legacyStep = Number.isFinite(input.step) ? Number(input.step) : NaN;

  if (Number.isFinite(legacyStep) && legacyStep >= 1 && legacyStep <= 11) {
    return {
      step: legacyStep,
      onboardingStepKey: mapLegacyStepToMvpStepKey(legacyStep),
    };
  }

  if (typeof input.onboardingStepKey === 'string' && input.onboardingStepKey.length > 0) {
    const key = input.onboardingStepKey as OnboardingStepKey;
    const mappedStep = mapMvpStepKeyToLegacyStep(key);
    return {
      step: mappedStep,
      onboardingStepKey: mappedStep ? key : null,
    };
  }

  return { step: null, onboardingStepKey: null };
}
