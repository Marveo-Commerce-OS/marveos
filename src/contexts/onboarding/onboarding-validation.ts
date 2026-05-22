import type {
  CustomHeadlessDataContract,
  ExistingWebsiteDataContract,
  NewWebsiteDataContract,
  WebsiteTypeKey,
} from './types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

export function validateNewWebsitePayload(data: unknown): ValidationResult {
  const errors: string[] = [];
  const payload = data as Partial<NewWebsiteDataContract>;

  if (!isNonEmptyString(payload?.businessName)) errors.push('businessName is required');
  if (!isNonEmptyString(payload?.businessType)) errors.push('businessType is required');
  if (!isNonEmptyString(payload?.domain)) errors.push('domain is required');
  if (!isNonEmptyString(payload?.frontendDomain)) errors.push('frontendDomain is required');
  if (!isNonEmptyString(payload?.backendCmsSubdomain)) errors.push('backendCmsSubdomain is required');
  if (payload?.domainStrategy !== 'HEADLESS_WORDPRESS') errors.push('domainStrategy must be HEADLESS_WORDPRESS');
  if (!isNonEmptyString(payload?.logo)) errors.push('logo is required');
  if (!payload?.brandColors || !isNonEmptyString(payload.brandColors.primary) || !isNonEmptyString(payload.brandColors.secondary)) {
    errors.push('brandColors.primary and brandColors.secondary are required');
  }
  if (!isStringArray(payload?.pagesNeeded)) errors.push('pagesNeeded must be an array of strings');
  if (!payload?.contactInfo || !isNonEmptyString(payload.contactInfo.email)) {
    errors.push('contactInfo.email is required');
  }
  if (!Array.isArray(payload?.socialLinks)) errors.push('socialLinks must be an array');
  if (!isNonEmptyString(payload?.selectedTemplateId)) errors.push('selectedTemplateId is required');

  return { valid: errors.length === 0, errors };
}

export function validateExistingWebsitePayload(data: unknown): ValidationResult {
  const errors: string[] = [];
  const payload = data as Partial<ExistingWebsiteDataContract>;
  const connectionMethod = String(payload?.connectionMethod || '').trim().toLowerCase();

  if (!isNonEmptyString(payload?.domain)) errors.push('domain is required');
  if (!isNonEmptyString(payload?.wordpressAdminUrl)) errors.push('wordpressAdminUrl is required');
  if (!isNonEmptyString(payload?.currentPlatform)) errors.push('currentPlatform is required');
  if (!isNonEmptyString(payload?.connectionMethod)) errors.push('connectionMethod is required');
  if (connectionMethod === 'connector' && !isNonEmptyString(payload?.connectorToken)) {
    errors.push('connectorToken is required when connectionMethod is connector');
  }
  if (!isBoolean(payload?.manualAccessRequired)) errors.push('manualAccessRequired must be boolean');
  if (!isBoolean(payload?.supportRequired)) errors.push('supportRequired must be boolean');

  return { valid: errors.length === 0, errors };
}

export function validateCustomHeadlessPayload(data: unknown): ValidationResult {
  const errors: string[] = [];
  const payload = data as Partial<CustomHeadlessDataContract>;

  if (!isNonEmptyString(payload?.stack)) errors.push('stack is required');
  if (!isNonEmptyString(payload?.apiDetails)) errors.push('apiDetails is required');
  if (!isNonEmptyString(payload?.developerContact)) errors.push('developerContact is required');
  if (!isNonEmptyString(payload?.integrationNotes)) errors.push('integrationNotes is required');
  if (!isBoolean(payload?.supportRequired)) errors.push('supportRequired must be boolean');

  return { valid: errors.length === 0, errors };
}

export function validateCollectedBusinessData(
  websiteType: WebsiteTypeKey | undefined,
  data: unknown,
): ValidationResult {
  if (!websiteType || !data || typeof data !== 'object') {
    return { valid: true, errors: [] };
  }

  if (websiteType === 'NEW_WEBSITE') return validateNewWebsitePayload(data);
  if (websiteType === 'EXISTING_WEBSITE') return validateExistingWebsitePayload(data);
  return validateCustomHeadlessPayload(data);
}
