import { NextRequest, NextResponse } from 'next/server';
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

type TemplateImportRecord = Partial<CommercialTemplateConfig> & { templateId?: string; name?: string };

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

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const records = Array.isArray(body?.templates) ? (body.templates as TemplateImportRecord[]) : null;
  if (!records || records.length === 0) {
    return badRequest('templates array is required');
  }

  const now = new Date().toISOString();

  const normalized = records
    .map((record) => {
      const templateId = String(record.templateId || '').trim();
      const name = String(record.name || '').trim();
      if (!templateId || !name) return null;

      const repoPath = String(record.repoPath || '').trim() || undefined;
      return {
        templateId,
        name,
        slug: normalizeSlug(String(record.slug || '').trim() || name),
        businessType: String(record.businessType || 'General').trim(),
        sector: String(record.sector || '').trim() || undefined,
        category: String(record.category || '').trim() || undefined,
        description: String(record.description || '').trim(),
        previewImage: String(record.previewImage || '').trim(),
        status: toTemplateStatus(record.status),
        visibility: toTemplateVisibility(record.visibility),
        supportedWebsiteTypes: toWebsiteTypes(record.supportedWebsiteTypes),
        supportedStacks: toStacks(record.supportedStacks),
        planAvailability: toPlanAvailability(record.planAvailability),
        countryAvailability: normalizeStringArray(record.countryAvailability).map((item) => item.toUpperCase()),
        featureModules: normalizeStringArray(record.featureModules),
        requiresSupport: Boolean(record.requiresSupport),
        repoSource: toRepoSource(record.repoSource, repoPath),
        repoPath,
        version: String(record.version || '').trim() || '1.0.0',
        artifactStatus: toArtifactStatus(record.artifactStatus, repoPath),
        createdAt: now,
        updatedAt: now,
        preview: record.preview && typeof record.preview === 'object' ? record.preview : undefined,
      } as CommercialTemplateConfig;
    })
    .filter((item): item is CommercialTemplateConfig => Boolean(item));

  if (normalized.length === 0) {
    return badRequest('No valid templates found in import payload');
  }

  const updated = await updateAdminStore((current) => {
    const map = new Map(current.cloud.commercial.templates.map((template) => [template.templateId, template]));

    for (const item of normalized) {
      const existing = map.get(item.templateId);
      if (existing) {
        map.set(item.templateId, {
          ...existing,
          ...item,
          createdAt: existing.createdAt,
          updatedAt: now,
        });
      } else {
        map.set(item.templateId, item);
      }
    }

    return {
      ...current,
      cloud: {
        ...current.cloud,
        commercial: {
          ...current.cloud.commercial,
          templates: Array.from(map.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
        },
      },
    };
  });

  return NextResponse.json({
    ok: true,
    imported: normalized.length,
    totalTemplates: updated.cloud.commercial.templates.length,
  });
}
