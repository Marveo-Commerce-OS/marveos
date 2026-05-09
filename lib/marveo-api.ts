export type MarveoOnboardingPath = 'new_build' | 'existing_wordpress' | 'existing_headless';
export type MarveoArchitecture = 'wordpress_only' | 'headless_next_js' | 'hybrid' | 'headless_migration' | 'frontend_adapter' | 'content_only';

export interface MarveoDeploymentStatus {
  mode: 'wordpress' | 'headless';
  setup_completed: boolean;
  validation_passed: boolean;
  validation_states: Record<string, boolean>;
  missing_requirements: string[];
  recovery_suggestions: Array<{
    missing: string;
    suggestion: string;
    can_retry: boolean;
    can_rollback: boolean;
  }>;
  retry_controls: {
    validate_endpoint: string;
    max_retries: number;
    next_retry_hint: string;
  };
  last_validated_at: string;
}

export interface MarveoPage {
  id: number;
  title: string;
  slug: string;
  page_type: string;
  source: string;
  seo: Record<string, unknown>;
  components: MarveoComponentInstance[];
  navigation_visibility: boolean;
  frontend_visibility: boolean;
  template: string;
  status: string;
}

export interface MarveoComponentDefinition {
  key: string;
  name: string;
  category: string;
  fields: string[];
  allowed_page_types: string[];
  data_source: string;
  visibility: string;
}

export interface MarveoComponentInstance {
  key: string;
  props?: Record<string, unknown>;
}

export interface MarveoNavigationMenu {
  id: number;
  name: string;
  slug: string;
  items: Array<{
    id: number;
    label: string;
    url: string;
    parent: number;
  }>;
}

export interface MarveoSiteProfile {
  site_id: string;
  site_url: string;
  site_name: string;
  wordpress_version: string;
  woocommerce_enabled: boolean;
  mode: 'wordpress' | 'headless';
  business_profile: {
    business_name: string;
    industry: string;
    business_model: string;
    country_currency: string;
  };
}

export interface MarveoPublicSettings {
  business_profile: Record<string, unknown>;
  brand_settings: Record<string, unknown>;
  content_settings: Record<string, unknown>;
  integration_settings: Record<string, unknown>;
}

export interface MarveoRuntimeBundle {
  profile: MarveoSiteProfile;
  settings: MarveoPublicSettings;
  brand: Record<string, unknown>;
  pages: MarveoPage[];
  navigation: MarveoNavigationMenu[];
  components: MarveoComponentDefinition[];
  modules: Record<string, unknown>;
  deploymentStatus: MarveoDeploymentStatus;
}

const RETRY_DELAYS_MS = [250, 500, 1000];

function normalizeBase(baseUrl: string): string {
  return baseUrl.replace(/\/$/, '');
}

function buildEndpoint(baseUrl: string, path: string): string {
  const base = normalizeBase(baseUrl);
  if (base.endsWith('/wp-json/marveo/v1')) {
    return `${base}/${path}`;
  }

  if (base.endsWith('/marveo/v1')) {
    return `${base}/${path}`;
  }

  if (base.endsWith('/wp-json')) {
    return `${base}/marveo/v1/${path}`;
  }

  return `${base}/wp-json/marveo/v1/${path}`;
}

async function fetchWithRetry<T>(url: string, fallback: T): Promise<T> {
  for (let i = 0; i < RETRY_DELAYS_MS.length; i += 1) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return (await response.json()) as T;
    } catch {
      if (i === RETRY_DELAYS_MS.length - 1) {
        return fallback;
      }
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[i]));
    }
  }

  return fallback;
}

function buildWorkspaceRuntimeEndpoint(workspaceId: string): string {
  return `/api/runtime/workspaces/${encodeURIComponent(workspaceId)}`;
}

