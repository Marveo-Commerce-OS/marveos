import { promises as fs } from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { getSession, isSuperAdmin } from '@/lib/auth';
import {
  updateAdminStore,
  type CommercialTemplateArtifactStatus,
  type CommercialTemplateConfig,
  type CommercialTemplatePlanAvailability,
  type CommercialTemplateRepoSource,
  type CommercialTemplateStack,
  type CommercialTemplateStatus,
  type CommercialTemplateVisibility,
  type CommercialTemplateWebsiteType,
} from '@/lib/adminStore';

const TEMPLATE_ROOT = path.resolve(process.cwd(), '../marveo-templates');

type TemplateJsonRecord = Partial<CommercialTemplateConfig> & {
  templateId?: string;
  name?: string;
  entry?: {
    manifest?: string;
    thumbnail?: string;
  };
};

const TEMPLATE_STATUSES = new Set<CommercialTemplateStatus>(['DRAFT', 'ACTIVE', 'ARCHIVED']);
const TEMPLATE_VISIBILITY = new Set<CommercialTemplateVisibility>(['INTERNAL', 'PUBLIC']);
const TEMPLATE_WEBSITE_TYPES = new Set<CommercialTemplateWebsiteType>(['NEW_WEBSITE', 'EXISTING_WEBSITE', 'CUSTOM_HEADLESS']);
const TEMPLATE_STACKS = new Set<CommercialTemplateStack>(['WORDPRESS_NEXTJS', 'WORDPRESS_ONLY', 'NEXTJS', 'CUSTOM']);
const TEMPLATE_PLANS = new Set<CommercialTemplatePlanAvailability>(['starter', 'business', 'growth', 'enterprise', 'all']);
const TEMPLATE_REPO_SOURCES = new Set<CommercialTemplateRepoSource>(['MARVEO_TEMPLATES', 'MANUAL', 'EXTERNAL']);
const TEMPLATE_ARTIFACT_STATUSES = new Set<CommercialTemplateArtifactStatus>(['MISSING', 'FOUND', 'NOT_VALIDATED']);

function normalizeStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.map((item) => String(item).trim()).filter(Boolean);
}

function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function toTemplateStatus(value: unknown): CommercialTemplateStatus {
  const normalized = String(value || 'DRAFT').trim().toUpperCase() as CommercialTemplateStatus;
  return TEMPLATE_STATUSES.has(normalized) ? normalized : 'DRAFT';
}

function toTemplateVisibility(value: unknown): CommercialTemplateVisibility {
  const normalized = String(value || 'INTERNAL').trim().toUpperCase() as CommercialTemplateVisibility;
  return TEMPLATE_VISIBILITY.has(normalized) ? normalized : 'INTERNAL';
}

function toWebsiteTypes(input: unknown): CommercialTemplateWebsiteType[] {
  const values = normalizeStringArray(input).map((item) => item.toUpperCase());
  const filtered = values.filter((item): item is CommercialTemplateWebsiteType => TEMPLATE_WEBSITE_TYPES.has(item as CommercialTemplateWebsiteType));
  return filtered.length > 0 ? filtered : ['NEW_WEBSITE'];
}

function toStacks(input: unknown): CommercialTemplateStack[] {
  const values = normalizeStringArray(input).map((item) => item.toUpperCase());
  const filtered = values.filter((item): item is CommercialTemplateStack => TEMPLATE_STACKS.has(item as CommercialTemplateStack));
  return filtered.length > 0 ? filtered : ['WORDPRESS_NEXTJS'];
}

function toPlanAvailability(input: unknown): CommercialTemplatePlanAvailability[] {
  const values = normalizeStringArray(input).map((item) => item.toLowerCase());
  const filtered = values.filter((item): item is CommercialTemplatePlanAvailability => TEMPLATE_PLANS.has(item as CommercialTemplatePlanAvailability));
  return filtered.length > 0 ? filtered : ['all'];
}

function toRepoSource(value: unknown, repoPath?: string): CommercialTemplateRepoSource {
  const normalized = String(value || '').trim().toUpperCase() as CommercialTemplateRepoSource;
  if (TEMPLATE_REPO_SOURCES.has(normalized)) return normalized;
  return repoPath ? 'MARVEO_TEMPLATES' : 'MANUAL';
}

function toArtifactStatus(value: unknown, repoPath?: string): CommercialTemplateArtifactStatus {
  const normalized = String(value || '').trim().toUpperCase() as CommercialTemplateArtifactStatus;
  if (TEMPLATE_ARTIFACT_STATUSES.has(normalized)) return normalized;
  return repoPath ? 'FOUND' : 'MISSING';
}

