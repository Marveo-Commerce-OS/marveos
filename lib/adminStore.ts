import { promises as fs } from 'node:fs';
import path from 'node:path';
import { cookies } from 'next/headers';
import { getWordPressApiBase } from '@/src/lib/endpoints';
import type { MaintenanceSettings } from '@/lib/types';

export type PortalAccess = 'b2c' | 'b2b';

export interface ManagedUserState {
  active: boolean;
  portals: PortalAccess[];
}

export interface TrackingConfig {
  ecommerceDomain: string;
  googleAnalyticsId: string;
  googleTagManagerId: string;
  googleSearchConsoleVerification: string;
  metaPixelId: string;
  tiktokPixelId: string;
  whatsappChatEnabled: boolean;
  whatsappChatNumber: string;
  whatsappChatText: string;
  customHeadScripts: string;
  customBodyScripts: string;
  customFooterScripts: string;
}

export interface SmtpConfig {
  provider: 'microsoft365';
  useWordPressMailer: boolean;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  fromEmail: string;
  fromName: string;
}

export interface FormRoutingRule {
  formKey: string;
  formName: string;
  fromEmail: string;
  senderName: string;
  recipients: string[];
}

export interface AuditRecord {
  id: string;
  at: string;
  actorEmail: string;
  action: string;
  target: string;
  details?: string;
}

export type OnboardingStepStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'rolled_back';

export interface OnboardingStepState {
  step: number;
  key: string;
  status: OnboardingStepStatus;
  retryCount: number;
  maxRetries: number;
  startedAt?: string;
  completedAt?: string;
  lastError?: string;
  recoveryActions: string[];
}

export interface VersionedSchema<T> {
  version: number;
  status: 'draft' | 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
  data: T;
}

export interface PageSchemaData {
  pages: Array<{
    id: string;
    title: string;
    slug: string;
    page_type: string;
    source: string;
    seo: Record<string, unknown>;
    components: Array<{ key: string; props?: Record<string, unknown> }>;
    navigation_visibility: boolean;
    frontend_visibility: boolean;
    template: string;
    status: string;
  }>;
}

export interface ComponentSchemaData {
  components: Array<{
    key: string;
    name: string;
    category: string;
    fields: string[];
    allowed_page_types: string[];
    data_source: string;
    visibility: string;
  }>;
}

export interface ConnectorCommandRecord {
  id: string;
  workspaceId: string;
  auditId: string;
  type: 'content_mapping_sync' | 'module_activation';
  payload: Record<string, unknown>;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'rolled_back';
  createdAt: string;
  updatedAt: string;
  attempts: number;
  lastError?: string;
}

