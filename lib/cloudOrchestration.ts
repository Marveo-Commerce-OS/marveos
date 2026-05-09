import type {
  ConnectorCommandRecord,
  OnboardingStepState,
  WorkspaceOrchestration,
  VersionedSchema,
  PageSchemaData,
  ComponentSchemaData,
} from '@/lib/adminStore';

export const ONBOARDING_STEP_KEYS = [
  'create_workspace',
  'install_connector_plugin',
  'connect_site',
  'site_detection',
  'onboarding_path',
  'architecture_selection',
  'module_selection',
  'brand_setup',
  'structure_generation',
  'validation',
  'launch',
] as const;

export type OnboardingStepKey = (typeof ONBOARDING_STEP_KEYS)[number];

const NOW = () => new Date().toISOString();

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createDefaultOnboardingSteps(): OnboardingStepState[] {
  return ONBOARDING_STEP_KEYS.map((key, index) => ({
    step: index + 1,
    key,
    status: 'pending',
    retryCount: 0,
    maxRetries: 3,
    recoveryActions: [
      'Retry from the same step',
      'Rollback to previous stable step',
      'Review diagnostics and apply required configuration updates',
    ],
  }));
}

export function createWorkspace(payload: {
  name: string;
  businessType: string;
  country: string;
  businessModel: string;
}): WorkspaceOrchestration {
  const now = NOW();
  return {
    id: makeId('ws'),
    name: payload.name,
    businessType: payload.businessType,
    country: payload.country,
    businessModel: payload.businessModel,
    selectedModules: [],
    brandSetup: {},
    onboardingSteps: createDefaultOnboardingSteps(),
    currentStep: 1,
    status: 'onboarding',
    deploymentReadiness: {
      onboardingComplete: false,
      architectureValidated: false,
      apisReachable: false,
      modulesValid: false,
      frontendValidated: false,
      contentMapped: false,
      integrationsConfigured: false,
    },
    missingRequirements: [
      'Connector plugin installation not confirmed',
      'Site connection token not validated',
      'Architecture selection incomplete',
      'Modules and brand setup incomplete',
      'Validation and launch steps pending',
    ],
    recoverySuggestions: [
      'Resume onboarding from current step',
      'Run diagnostics and retry failed step',
    ],
    rollout: {
      pageSchemaVersion: 0,
      componentSchemaVersion: 0,
      channel: 'stable',
    },
    createdAt: now,
    updatedAt: now,
  };
}

export function updateStepStatus(
  workspace: WorkspaceOrchestration,
  step: number,
  action: 'start' | 'complete' | 'fail' | 'retry' | 'rollback',
  error?: string,
): WorkspaceOrchestration {
  const now = NOW();
  const nextSteps = workspace.onboardingSteps.map((item) => {
    if (item.step !== step) {
      return item;
    }

    if (action === 'start') {
      return { ...item, status: 'in_progress', startedAt: item.startedAt || now, lastError: undefined };
    }

    if (action === 'complete') {
      return { ...item, status: 'completed', completedAt: now, lastError: undefined };
    }

    if (action === 'fail') {
      return { ...item, status: 'failed', lastError: error || 'Step failed' };
    }

    if (action === 'retry') {
      const retryCount = item.retryCount + 1;
      return {
        ...item,
        status: retryCount > item.maxRetries ? 'failed' : 'in_progress',
        retryCount,
        startedAt: now,
        lastError: retryCount > item.maxRetries ? 'Retry limit exceeded' : undefined,
      };
    }

    return { ...item, status: 'rolled_back', lastError: error || 'Rolled back by operator' };
  });

  const allCompleted = nextSteps.every((item) => item.status === 'completed');
  const hasFailed = nextSteps.some((item) => item.status === 'failed');

  return {
    ...workspace,
    onboardingSteps: nextSteps as import('@/lib/adminStore').OnboardingStepState[],
    currentStep: allCompleted ? 11 : Math.min(11, Math.max(1, step + (action === 'complete' ? 1 : 0))),
    status: allCompleted ? 'ready_for_launch' : hasFailed ? 'blocked' : 'onboarding',
    updatedAt: now,
  };
}

export function validateWorkspaceReadiness(
  workspace: WorkspaceOrchestration,
  connectorDeploymentStatus?: {
    setup_completed?: boolean;
    validation_passed?: boolean;
    missing_requirements?: string[];
    validation_states?: Record<string, boolean>;
  },
): WorkspaceOrchestration {
  const onboardingComplete = workspace.onboardingSteps.every((item) => item.status === 'completed');
  const architectureValidated = Boolean(workspace.architecture);
  const modulesValid = workspace.selectedModules.length > 0;
  const apisReachable = Boolean(connectorDeploymentStatus);
  const frontendValidated = Boolean(connectorDeploymentStatus?.validation_passed);
  const contentMapped = Boolean(connectorDeploymentStatus?.setup_completed);
  const integrationsConfigured = workspace.onboardingSteps.find((item) => item.key === 'validation')?.status === 'completed';

  const missingRequirements: string[] = [];

  if (!onboardingComplete) {
    missingRequirements.push('Onboarding steps are incomplete');
  }
  if (!architectureValidated) {
    missingRequirements.push('Architecture is not selected');
  }
  if (!apisReachable) {
    missingRequirements.push('Connector deployment status is not reachable');
  }
  if (!modulesValid) {
    missingRequirements.push('At least one module must be selected');
  }
  if (!frontendValidated) {
    missingRequirements.push('Frontend validation has not passed');
  }
  if (!contentMapped) {
    missingRequirements.push('Content mapping is incomplete');
  }
  if (!integrationsConfigured) {
    missingRequirements.push('Validation and integration checks are incomplete');
  }

  return {
    ...workspace,
    deploymentReadiness: {
      onboardingComplete,
      architectureValidated,
      apisReachable,
      modulesValid,
      frontendValidated,
      contentMapped,
      integrationsConfigured: Boolean(integrationsConfigured),
    },
    missingRequirements,
    recoverySuggestions: missingRequirements.map(
      (item) => `Resolve: ${item}. Then retry validation from launch guard endpoint.`,
    ),
    status: missingRequirements.length === 0 ? 'ready_for_launch' : workspace.status,
    updatedAt: NOW(),
  };
}

export function appendCommand(
  workspaceId: string,
  type: ConnectorCommandRecord['type'],
  payload: Record<string, unknown>,
  auditId: string,
): ConnectorCommandRecord {
  const now = NOW();
  return {
    id: makeId('cmd'),
    workspaceId,
    type,
    payload,
    auditId,
    status: 'queued',
    createdAt: now,
    updatedAt: now,
    attempts: 0,
  };
}

export function upsertSchemaVersion<T extends PageSchemaData | ComponentSchemaData>(
  existing: VersionedSchema<T>[],
  data: T,
  activate = false,
): VersionedSchema<T>[] {
  const now = NOW();
  const nextVersion = (existing[existing.length - 1]?.version || 0) + 1;

  const next: VersionedSchema<T> = {
    version: nextVersion,
    status: activate ? 'active' : 'draft',
    createdAt: now,
    updatedAt: now,
    data,
  };

  const archived = activate
    ? existing.map((item) => ({ ...item, status: item.status === 'active' ? 'archived' : item.status }))
    : existing;

  return [...archived, next];
}