function badRequest(error: string) {
  return NextResponse.json({ ok: false, error }, { status: 400 });
}

async function readJsonFile(filePath: string): Promise<Record<string, unknown> | null> {
  try {
    const contents = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(contents);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

async function collectTemplateJsonFiles(rootDir: string): Promise<string[]> {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const resolved = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectTemplateJsonFiles(resolved));
    } else if (entry.isFile() && entry.name === 'template.json') {
      files.push(resolved);
    }
  }

  return files;
}

async function buildTemplatesFromRegistry(): Promise<CommercialTemplateConfig[]> {
  const templateFiles = await collectTemplateJsonFiles(TEMPLATE_ROOT);
  const now = new Date().toISOString();

  const templates: Array<CommercialTemplateConfig | null> = await Promise.all(
    templateFiles.map(async (templateFile) => {
      const record = await readJsonFile(templateFile) as TemplateJsonRecord | null;
      if (!record) return null;

      const templateId = String(record.templateId || '').trim();
      const name = String(record.name || '').trim();
      if (!templateId || !name) return null;

      const folder = path.dirname(templateFile);
      const manifestPath = typeof record.entry?.manifest === 'string' && record.entry.manifest.trim()
        ? path.resolve(folder, record.entry.manifest)
        : path.join(folder, 'manifest.json');
      const manifest = await readJsonFile(manifestPath);
      const repoPath = String(record.repoPath || path.relative(TEMPLATE_ROOT, templateFile)).replace(/\\/g, '/');
      const previewImage = String(record.previewImage || record.entry?.thumbnail || '').trim();

      return {
        templateId,
        name,
        slug: normalizeSlug(String(record.slug || '').trim() || name),
        businessType: String(record.businessType || 'General').trim(),
        sector: String(record.sector || '').trim() || undefined,
        category: String(record.category || '').trim() || undefined,
        description: String(record.description || '').trim(),
        previewImage,
        status: toTemplateStatus(record.status),
        visibility: toTemplateVisibility(record.visibility),
        supportedWebsiteTypes: toWebsiteTypes(record.supportedWebsiteTypes),
        supportedStacks: toStacks(record.supportedStacks),
        planAvailability: toPlanAvailability(record.planAvailability),
        countryAvailability: Array.isArray(record.countryAvailability)
          ? record.countryAvailability.map((item) => String(item).trim().toUpperCase()).filter(Boolean)
          : undefined,
        featureModules: normalizeStringArray(record.featureModules),
        requiresSupport: Boolean(record.requiresSupport),
        repoSource: toRepoSource(record.repoSource, repoPath),
        repoPath,
        version: String(record.version || manifest?.version || '1.0.0').trim() || '1.0.0',
        artifactStatus: toArtifactStatus(record.artifactStatus, repoPath),
        createdAt: now,
        updatedAt: now,
        preview: record.preview && typeof record.preview === 'object'
          ? record.preview
          : (manifest?.preview && typeof manifest.preview === 'object' ? manifest.preview as CommercialTemplateConfig['preview'] : undefined),
      } satisfies CommercialTemplateConfig;
    }),
  );

  return templates.filter((item): item is CommercialTemplateConfig => item !== null);
}

async function ensureAdminSession() {
  const session = await getSession();
  if (!session) {
    return { error: NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 }) };
  }

  const allowed = await isSuperAdmin(session.token);
  if (!allowed) {
    return { error: NextResponse.json({ ok: false, error: 'Only super admins can resync templates.' }, { status: 403 }) };
  }

  return { session };
}

export async function POST() {
  const auth = await ensureAdminSession();
  if ('error' in auth) return auth.error;

  try {
    await fs.access(TEMPLATE_ROOT);
  } catch {
    return NextResponse.json({ ok: false, error: 'Template registry root is unavailable.' }, { status: 500 });
  }

  const templates = await buildTemplatesFromRegistry();
  if (templates.length === 0) {
    return NextResponse.json({ ok: false, error: 'No templates were found in the registry.' }, { status: 500 });
  }

  const updated = await updateAdminStore((current) => ({
    ...current,
    cloud: {
      ...current.cloud,
      commercial: {
        ...current.cloud.commercial,
        templates,
      },
    },
  }));

  return NextResponse.json({ ok: true, templates: updated.cloud.commercial.templates, imported: templates.length });
}
