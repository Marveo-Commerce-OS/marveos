import { NextRequest, NextResponse } from 'next/server';
import { getSession, getCurrentWpUser, isAdmin, isSuperAdmin } from '@/lib/auth';
import {
  appendAuditLog,
  readAdminStore,
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

const TEMPLATE_STATUSES = new Set<CommercialTemplateStatus>(['DRAFT', 'ACTIVE', 'ARCHIVED']);
const TEMPLATE_VISIBILITY = new Set<CommercialTemplateVisibility>(['INTERNAL', 'PUBLIC']);
const TEMPLATE_WEBSITE_TYPES = new Set<CommercialTemplateWebsiteType>(['NEW_WEBSITE', 'EXISTING_WEBSITE', 'CUSTOM_HEADLESS']);
const TEMPLATE_STACKS = new Set<CommercialTemplateStack>(['WORDPRESS_NEXTJS', 'WORDPRESS_ONLY', 'NEXTJS', 'CUSTOM']);
const TEMPLATE_PLANS = new Set<CommercialTemplatePlanAvailability>(['starter', 'business', 'growth', 'enterprise', 'all']);
const TEMPLATE_REPO_SOURCES = new Set<CommercialTemplateRepoSource>(['MARVEO_TEMPLATES', 'MANUAL', 'EXTERNAL']);
const TEMPLATE_ARTIFACT_STATUSES = new Set<CommercialTemplateArtifactStatus>(['MISSING', 'FOUND', 'NOT_VALIDATED']);

function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function normalizeStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.map((item) => String(item).trim()).filter(Boolean);
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

function normalizeCountryAvailability(input: unknown): string[] | undefined {
  const values = normalizeStringArray(input).map((item) => item.toUpperCase());
  return values.length > 0 ? values : undefined;
}

function toRepoSource(value: unknown, repoPath?: string): CommercialTemplateRepoSource {
  const normalized = String(value || '').trim().toUpperCase() as CommercialTemplateRepoSource;
  if (TEMPLATE_REPO_SOURCES.has(normalized)) return normalized;
  return repoPath ? 'MARVEO_TEMPLATES' : 'MANUAL';
}

function toArtifactStatus(value: unknown, repoPath?: string): CommercialTemplateArtifactStatus {
  const normalized = String(value || '').trim().toUpperCase() as CommercialTemplateArtifactStatus;
  if (TEMPLATE_ARTIFACT_STATUSES.has(normalized)) return normalized;
  return repoPath ? 'NOT_VALIDATED' : 'MISSING';
}

function hasRequiredTemplateMetadata(template: CommercialTemplateConfig): boolean {
  return Boolean(
    template.templateId.trim()
    && template.name.trim()
    && template.slug.trim()
    && template.businessType.trim()
    && template.description.trim()
    && template.supportedWebsiteTypes.length > 0
    && template.supportedStacks.length > 0
    && template.planAvailability.length > 0,
  );
}

function canPublishTemplate(template: CommercialTemplateConfig): { ok: boolean; reason?: string } {
  if (template.status !== 'ACTIVE' || template.visibility !== 'PUBLIC') {
    return { ok: true };
  }

  if (!hasRequiredTemplateMetadata(template)) {
    return { ok: false, reason: 'Cannot publish template: required metadata is incomplete.' };
  }

  const hasArtifactMapping = Boolean(template.repoPath?.trim()) || template.requiresSupport;
  if (!hasArtifactMapping) {
    return { ok: false, reason: 'Cannot publish template: repoPath is required unless requiresSupport is enabled.' };
  }

  if (!template.requiresSupport && template.artifactStatus !== 'FOUND') {
    return { ok: false, reason: 'Cannot publish template: artifactStatus must be FOUND for non-support templates.' };
  }

  return { ok: true };
}

function badRequest(error: string) {
  return NextResponse.json({ ok: false, error }, { status: 400 });
}

async function ensureAdminSession() {
  const session = await getSession();
  if (!session) {
    return { error: NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 }) };
  }

  const allowed = await isAdmin(session.token);
  if (!allowed) {
    return { error: NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 }) };
  }

  return { session };
}

