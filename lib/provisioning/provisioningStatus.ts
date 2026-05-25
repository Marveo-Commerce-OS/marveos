import type { ProvisioningStage } from '@/types/provisioning';

export interface ProvisioningStatus {
  workspaceId: string;
  currentStage: ProvisioningStage;
  completedStages: ProvisioningStage[];
  updatedAt: string;
}

export function createProvisioningStatus(workspaceId: string): ProvisioningStatus {
  return {
    workspaceId,
    currentStage: 'license_checked',
    completedStages: [],
    updatedAt: new Date().toISOString(),
  };
}

export function advanceProvisioningStatus(
  current: ProvisioningStatus,
  nextStage: ProvisioningStage,
): ProvisioningStatus {
  const completed = new Set<ProvisioningStage>([...current.completedStages, current.currentStage]);
  return {
    ...current,
    currentStage: nextStage,
    completedStages: Array.from(completed),
    updatedAt: new Date().toISOString(),
  };
}
