import { getCachedConfig } from '@/src/config/client';
import type { DeploymentStatus } from '@/src/config/deployment';

interface WordPressStatusResponse {
  deployment_status?: Partial<DeploymentStatus>;
}

function getWordPressApiBase(): string {
  const base = process.env.WORDPRESS_API_URL || process.env.NEXT_PUBLIC_WP_API_URL || '';
  return base.replace(/\/$/, '');
}

export async function getRuntimeDeploymentStatus(): Promise<DeploymentStatus> {
  const localStatus = getCachedConfig().deploymentStatus;
  const wpBase = getWordPressApiBase();

  if (!wpBase) {
    return localStatus;
  }

  try {
    const response = await fetch(`${wpBase}/wp-json/marveo/v1/status`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });

    if (!response.ok) {
      return localStatus;
    }

    const payload = (await response.json()) as WordPressStatusResponse;
    if (!payload?.deployment_status || typeof payload.deployment_status !== 'object') {
      return localStatus;
    }

    const remote = payload.deployment_status;

    return {
      ...localStatus,
      ...remote,
      missing_requirements: Array.isArray(remote.missing_requirements)
        ? remote.missing_requirements.filter((item): item is string => typeof item === 'string')
        : localStatus.missing_requirements,
      active_modules: Array.isArray(remote.active_modules)
        ? remote.active_modules.filter((item): item is string => typeof item === 'string')
        : localStatus.active_modules,
      client_profile:
        remote.client_profile && typeof remote.client_profile === 'object'
          ? { ...localStatus.client_profile, ...remote.client_profile }
          : localStatus.client_profile,
    };
  } catch {
    return localStatus;
  }
}
