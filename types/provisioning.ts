export const PROVISIONING_STAGES = [
  'license_checked',
  'profile_completed',
  'profession_selected',
  'workspace_created',
  'modules_activated',
  'branding_pending',
  'channels_pending',
  'website_pending',
  'ai_optional',
  'completed',
] as const;

export type ProvisioningStage = (typeof PROVISIONING_STAGES)[number];

export interface ProvisioningState {
  workspaceId: string;
  currentStage: ProvisioningStage;
  completedStages: ProvisioningStage[];
  updatedAt: string;
}
