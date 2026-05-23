import type {
  ConnectorCommandRecord,
  AccountPlan,
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

function hashString(input: string): string {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}

function isInternalDemoEmail(email: string): boolean {
  // Disabled internal demo email check for full native platform hardening
  return false;
}

function normalizeAccountPlan(planId?: string): AccountPlan {
  if (planId === 'starter' || planId === 'business' || planId === 'enterprise') {
    return planId;
  }
  return 'starter';
}

export function deriveClientOwnershipContext(payload: {
  name: string;
  contentBaseUrl: string;
  businessProfile?: Record<string, unknown>;
  planId?: string;
  clientOrganizationId?: string;
  clientSubscriptionId?: string;
  workspaceOwnership?: 'client' | 'internal_demo';
  actorEmail?: string;
}) {
  const businessProfile = payload.businessProfile ?? {};
  const businessName = String(businessProfile.businessName ?? payload.name ?? '').trim();
  const contactEmail = String(businessProfile.contactEmail ?? '').trim().toLowerCase();
  const seed = contactEmail || businessName.toLowerCase() || payload.contentBaseUrl.toLowerCase();
  const internalDemo = Boolean(payload.workspaceOwnership === 'internal_demo' || isInternalDemoEmail(payload.actorEmail ?? ''));

  if (internalDemo) {
    return {
      clientOrganizationId: payload.clientOrganizationId || `demo_org_${makeId('tenant')}`,
      clientOrganizationName: businessName || payload.name || 'Demo Client Organization',
      clientSubscriptionId: payload.clientSubscriptionId || `demo_sub_${makeId('subscription')}`,
      clientSubscriptionPlan: normalizeAccountPlan(payload.planId),
      workspaceOwnership: 'internal_demo' as const,
    };
  }

  const organizationHash = hashString(seed);
  const subscriptionHash = hashString(`${seed}|${payload.planId || 'starter'}`);

  return {
    clientOrganizationId: payload.clientOrganizationId || `org_${organizationHash}`,
    clientOrganizationName: businessName || payload.name || 'Client Organization',
    clientSubscriptionId: payload.clientSubscriptionId || `sub_${subscriptionHash}`,
    clientSubscriptionPlan: normalizeAccountPlan(payload.planId),
    workspaceOwnership: 'client' as const,
  };
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
  contentSource: 'wordpress' | 'nextjs';
  contentBaseUrl: string;
  planId?: string;
  websiteType?: 'NEW_WEBSITE' | 'EXISTING_WEBSITE' | 'CUSTOM_HEADLESS';
  businessProfile?: Record<string, unknown>;
  selectedTemplateId?: string;
  supportRequired?: boolean;
  collectedBusinessData?: Record<string, unknown>;
  clientOrganizationId?: string;
  clientOrganizationName?: string;
  clientSubscriptionId?: string;
  clientSubscriptionPlan?: AccountPlan;
  workspaceOwnership?: 'client' | 'internal_demo';
  actorEmail?: string;
}): WorkspaceOrchestration {
  const now = NOW();
  const isExistingWebsite = payload.websiteType === 'EXISTING_WEBSITE';
  const ownership = deriveClientOwnershipContext(payload);
  const baselineMissingRequirements = isExistingWebsite
    ? [
        'Connector plugin installation not confirmed',
        'Site connection token not validated',
      ]
    : ['Website connection review pending'];

  return {
    id: makeId('ws'),
    name: payload.name,
    clientOrganizationId: ownership.clientOrganizationId,
    clientOrganizationName: ownership.clientOrganizationName,
    clientSubscriptionId: ownership.clientSubscriptionId,
    clientSubscriptionPlan: ownership.clientSubscriptionPlan,
    workspaceOwnership: ownership.workspaceOwnership,
    businessType: payload.businessType,
    country: payload.country,
    businessModel: payload.businessModel,
    contentSource: payload.contentSource,
    contentBaseUrl: payload.contentBaseUrl,
    planId: payload.planId,
    websiteType: payload.websiteType,
    onboardingStepKey: 'PLAN_SELECTED',
    onboardingStatus: 'IN_PROGRESS',
    businessProfile: payload.businessProfile,
    selectedTemplateId: payload.selectedTemplateId,
    collectedBusinessData: payload.collectedBusinessData,
    supportRequired: payload.supportRequired,
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
      ...baselineMissingRequirements,
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
  const isExistingWebsite = workspace.websiteType === 'EXISTING_WEBSITE';
  const onboardingComplete = workspace.onboardingSteps.every((item) => item.status === 'completed');
  const architectureValidated = Boolean(workspace.architecture);
  const modulesValid = workspace.selectedModules.length > 0;
  const apisReachable = isExistingWebsite ? Boolean(connectorDeploymentStatus) : true;
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
  if (isExistingWebsite && !apisReachable) {
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