export interface WorkspaceOrchestration {
  id: string;
  name: string;
  businessType: string;
  country: string;
  businessModel: string;
  contentSource: 'wordpress' | 'nextjs';
  contentBaseUrl: string;
  onboardingPath?: string;
  architecture?: string;
  selectedModules: string[];
  brandSetup: Record<string, unknown>;
  onboardingSteps: OnboardingStepState[];
  currentStep: number;
  status: 'draft' | 'onboarding' | 'ready_for_launch' | 'launched' | 'blocked';
  deploymentReadiness: {
    onboardingComplete: boolean;
    architectureValidated: boolean;
    apisReachable: boolean;
    modulesValid: boolean;
    frontendValidated: boolean;
    contentMapped: boolean;
    integrationsConfigured: boolean;
  };
  missingRequirements: string[];
  recoverySuggestions: string[];
  rollout: {
    pageSchemaVersion: number;
    componentSchemaVersion: number;
    channel: 'stable' | 'beta';
    promotedAt?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export type AccountPlan = 'starter' | 'business' | 'enterprise';

export interface DeploymentLink {
  id: string;
  plan: AccountPlan;
  createdAt: string;
  expiresAt: string;
  used: boolean;
  usedAt?: string;
  workspaceId?: string;
  provisioning: {
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    currentStep: number;
    totalSteps: number;
    lastError?: string;
  };
}

export interface CloudOrchestrationStore {
  workspaces: Record<string, WorkspaceOrchestration>;
  pageSchemas: Record<string, VersionedSchema<PageSchemaData>[]>;
  componentSchemas: Record<string, VersionedSchema<ComponentSchemaData>[]>;
  commands: ConnectorCommandRecord[];
  pagePublications: Record<
    string,
    {
      sourceType: 'wordpress' | 'nextjs';
      baseUrl: string;
      pageId: string;
      title: string;
      sections: Array<Record<string, unknown>>;
      updatedAt: string;
    }
  >;
  deploymentLinks: Record<string, DeploymentLink>;
  accountPlan: AccountPlan;
  accountPlanUpdatedAt: string;
  lookups: {
    businessTypes: string[];
    businessModels: string[];
    countries: Array<{ code: string; name: string }>;
  };
}

export const PLAN_WORKSPACE_LIMITS: Record<AccountPlan, number> = {
  starter: 1,
  business: 3,
  enterprise: 999, // Effectively unlimited
};

export const ADMIN_MODULE_KEYS = [
  'dashboard',
  'products',
  'orders',
  'reports',
  'customers',
  'blog',
  'stores',
  'siteSettings',
  'adminSettings',
] as const;

export type AdminModuleKey = (typeof ADMIN_MODULE_KEYS)[number];
export type RoleModuleVisibility = Record<string, Partial<Record<AdminModuleKey, boolean>>>;

export interface AdminConfigStore {
  users: Record<string, ManagedUserState>;
  tracking: TrackingConfig;
  smtp: SmtpConfig;
  forms: FormRoutingRule[];
  roleModuleVisibility: RoleModuleVisibility;
  maintenance: MaintenanceSettings;
  audit: AuditRecord[];
  cloud: CloudOrchestrationStore;
}

const FULL_ACCESS: Record<AdminModuleKey, boolean> = {
  dashboard: true,
  products: true,
  orders: true,
  reports: true,
  customers: true,
  blog: true,
  stores: true,
  siteSettings: true,
  adminSettings: true,
};

// ─── WordPress persistence (production) ──────────────────────────────────────
// When running on Vercel, adminStore reads/writes to WordPress via REST API
// so all data survives deployments. Set WP_APP_USER and WP_APP_PASSWORD
// (a WordPress Application Password) in your Vercel environment variables.
import { getConfig } from '@/src/config/client';

const getWpApiUrl = () => {
  const config = getConfig();
  return config.wordpressApiUrl || getWordPressApiBase();
};

export const WP_API_URL = getWpApiUrl();
const WP_APP_USER = process.env.WP_APP_USER || '';
const WP_APP_PASSWORD = process.env.WP_APP_PASSWORD || '';

async function wpAuthHeader(): Promise<Record<string, string>> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('admin_token')?.value;
    if (token) {
      return { Authorization: `Bearer ${token}` };
    }
  } catch {
    // No request cookie context available; fall back to app credentials.
  }

  if (!WP_APP_USER || !WP_APP_PASSWORD) return {};
  const encoded = Buffer.from(`${WP_APP_USER}:${WP_APP_PASSWORD}`).toString('base64');
  return { Authorization: `Basic ${encoded}` };
}

// ─── Local filesystem (development) ──────────────────────────────────────────
const STORE_PATH = path.join(process.cwd(), '.admin-data', 'ecommerce-admin-config.json');

