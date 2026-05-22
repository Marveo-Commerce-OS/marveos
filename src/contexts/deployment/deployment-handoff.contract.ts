import type {
  CustomHeadlessDataContract,
  ExistingWebsiteDataContract,
  NewWebsiteDataContract,
  WebsiteTypeKey,
} from '@/src/contexts/onboarding/types';

export type CollectedBusinessData =
  | { websiteType: 'NEW_WEBSITE'; data: NewWebsiteDataContract }
  | { websiteType: 'EXISTING_WEBSITE'; data: ExistingWebsiteDataContract }
  | { websiteType: 'CUSTOM_HEADLESS'; data: CustomHeadlessDataContract };

export interface DeploymentHandoffContract {
  clientId: string;
  workspaceId: string;
  websiteType: WebsiteTypeKey;
  planId: string;
  domain: string;
  selectedTemplateId?: string;
  connectorId?: string;
  supportRequired: boolean;
  collectedBusinessData: CollectedBusinessData;
}
