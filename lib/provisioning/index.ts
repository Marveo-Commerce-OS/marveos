import { applyProfessionConfig } from './applyProfessionConfig';
import { activateModules } from './activateModules';
import { createDefaultRoles } from './createDefaultRoles';
import { createOnboardingChecklist } from './createOnboardingChecklist';
import { createDashboardWidgets } from './createDashboardWidgets';
import { createWorkspace } from './createWorkspace';
import { advanceProvisioningStatus, createProvisioningStatus, type ProvisioningStatus } from './provisioningStatus';

export interface ProvisionWorkspaceInput {
  tenantId: string;
  workspaceName: string;
  professionKey: string;
}

export interface ProvisionWorkspaceResult {
  workspaceId: string;
  provisioningStatus: ProvisioningStatus;
  activatedModules: string[];
  dashboardWidgets: string[];
  defaultRoles: string[];
  onboardingChecklist: Array<{ key: string; label: string; done: boolean }>;
}

export async function provisionWorkspace(input: ProvisionWorkspaceInput): Promise<ProvisionWorkspaceResult> {
  const created = await createWorkspace({
    tenantId: input.tenantId,
    workspaceName: input.workspaceName,
    professionKey: input.professionKey,
  });

  let status = createProvisioningStatus(created.workspaceId);
  status = advanceProvisioningStatus(status, 'profile_completed');

  const profession = await applyProfessionConfig({
    workspaceId: created.workspaceId,
    professionKey: input.professionKey,
  });
  status = advanceProvisioningStatus(status, 'profession_selected');

  status = advanceProvisioningStatus(status, 'workspace_created');

  const activatedModules = await activateModules({
    workspaceId: created.workspaceId,
    modules: profession.enabledModules,
  });
  status = advanceProvisioningStatus(status, 'modules_activated');

  const dashboardWidgets = await createDashboardWidgets({ workspaceId: created.workspaceId, professionKey: input.professionKey });
  const defaultRoles = await createDefaultRoles({ workspaceId: created.workspaceId, professionKey: input.professionKey });
  const onboardingChecklist = await createOnboardingChecklist({ workspaceId: created.workspaceId, professionKey: input.professionKey });

  status = advanceProvisioningStatus(status, 'branding_pending');

  return {
    workspaceId: created.workspaceId,
    provisioningStatus: status,
    activatedModules,
    dashboardWidgets,
    defaultRoles,
    onboardingChecklist,
  };
}

export * from './createWorkspace';
export * from './applyProfessionConfig';
export * from './activateModules';
export * from './createDefaultRoles';
export * from './createOnboardingChecklist';
export * from './createDashboardWidgets';
export * from './provisioningStatus';
export * from './profileCompletionFlow';
