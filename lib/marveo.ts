import type {
  MarveoApiClient,
  MarveoComponentDefinition,
  MarveoPage,
  MarveoRuntimeBundle,
} from './marveo-api';

export interface MarveoRenderContext {
  page: MarveoPage;
  componentRegistry: Record<string, MarveoComponentDefinition>;
  settings: MarveoRuntimeBundle['settings'];
  brand: MarveoRuntimeBundle['brand'];
}

export function buildComponentRegistry(
  definitions: MarveoComponentDefinition[],
): Record<string, MarveoComponentDefinition> {
  return definitions.reduce<Record<string, MarveoComponentDefinition>>((acc, item) => {
    acc[item.key] = item;
    return acc;
  }, {});
}

export function getPageBySlug(pages: MarveoPage[], slug: string): MarveoPage | null {
  const normalized = slug.replace(/^\//, '').trim();
  if (!normalized) {
    return pages.find((page) => page.slug === 'home' || page.slug === '') ?? null;
  }

  return pages.find((page) => page.slug === normalized) ?? null;
}

export function canLaunch(deploymentStatus: MarveoRuntimeBundle['deploymentStatus']): boolean {
  return Boolean(
    deploymentStatus.setup_completed &&
      deploymentStatus.validation_passed &&
      deploymentStatus.missing_requirements.length === 0,
  );
}

export async function loadMarveoRuntime(client: MarveoApiClient): Promise<MarveoRuntimeBundle> {
  return client.getRuntimeBundle();
}
