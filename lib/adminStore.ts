import { promises as fs } from 'node:fs';
import path from 'node:path';

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
  customHeadScripts: string;
  customBodyScripts: string;
  customFooterScripts: string;
}

export interface SmtpConfig {
  provider: 'microsoft365';
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
  audit: AuditRecord[];
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
const WP_API_URL = process.env.NEXT_PUBLIC_WP_API_URL || 'https://central.prag.global/wp-json';
const WP_APP_USER = process.env.WP_APP_USER || '';
const WP_APP_PASSWORD = process.env.WP_APP_PASSWORD || '';

function wpAuthHeader(): Record<string, string> {
  if (!WP_APP_USER || !WP_APP_PASSWORD) return {};
  const encoded = Buffer.from(`${WP_APP_USER}:${WP_APP_PASSWORD}`).toString('base64');
  return { Authorization: `Basic ${encoded}` };
}

// ─── Local filesystem (development) ──────────────────────────────────────────
const STORE_PATH = path.join(process.cwd(), '.admin-data', 'ecommerce-admin-config.json');

const DEFAULT_STORE: AdminConfigStore = {
  users: {},
  tracking: {
    ecommerceDomain: 'shop.prag.global',
    googleAnalyticsId: '',
    googleTagManagerId: '',
    googleSearchConsoleVerification: '',
    metaPixelId: '',
    tiktokPixelId: '',
    customHeadScripts: '',
    customBodyScripts: '',
    customFooterScripts: '',
  },
  smtp: {
    provider: 'microsoft365',
    host: 'smtp.office365.com',
    port: 587,
    secure: false,
    username: '',
    password: '',
    fromEmail: '',
    fromName: 'PRAG Store',
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
  audit: [],
};

function mergeWithDefaults(parsed: Partial<AdminConfigStore>): AdminConfigStore {
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
    audit: Array.isArray(parsed.audit) ? parsed.audit : [],
  };
}

// ─── WordPress-backed read/write ──────────────────────────────────────────────

async function readFromWordPress(): Promise<AdminConfigStore> {
  const res = await fetch(`${WP_API_URL}/prag-core/v1/admin-config`, {
    headers: { 'Content-Type': 'application/json', ...wpAuthHeader() },
    cache: 'no-store',
  });
  if (res.status === 204 || res.status === 404) return DEFAULT_STORE;
  if (!res.ok) throw new Error(`WP admin-config GET failed: ${res.status}`);
  const parsed = (await res.json()) as Partial<AdminConfigStore>;
  return mergeWithDefaults(parsed);
}

async function writeToWordPress(data: AdminConfigStore): Promise<void> {
  const res = await fetch(`${WP_API_URL}/prag-core/v1/admin-config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...wpAuthHeader() },
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
    const entry: AuditRecord = {
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      ...record,
    };
    return {
      ...current,
      audit: [entry, ...current.audit].slice(0, 500),
    };
  });
}

