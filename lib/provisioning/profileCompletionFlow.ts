import { readAdminStore, updateAdminStore } from '@/lib/adminStore';
import { provisionWorkspace } from './index';
import { hasProfessionConfig, resolveProfessionConfig } from '@/config/professions';
import { createDashboardWidgets } from './createDashboardWidgets';
import { createDefaultRoles } from './createDefaultRoles';
import { createOnboardingChecklist } from './createOnboardingChecklist';

export interface ProfileCompletionInput {
  onboardingSessionId?: string;
  workspaceId?: string;
  professionKey?: string;
  workspaceName: string;
  onboardingAnswers?: Record<string, unknown>;
  allowProfessionOverride?: boolean;
}

function normalizeProfessionKey(value?: string): string | undefined {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized || undefined;
}

function extractWorkspaceProfessionKey(input: {
  businessProfile?: Record<string, unknown>;
  collectedBusinessData?: Record<string, unknown>;
}): string | undefined {
  const fromProfile = normalizeProfessionKey(String(input.businessProfile?.professionKey || ''));
  if (fromProfile) return fromProfile;

  const fromCollected = normalizeProfessionKey(String(input.collectedBusinessData?.professionKey || ''));
  return fromCollected;
}

export async function provisionAfterProfileCompletion(input: ProfileCompletionInput) {
  const store = await readAdminStore();
  const onboarding = input.onboardingSessionId
    ? store.cloud.commercial.onboardingSessions[input.onboardingSessionId]
    : undefined;

  const subscription = onboarding
    ? store.cloud.commercial.subscriptions[onboarding.subscriptionId]
    : undefined;

  if (input.onboardingSessionId && !onboarding) {
    return { ok: false as const, reason: 'onboarding session not found' };
  }

  if (onboarding && !subscription) {
    return { ok: false as const, reason: 'subscription not found' };
  }

  const licenseEntitled = subscription
    ? (subscription.status === 'TRIAL' || subscription.status === 'ACTIVE')
    : true;

  if (!licenseEntitled) {
    return { ok: false as const, reason: 'subscription not entitled for provisioning' };
  }

  const workspace = input.workspaceId ? store.cloud.workspaces[input.workspaceId] : undefined;
  const existingProfessionKey = workspace
    ? extractWorkspaceProfessionKey({
        businessProfile: (workspace.businessProfile || {}) as Record<string, unknown>,
        collectedBusinessData: (workspace.collectedBusinessData || {}) as Record<string, unknown>,
      })
    : undefined;

  const requestedProfessionKey = normalizeProfessionKey(input.professionKey);
  const requestedKnown = requestedProfessionKey ? hasProfessionConfig(requestedProfessionKey) : false;

  const effectiveProfessionKey = existingProfessionKey
    ? (requestedProfessionKey && requestedProfessionKey !== existingProfessionKey && input.allowProfessionOverride
        ? requestedProfessionKey
        : existingProfessionKey)
    : (requestedKnown ? requestedProfessionKey : undefined);

  const profession = resolveProfessionConfig(effectiveProfessionKey);

  const provisioned = input.workspaceId
    ? async () => {
        const dashboardWidgets = await createDashboardWidgets({ workspaceId: input.workspaceId || '', professionKey: profession.key });
        const defaultRoles = await createDefaultRoles({ workspaceId: input.workspaceId || '', professionKey: profession.key });
        const onboardingChecklist = await createOnboardingChecklist({ workspaceId: input.workspaceId || '', professionKey: profession.key });

        return {
        workspaceId: input.workspaceId,
        provisioningStatus: {
          workspaceId: input.workspaceId,
          currentStage: 'branding_pending',
          completedStages: ['license_checked', 'profile_completed', 'profession_selected', 'workspace_created', 'modules_activated'],
          updatedAt: new Date().toISOString(),
        },
        activatedModules: profession.enabledModules,
        dashboardWidgets,
        defaultRoles,
        onboardingChecklist,
      };
      }
    : async () => await provisionWorkspace({
        tenantId: onboarding?.organizationId || 'direct_workspace',
        workspaceName: input.workspaceName,
        professionKey: profession.key,
      });

  const provisionedData = await provisioned();

  if (input.workspaceId) {
    await updateAdminStore((current) => {
      const existing = current.cloud.workspaces[input.workspaceId || ''];
      if (!existing) return current;

      const existingCollected = (existing.collectedBusinessData || {}) as Record<string, unknown>;
      const existingAnswersByKey =
        existingCollected.professionOnboardingAnswersByKey
        && typeof existingCollected.professionOnboardingAnswersByKey === 'object'
        && !Array.isArray(existingCollected.professionOnboardingAnswersByKey)
          ? (existingCollected.professionOnboardingAnswersByKey as Record<string, unknown>)
          : {};

      const answersByKey = {
        ...existingAnswersByKey,
        ...(input.onboardingAnswers && Object.keys(input.onboardingAnswers).length > 0
          ? { [profession.key]: input.onboardingAnswers }
          : {}),
      };

      const nextCollected = {
        ...existingCollected,
        professionKey: profession.key,
        professionName: profession.professionName,
        professionSector: profession.sector,
        professionOnboardingAnswersByKey: answersByKey,
        dashboardWidgets: provisionedData.dashboardWidgets,
        defaultRoles: provisionedData.defaultRoles,
        onboardingChecklist: provisionedData.onboardingChecklist,
      };

      return {
        ...current,
        cloud: {
          ...current.cloud,
          workspaces: {
            ...current.cloud.workspaces,
            [input.workspaceId || '']: {
              ...existing,
              selectedModules: provisionedData.activatedModules,
              businessProfile: {
                ...(existing.businessProfile || {}),
                sector: profession.sector,
                profession: profession.professionName,
                professionKey: profession.key,
              },
              collectedBusinessData: nextCollected,
              updatedAt: new Date().toISOString(),
            },
          },
        },
      };
    });
  }

  return {
    ok: true as const,
    onboardingSessionId: onboarding?.id,
    subscriptionId: subscription?.id,
    licenseEntitled,
    profession: {
      key: profession.key,
      enabledModules: profession.enabledModules,
      dashboardWidgets: profession.dashboardWidgets,
      sidebarNavigation: profession.sidebarNavigation,
      onboardingQuestions: profession.onboardingQuestions,
      terminology: profession.terminology,
    },
    workspaceId: provisionedData.workspaceId,
    provisioningStatus: provisionedData.provisioningStatus,
    activatedModules: provisionedData.activatedModules,
    dashboardWidgets: provisionedData.dashboardWidgets,
    defaultRoles: provisionedData.defaultRoles,
    onboardingChecklist: provisionedData.onboardingChecklist,
  };
}
