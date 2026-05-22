import type { WebsiteTypeKey } from '@/src/contexts/onboarding/types';

export type SupportPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface SupportAssignmentContract {
  workspaceId: string;
  clientId: string;
  priority: SupportPriority;
  reason: string;
  setupType: WebsiteTypeKey;
  requiredSkills: string[];
  initialNotes: string;
}