export class MarveoApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly workspaceId?: string,
  ) {}

  private hasWorkspaceRuntime(): boolean {
    return Boolean(this.workspaceId);
  }

  getSiteProfile(): Promise<MarveoSiteProfile> {
    return fetchWithRetry(buildEndpoint(this.baseUrl, 'site-profile'), {
      site_id: '',
      site_url: '',
      site_name: '',
      wordpress_version: '',
      woocommerce_enabled: false,
      mode: 'wordpress',
      business_profile: {
        business_name: '',
        industry: '',
        business_model: '',
        country_currency: '',
      },
    });
  }

  getSettings(): Promise<MarveoPublicSettings> {
    return fetchWithRetry(buildEndpoint(this.baseUrl, 'settings'), {
      business_profile: {},
      brand_settings: {},
      content_settings: {},
      integration_settings: {},
    });
  }

  getBrand(): Promise<Record<string, unknown>> {
    return fetchWithRetry(buildEndpoint(this.baseUrl, 'brand'), {});
  }

  getPages(): Promise<MarveoPage[]> {
    return fetchWithRetry(buildEndpoint(this.baseUrl, 'pages'), []);
  }

  getNavigation(): Promise<MarveoNavigationMenu[]> {
    return fetchWithRetry(buildEndpoint(this.baseUrl, 'navigation'), []);
  }

  getComponents(): Promise<MarveoComponentDefinition[]> {
    return fetchWithRetry(buildEndpoint(this.baseUrl, 'components'), []);
  }

  getModules(): Promise<Record<string, unknown>> {
    return fetchWithRetry(buildEndpoint(this.baseUrl, 'modules'), {});
  }

  getDeploymentStatus(): Promise<MarveoDeploymentStatus> {
    return fetchWithRetry(buildEndpoint(this.baseUrl, 'deployment-status'), {
      mode: 'wordpress',
      setup_completed: false,
      validation_passed: false,
      validation_states: {},
      missing_requirements: ['Deployment status unavailable'],
      recovery_suggestions: [
        {
          missing: 'deployment_status',
          suggestion: 'Retry validation from Marveo Cloud.',
          can_retry: true,
          can_rollback: true,
        },
      ],
      retry_controls: {
        validate_endpoint: '/wp-json/marveo/v1/deployment-status',
        max_retries: 3,
        next_retry_hint: 'Retry from Marveo Cloud after fixing requirements.',
      },
      last_validated_at: new Date(0).toISOString(),
    });
  }

  async getRuntimeBundle(): Promise<MarveoRuntimeBundle> {
    if (this.hasWorkspaceRuntime() && this.workspaceId) {
      const runtime = await fetchWithRetry<MarveoRuntimeBundle>(
        buildWorkspaceRuntimeEndpoint(this.workspaceId),
        {
          profile: {
            site_id: '',
            site_url: '',
            site_name: '',
            wordpress_version: '',
            woocommerce_enabled: false,
            mode: 'wordpress',
            business_profile: {
              business_name: '',
              industry: '',
              business_model: '',
              country_currency: '',
            },
          },
          settings: {
            business_profile: {},
            brand_settings: {},
            content_settings: {},
            integration_settings: {},
          },
          brand: {},
          pages: [],
          navigation: [],
          components: [],
          modules: {},
          deploymentStatus: {
            mode: 'wordpress',
            setup_completed: false,
            validation_passed: false,
            validation_states: {},
            missing_requirements: ['Runtime workspace endpoint unavailable'],
            recovery_suggestions: [
              {
                missing: 'workspace_runtime',
                suggestion: 'Verify workspace runtime endpoint and retry.',
                can_retry: true,
                can_rollback: true,
              },
            ],
            retry_controls: {
              validate_endpoint: '/api/runtime/workspaces/:workspaceId',
              max_retries: 3,
              next_retry_hint: 'Retry after resolving runtime API issues.',
            },
            last_validated_at: new Date(0).toISOString(),
          },
        },
      );

      return runtime;
    }

    const [
      profile,
      settings,
      brand,
      pages,
      navigation,
      components,
      modules,
      deploymentStatus,
    ] = await Promise.all([
      this.getSiteProfile(),
      this.getSettings(),
      this.getBrand(),
      this.getPages(),
      this.getNavigation(),
      this.getComponents(),
      this.getModules(),
      this.getDeploymentStatus(),
    ]);

    return {
      profile,
      settings,
      brand,
      pages,
      navigation,
      components,
      modules,
      deploymentStatus,
    };
  }
}

export function createMarveoApiClient(baseUrl: string): MarveoApiClient {
  const workspaceId = (process.env.NEXT_PUBLIC_MARVEO_WORKSPACE_ID || '').trim() || undefined;
  return new MarveoApiClient(baseUrl, workspaceId);
}
