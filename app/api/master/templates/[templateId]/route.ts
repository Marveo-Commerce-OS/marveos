import { NextRequest, NextResponse } from 'next/server';
import {
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

function toTemplateStatus(value: unknown, fallback: CommercialTemplateStatus): CommercialTemplateStatus {
  const normalized = String(value || fallback).trim().toUpperCase() as CommercialTemplateStatus;
  return TEMPLATE_STATUSES.has(normalized) ? normalized : fallback;
}

function toTemplateVisibility(value: unknown, fallback: CommercialTemplateVisibility): CommercialTemplateVisibility {
  const normalized = String(value || fallback).trim().toUpperCase() as CommercialTemplateVisibility;
  return TEMPLATE_VISIBILITY.has(normalized) ? normalized : fallback;
}

function toWebsiteTypes(input: unknown, fallback: CommercialTemplateWebsiteType[]): CommercialTemplateWebsiteType[] {
  const values = normalizeStringArray(input).map((item) => item.toUpperCase());
  const filtered = values.filter((item): item is CommercialTemplateWebsiteType => TEMPLATE_WEBSITE_TYPES.has(item as CommercialTemplateWebsiteType));
  return filtered.length > 0 ? filtered : fallback;
}

function toStacks(input: unknown, fallback: CommercialTemplateStack[]): CommercialTemplateStack[] {
  const values = normalizeStringArray(input).map((item) => item.toUpperCase());
  const filtered = values.filter((item): item is CommercialTemplateStack => TEMPLATE_STACKS.has(item as CommercialTemplateStack));
  return filtered.length > 0 ? filtered : fallback;
}

function toPlanAvailability(input: unknown, fallback: CommercialTemplatePlanAvailability[]): CommercialTemplatePlanAvailability[] {
  const values = normalizeStringArray(input).map((item) => item.toLowerCase());
  const filtered = values.filter((item): item is CommercialTemplatePlanAvailability => TEMPLATE_PLANS.has(item as CommercialTemplatePlanAvailability));
  return filtered.length > 0 ? filtered : fallback;
}

function toCountryAvailability(input: unknown, fallback?: string[]): string[] | undefined {
  if (input === null) return undefined;
  const values = normalizeStringArray(input).map((item) => item.toUpperCase());
  return values.length > 0 ? values : fallback;
}

function toRepoSource(value: unknown, fallback: CommercialTemplateRepoSource, repoPath?: string): CommercialTemplateRepoSource {
  const normalized = String(value || '').trim().toUpperCase() as CommercialTemplateRepoSource;
  if (TEMPLATE_REPO_SOURCES.has(normalized)) return normalized;
  return repoPath ? 'MARVEO_TEMPLATES' : fallback;
}

function toArtifactStatus(
  value: unknown,
  fallback: CommercialTemplateArtifactStatus,
  repoPath?: string,
): CommercialTemplateArtifactStatus {
  const normalized = String(value || '').trim().toUpperCase() as CommercialTemplateArtifactStatus;
  if (TEMPLATE_ARTIFACT_STATUSES.has(normalized)) return normalized;
  return repoPath ? 'NOT_VALIDATED' : fallback;
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

export async function GET(_: NextRequest, context: { params: Promise<{ templateId: string }> }) {
  const params = await context.params;
  const templateId = String(params.templateId || '').trim();
  if (!templateId) return badRequest('templateId is required.');

  const store = await readAdminStore();
  const template = store.cloud.commercial.templates.find((item) => item.templateId === templateId);
  if (!template) {
    return NextResponse.json({ ok: false, error: 'Template not found.' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, template });
}

export async function PUT(req: NextRequest, context: { params: Promise<{ templateId: string }> }) {
  const params = await context.params;
  const templateId = String(params.templateId || '').trim();
  if (!templateId) return badRequest('templateId is required.');

  const body = await req.json().catch(() => null);
  if (!body) return badRequest('Invalid JSON body.');

  const now = new Date().toISOString();

  let found = false;
  let publishValidationError: string | null = null;
  const updated = await updateAdminStore((current) => {
    const templates = current.cloud.commercial.templates.map((template) => {
      if (template.templateId !== templateId) return template;
      found = true;

      const nextName = String(body.name ?? template.name).trim() || template.name;
      const nextSlug = normalizeSlug(String(body.slug ?? template.slug).trim() || nextName) || template.slug;
      const nextRepoPath = String(body.repoPath ?? template.repoPath ?? '').trim() || undefined;

      const nextTemplate: CommercialTemplateConfig = {
        ...template,
        name: nextName,
        slug: nextSlug,
        businessType: String(body.businessType ?? template.businessType).trim() || template.businessType,
        sector: String(body.sector ?? template.sector ?? '').trim() || undefined,
        category: String(body.category ?? template.category ?? '').trim() || undefined,
        description: String(body.description ?? template.description).trim(),
        previewImage: String(body.previewImage ?? template.previewImage).trim(),
        status: toTemplateStatus(body.status, template.status),
        visibility: toTemplateVisibility(body.visibility, template.visibility),
        supportedWebsiteTypes: toWebsiteTypes(body.supportedWebsiteTypes, template.supportedWebsiteTypes),
        supportedStacks: toStacks(body.supportedStacks, template.supportedStacks),
        planAvailability: toPlanAvailability(body.planAvailability, template.planAvailability),
        countryAvailability: toCountryAvailability(body.countryAvailability, template.countryAvailability),
        featureModules: body.featureModules ? normalizeStringArray(body.featureModules) : template.featureModules,
        requiresSupport: typeof body.requiresSupport === 'boolean' ? body.requiresSupport : template.requiresSupport,
        repoSource: toRepoSource(body.repoSource, template.repoSource, nextRepoPath),
        repoPath: nextRepoPath,
        version: String(body.version ?? template.version).trim() || template.version,
        artifactStatus: toArtifactStatus(body.artifactStatus, template.artifactStatus, nextRepoPath),
        updatedAt: now,
        preview: body.preview && typeof body.preview === 'object' ? body.preview : template.preview,
      };

      const publishGuard = canPublishTemplate(nextTemplate);
      if (!publishGuard.ok) {
        publishValidationError = publishGuard.reason || 'Cannot publish template.';
        return template;
      }

      return nextTemplate;
    });

    return {
      ...current,
      cloud: {
        ...current.cloud,
        commercial: {
          ...current.cloud.commercial,
          templates,
        },
      },
    };
  });

  if (!found) {
    return NextResponse.json({ ok: false, error: 'Template not found.' }, { status: 404 });
  }

  if (publishValidationError) {
    return badRequest(publishValidationError);
  }

  const template = updated.cloud.commercial.templates.find((item) => item.templateId === templateId);
  if (!template) {
    return NextResponse.json({ ok: false, error: 'Template not found.' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, template });
}