const DEFAULT_STORE: AdminConfigStore = {
  users: {},
  tracking: {
    ecommerceDomain: '',
    googleAnalyticsId: '',
    googleTagManagerId: '',
    googleSearchConsoleVerification: '',
    metaPixelId: '',
    tiktokPixelId: '',
    whatsappChatEnabled: false,
    whatsappChatNumber: '',
    whatsappChatText: 'Chat with us on WhatsApp',
    customHeadScripts: '',
    customBodyScripts: '',
    customFooterScripts: '',
  },
  smtp: {
    provider: 'microsoft365',
    useWordPressMailer: false,
    host: 'smtp.office365.com',
    port: 587,
    secure: false,
    username: '',
    password: '',
    fromEmail: '',
    fromName: 'Marvéo Store',
  },
  forms: [
    {
      formKey: 'contact',
      formName: 'Contact Form',
      fromEmail: '',
      senderName: '',
      recipients: [],
    },
    {
      formKey: 'distributor',
      formName: 'Distributor Application',
      fromEmail: '',
      senderName: '',
      recipients: [],
    },
    {
      formKey: 'checkout',
      formName: 'Checkout Notifications',
      fromEmail: '',
      senderName: '',
      recipients: [],
    },
  ],
  roleModuleVisibility: {
    administrator: { ...FULL_ACCESS },
    shop_manager: {
      dashboard: true,
      products: true,
      orders: true,
      reports: true,
      customers: true,
      blog: true,
      stores: true,
      siteSettings: true,
      adminSettings: false,
    },
    editor: {
      dashboard: true,
      products: false,
      orders: false,
      reports: false,
      customers: false,
      blog: true,
      stores: false,
      siteSettings: false,
      adminSettings: false,
    },
  },
  maintenance: {
    site_under_construction: false,
    under_construction_title: 'We are coming back soon',
    under_construction_message: 'We are currently making improvements to serve you better. Please check back shortly.',
  },
  audit: [],
  cloud: {
    workspaces: {},
    pageSchemas: {},
    componentSchemas: {},
    commands: [],
    pagePublications: {},
    deploymentLinks: {},
    accountPlan: 'starter',
    accountPlanUpdatedAt: new Date().toISOString(),
    lookups: {
      businessTypes: ['Retail', 'Wholesale', 'Manufacturing', 'Services', 'Healthcare', 'Education', 'Hospitality', 'Technology'],
      businessModels: ['B2C', 'B2B', 'B2B2C', 'Marketplace', 'Subscription', 'Hybrid'],
      countries: [
        { code: 'US', name: 'United States' },
        { code: 'GB', name: 'United Kingdom' },
        { code: 'CA', name: 'Canada' },
        { code: 'NG', name: 'Nigeria' },
        { code: 'KE', name: 'Kenya' },
        { code: 'ZA', name: 'South Africa' },
        { code: 'AE', name: 'United Arab Emirates' },
        { code: 'IN', name: 'India' },
      ],
    },
  },
};

function mergeWithDefaults(parsed: Partial<AdminConfigStore>): AdminConfigStore {
  const rawCloud = (parsed.cloud as unknown as Record<string, unknown> | undefined) ?? undefined;
  const legacyPageDrafts = rawCloud?.pageDrafts as Record<string, unknown> | undefined;
  const pagePublicationsRaw = parsed.cloud?.pagePublications as Record<string, unknown> | undefined;

  const sanitizePublications = (input: Record<string, unknown> | undefined) => {
    if (!input) return {} as CloudOrchestrationStore['pagePublications'];

    const output: CloudOrchestrationStore['pagePublications'] = {};
    for (const [key, value] of Object.entries(input)) {
      if (!value || typeof value !== 'object') continue;
      const row = value as Record<string, unknown>;
      const sourceType = String(row.sourceType || '').toLowerCase() === 'nextjs' ? 'nextjs' : 'wordpress';
      const baseUrl = String(row.baseUrl || '').trim();
      const pageId = String(row.pageId || '').trim();
      const title = String(row.title || '').trim();
      const sections = Array.isArray(row.sections)
        ? row.sections.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
        : [];

      if (!baseUrl || !pageId) continue;

      output[key] = {
        sourceType,
        baseUrl,
        pageId,
        title: title || pageId,
        sections,
        updatedAt: String(row.updatedAt || ''),
      };
    }

    return output;
  };

  const mergedPublications = Object.keys(pagePublicationsRaw || {}).length > 0
    ? sanitizePublications(pagePublicationsRaw)
    : sanitizePublications(legacyPageDrafts);

  return {
    ...DEFAULT_STORE,
    ...parsed,
    users: parsed.users ?? {},
    tracking: { ...DEFAULT_STORE.tracking, ...(parsed.tracking ?? {}) },
    smtp: { ...DEFAULT_STORE.smtp, ...(parsed.smtp ?? {}) },
    forms: Array.isArray(parsed.forms) ? parsed.forms : DEFAULT_STORE.forms,
    roleModuleVisibility: {
      ...DEFAULT_STORE.roleModuleVisibility,
      ...(parsed.roleModuleVisibility ?? {}),
    },
    maintenance: { ...DEFAULT_STORE.maintenance, ...(parsed.maintenance ?? {}) },
    audit: Array.isArray(parsed.audit) ? parsed.audit : [],
    cloud: {
      ...DEFAULT_STORE.cloud,
      ...(parsed.cloud ?? {}),
      workspaces: parsed.cloud?.workspaces ?? {},
      pageSchemas: parsed.cloud?.pageSchemas ?? {},
      componentSchemas: parsed.cloud?.componentSchemas ?? {},
      commands: Array.isArray(parsed.cloud?.commands) ? parsed.cloud?.commands : [],
      pagePublications: mergedPublications,
      deploymentLinks: parsed.cloud?.deploymentLinks ?? {},
      accountPlan: (['starter', 'business', 'enterprise'].includes(parsed.cloud?.accountPlan ?? '')
        ? (parsed.cloud?.accountPlan as AccountPlan)
        : 'starter'),
      accountPlanUpdatedAt: parsed.cloud?.accountPlanUpdatedAt ?? DEFAULT_STORE.cloud.accountPlanUpdatedAt,
      lookups: {
        businessTypes: Array.isArray(parsed.cloud?.lookups?.businessTypes)
          ? parsed.cloud.lookups.businessTypes.map((item) => String(item)).filter(Boolean)
          : DEFAULT_STORE.cloud.lookups.businessTypes,
        businessModels: Array.isArray(parsed.cloud?.lookups?.businessModels)
          ? parsed.cloud.lookups.businessModels.map((item) => String(item)).filter(Boolean)
          : DEFAULT_STORE.cloud.lookups.businessModels,
        countries: Array.isArray(parsed.cloud?.lookups?.countries)
          ? parsed.cloud.lookups.countries
              .map((item) => ({
                code: String(item?.code ?? '').trim().toUpperCase(),
                name: String(item?.name ?? '').trim(),
              }))
              .filter((item) => item.code && item.name)
          : DEFAULT_STORE.cloud.lookups.countries,
      },
    },
  };
}