export async function GET() {
  const auth = await ensureAdminSession();
  if ('error' in auth) return auth.error;

  const store = await readAdminStore();
  const templates = store.cloud.commercial.templates
    .slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return NextResponse.json({ ok: true, templates });
}

export async function POST(req: NextRequest) {
  const auth = await ensureAdminSession();
  if ('error' in auth) return auth.error;

  const canMutate = await isSuperAdmin(auth.session.token);
  if (!canMutate) {
    return NextResponse.json({ ok: false, error: 'Only super admins can create templates.' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return badRequest('Invalid JSON body.');

  const templateId = String(body.templateId || '').trim();
  const name = String(body.name || '').trim();
  if (!templateId) return badRequest('templateId is required.');
  if (!name) return badRequest('name is required.');

  const now = new Date().toISOString();
  const slugInput = String(body.slug || '').trim();
  const slug = normalizeSlug(slugInput || name);
  const repoPath = String(body.repoPath || '').trim() || undefined;

  if (!slug) return badRequest('slug is required.');

  const nextTemplate: CommercialTemplateConfig = {
    templateId,
    name,
    slug,
    businessType: String(body.businessType || 'General').trim(),
    sector: String(body.sector || '').trim() || undefined,
    category: String(body.category || '').trim() || undefined,
    description: String(body.description || '').trim(),
    previewImage: String(body.previewImage || '').trim(),
    status: toTemplateStatus(body.status),
    visibility: toTemplateVisibility(body.visibility),
    supportedWebsiteTypes: toWebsiteTypes(body.supportedWebsiteTypes),
    supportedStacks: toStacks(body.supportedStacks),
    planAvailability: toPlanAvailability(body.planAvailability),
    countryAvailability: normalizeCountryAvailability(body.countryAvailability),
    featureModules: normalizeStringArray(body.featureModules),
    requiresSupport: Boolean(body.requiresSupport),
    repoSource: toRepoSource(body.repoSource, repoPath),
    repoPath,
    version: String(body.version || '').trim() || '1.0.0',
    artifactStatus: toArtifactStatus(body.artifactStatus, repoPath),
    createdAt: now,
    updatedAt: now,
    preview: body.preview && typeof body.preview === 'object' ? body.preview : undefined,
  };

  const publishGuard = canPublishTemplate(nextTemplate);
  if (!publishGuard.ok) {
    return badRequest(publishGuard.reason || 'Cannot publish template.');
  }

  const store = await readAdminStore();
  const exists = store.cloud.commercial.templates.some((template) => template.templateId === templateId);
  if (exists) {
    return NextResponse.json({ ok: false, error: 'templateId already exists' }, { status: 409 });
  }

  const created = await updateAdminStore((current) => ({
    ...current,
    cloud: {
      ...current.cloud,
      commercial: {
        ...current.cloud.commercial,
        templates: [nextTemplate, ...current.cloud.commercial.templates],
      },
    },
  }));

  const createdTemplate = created.cloud.commercial.templates.find((template) => template.templateId === templateId);
  if (!createdTemplate) {
    return NextResponse.json({ ok: false, error: 'Failed to create template' }, { status: 500 });
  }

  const actor = await getCurrentWpUser(auth.session.token);
  await appendAuditLog({
    actorEmail: actor?.email ?? auth.session.user?.user_email ?? 'unknown',
    action: 'template.created',
    target: `template:${templateId}`,
    details: `status=${nextTemplate.status};visibility=${nextTemplate.visibility};artifactStatus=${nextTemplate.artifactStatus}`,
  });

  return NextResponse.json({ ok: true, template: createdTemplate }, { status: 201 });
}