// ─── WordPress-backed read/write ──────────────────────────────────────────────

async function readFromWordPress(): Promise<AdminConfigStore> {
  const endpoint = process.env.MARVEO_ADMIN_CONFIG_ENDPOINT || '/wp-json/marveo-core/v1/admin-config';
  const res = await fetch(`${WP_API_URL}${endpoint}`, {
    headers: { 'Content-Type': 'application/json', ...(await wpAuthHeader()) },
    cache: 'no-store',
  });
  if (res.status === 204 || res.status === 404) return DEFAULT_STORE;
  if (!res.ok) throw new Error(`WP admin-config GET failed: ${res.status}`);
  const parsed = (await res.json()) as Partial<AdminConfigStore>;
  return mergeWithDefaults(parsed);
}

async function writeToWordPress(data: AdminConfigStore): Promise<void> {
  const endpoint = process.env.MARVEO_ADMIN_CONFIG_ENDPOINT || '/wp-json/marveo-core/v1/admin-config';
  const res = await fetch(`${WP_API_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await wpAuthHeader()) },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`WP admin-config POST failed: ${res.status}`);
}

// ─── Local filesystem read/write (dev) ───────────────────────────────────────

async function ensureStoreFile() {
  try {
    const dir = path.dirname(STORE_PATH);
    await fs.mkdir(dir, { recursive: true });
    await fs.access(STORE_PATH);
  } catch {
    try {
      await fs.writeFile(STORE_PATH, JSON.stringify(DEFAULT_STORE, null, 2), 'utf8');
    } catch {
      // Read-only env — skip initialization.
    }
  }
}

async function readFromFile(): Promise<AdminConfigStore> {
  await ensureStoreFile();
  const raw = await fs.readFile(STORE_PATH, 'utf8');
  const parsed = JSON.parse(raw) as Partial<AdminConfigStore>;
  return mergeWithDefaults(parsed);
}

async function writeToFile(data: AdminConfigStore): Promise<void> {
  await ensureStoreFile();
  await fs.writeFile(STORE_PATH, JSON.stringify(data, null, 2), 'utf8');
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function readAdminStore(): Promise<AdminConfigStore> {
  try {
    if (process.env.VERCEL) {
      return await readFromWordPress();
    }
    return await readFromFile();
  } catch {
    return DEFAULT_STORE;
  }
}

export async function writeAdminStore(next: AdminConfigStore): Promise<void> {
  if (process.env.VERCEL) {
    await writeToWordPress(next);
  } else {
    await writeToFile(next);
  }
}

export async function updateAdminStore(
  updater: (current: AdminConfigStore) => AdminConfigStore,
): Promise<AdminConfigStore> {
  const current = await readAdminStore();
  const updated = updater(current);
  await writeAdminStore(updated);
  return updated;
}

export async function appendAuditLog(record: Omit<AuditRecord, 'id' | 'at'>) {
  await updateAdminStore((current) => {
    const entryId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    const entry: AuditRecord = {
      id: entryId,
      at: new Date().toISOString(),
      ...record,
    };
    return {
      ...current,
      audit: [entry, ...current.audit].slice(0, 500),
    };
  });
}

