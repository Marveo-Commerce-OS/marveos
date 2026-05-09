/**
 * Enhanced Validation Layer for Marveo Deployments
 *
 * Validates all deployment requirements before setup completion
 */

import { getDeploymentMode, getConfig } from './deployment';
import type { DeploymentValidationResult } from './deployment';

function fetchWithTimeout(url: string, options?: RequestInit, ms = 5000): Promise<Response> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ms);
  return fetch(url, { ...options, signal: ac.signal }).finally(() => clearTimeout(timer));
}

interface ValidationCheckResult {
  passed: boolean;
  message: string;
  severity: 'error' | 'warning' | 'info';
  code: string;
}

interface ComprehensiveValidationResult extends Omit<DeploymentValidationResult, 'status'> {
  status: Record<string, unknown>;
  checks: ValidationCheckResult[];
  totalChecks: number;
  passedChecks: number;
  canProceed: boolean;
}

/**
 * Comprehensive validation matrix for all deployment types
 */
export async function validateFullDeployment(): Promise<ComprehensiveValidationResult> {
  const config = getConfig();
  const mode = getDeploymentMode();
  const checks: ValidationCheckResult[] = [];

  // 1. Onboarding path selected
  checks.push(validateOnboardingPath(config.deploymentStatus));

  // 2. Deployment architecture selected
  checks.push(validateDeploymentArchitecture(config.deploymentStatus));

  // 3. Required URLs configured
  checks.push(...(await validateUrls(config)));

  // 4. API connectivity checks
  checks.push(...(await validateApiConnectivity(config, mode)));

  // 5. Module dependencies
  checks.push(...validateModuleDependencies(config));

  // 6. License validation
  checks.push(await validateLicense(config));

  // 7. Plugin endpoint reachable
  checks.push(await validatePluginEndpoint(config));

  // 8. No PRAG config remains
  checks.push(validateNoPragConfig(config));

  // 9. Content mapping (if Existing WordPress path)
  if (config.deploymentStatus.onboarding_path === 'existing_wordpress') {
    checks.push(await validateContentMapping(config));
  }

  // 10. Frontend adapter setup (if Existing Headless path)
  if (config.deploymentStatus.onboarding_path === 'existing_headless') {
    checks.push(validateFrontendAdapter(config));
  }

  const passedChecks = checks.filter((c) => c.passed).length;
  const canProceed = checks.every((c) => c.severity !== 'error' || c.passed);

  return {
    setupCompleted: canProceed,
    validationPassed: canProceed,
    missingRequirements: checks.filter((c) => !c.passed && c.severity === 'error').map((c) => c.message),
    status: config.deploymentStatus,
    checks,
    totalChecks: checks.length,
    passedChecks,
    canProceed,
  };
}

/**
 * Validate onboarding path selected
 */
function validateOnboardingPath(status: any): ValidationCheckResult {
  const path = status.onboarding_path;
  const validPaths = ['new_build', 'existing_wordpress', 'existing_headless'];

  if (!path || !validPaths.includes(path)) {
    return {
      passed: false,
      message: 'Onboarding path not selected',
      severity: 'error',
      code: 'MISSING_ONBOARDING_PATH',
    };
  }

  return {
    passed: true,
    message: `Onboarding path selected: ${path}`,
    severity: 'info',
    code: 'ONBOARDING_PATH_OK',
  };
}

/**
 * Validate deployment architecture selected
 */
function validateDeploymentArchitecture(status: any): ValidationCheckResult {
  const arch = status.deployment_architecture;

  if (!arch) {
    return {
      passed: false,
      message: 'Deployment architecture not selected',
      severity: 'error',
      code: 'MISSING_ARCHITECTURE',
    };
  }

  return {
    passed: true,
    message: `Architecture selected: ${arch}`,
    severity: 'info',
    code: 'ARCHITECTURE_OK',
  };
}

/**
 * Validate required URLs are configured
 */
async function validateUrls(config: any): Promise<ValidationCheckResult[]> {
  const checks: ValidationCheckResult[] = [];

  // WordPress API URL
  const wpUrl = process.env.NEXT_PUBLIC_WP_API_URL || config.wordPressApiUrl || '';
  checks.push({
    passed: !!wpUrl,
    message: wpUrl ? `WordPress API configured: ${wpUrl}` : 'WordPress API URL not configured',
    severity: wpUrl ? 'info' : 'error',
    code: 'WP_API_URL',
  });

  // Frontend URL (for headless/hybrid)
  if (['headless_next_js', 'hybrid', 'frontend_adapter'].includes(config.deploymentStatus.deployment_architecture || '')) {
    const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || config.frontendUrl || '';
    checks.push({
      passed: !!frontendUrl,
      message: frontendUrl ? `Frontend URL configured: ${frontendUrl}` : 'Frontend URL not configured',
      severity: frontendUrl ? 'info' : 'error',
      code: 'FRONTEND_URL',
    });
  }

  // WooCommerce API URL (if commerce enabled)
  if (config.activeModules?.includes('products') || config.activeModules?.includes('commerce')) {
    const wcUrl = process.env.NEXT_PUBLIC_WOOCOMMERCE_API_URL || config.woocommerceApiUrl || wpUrl;
    checks.push({
      passed: !!wcUrl,
      message: wcUrl ? `WooCommerce API configured` : 'WooCommerce API URL not configured',
      severity: wcUrl ? 'info' : 'warning',
      code: 'WC_API_URL',
    });
  }

  return checks;
}

/**
 * Validate API connectivity
 */
async function validateApiConnectivity(config: any, mode: string): Promise<ValidationCheckResult[]> {
  const checks: ValidationCheckResult[] = [];

  const wpUrl = process.env.NEXT_PUBLIC_WP_API_URL || config.wordPressApiUrl || '';
  if (wpUrl) {
    try {
      const response = await fetchWithTimeout(`${wpUrl}/wp/v2`, { method: 'HEAD' });
      checks.push({
        passed: response.ok || response.status === 405, // 405 is OK for HEAD request
        message: 'WordPress REST API reachable',
        severity: 'info',
        code: 'WP_API_REACHABLE',
      });
    } catch (error) {
      checks.push({
        passed: false,
        message: `WordPress API unreachable: ${(error as Error).message}`,
        severity: 'error',
        code: 'WP_API_UNREACHABLE',
      });
    }
  }

  return checks;
}

/**
 * Validate module dependencies
 */
function validateModuleDependencies(config: any): ValidationCheckResult[] {
  const checks: ValidationCheckResult[] = [];
  const activeModules = config.activeModules || [];

  // Module dependency matrix
  const dependencies: Record<string, string[]> = {
    products: ['commerce'],
    promotions: ['products'],
    landing_pages: ['pages'],
    b2b_quotation: ['commerce'],
    multi_location: [],
  };

  for (const [module, requires] of Object.entries(dependencies)) {
    if (activeModules.includes(module)) {
      for (const required of requires) {
        if (!activeModules.includes(required)) {
          checks.push({
            passed: false,
            message: `Module "${module}" requires "${required}" to be active`,
            severity: 'error',
            code: `MODULE_DEPENDENCY_${module.toUpperCase()}`,
          });
        }
      }
    }
  }

  if (checks.length === 0) {
    checks.push({
      passed: true,
      message: 'Module dependencies satisfied',
      severity: 'info',
      code: 'MODULE_DEPS_OK',
    });
  }

  return checks;
}

/**
 * Validate license key
 */
async function validateLicense(config: any): Promise<ValidationCheckResult> {
  const licenseKey = process.env.MARVEO_LICENSE_KEY || config.licenseKey || '';

  if (!licenseKey) {
    return {
      passed: false,
      message: 'License key not configured',
      severity: 'warning',
      code: 'MISSING_LICENSE',
    };
  }

  // TODO: Add actual license validation against Marveo license server
  return {
    passed: true,
    message: 'License key configured',
    severity: 'info',
    code: 'LICENSE_OK',
  };
}

/**
 * Validate plugin endpoint reachable
 */
async function validatePluginEndpoint(config: any): Promise<ValidationCheckResult> {
  const wpUrl = process.env.NEXT_PUBLIC_WP_API_URL || config.wordPressApiUrl || '';

  if (!wpUrl) {
    return {
      passed: false,
      message: 'Cannot validate plugin endpoint (WP URL not configured)',
      severity: 'warning',
      code: 'PLUGIN_ENDPOINT_UNREACHABLE',
    };
  }

  try {
    const response = await fetchWithTimeout(`${wpUrl}/marveo/v1/status`);
    return {
      passed: response.ok,
      message: response.ok ? 'Plugin endpoint reachable' : 'Plugin endpoint returned error',
      severity: response.ok ? 'info' : 'error',
      code: 'PLUGIN_ENDPOINT_CHECK',
    };
  } catch (error) {
    return {
      passed: false,
      message: `Plugin endpoint unreachable: ${(error as Error).message}`,
      severity: 'error',
      code: 'PLUGIN_ENDPOINT_UNREACHABLE',
    };
  }
}

/**
 * Validate no PRAG config remains
 */
function validateNoPragConfig(config: any): ValidationCheckResult {
  const pragPatterns = [
    'prag.global',
    'central.prag.global',
    'shop.prag.global',
    'prag_store',
    'prag_document',
    'PRAG',
  ];

  const configString = JSON.stringify(config);
  const found = pragPatterns.filter((pattern) => configString.toLowerCase().includes(pattern.toLowerCase()));

  if (found.length > 0) {
    return {
      passed: false,
      message: `Found PRAG-specific configuration: ${found.join(', ')}`,
      severity: 'error',
      code: 'PRAG_CONFIG_FOUND',
    };
  }

  return {
    passed: true,
    message: 'No PRAG-specific configuration found',
    severity: 'info',
    code: 'PRAG_CONFIG_CLEAN',
  };
}

/**
 * Validate content mapping (for Existing WordPress path)
 */
async function validateContentMapping(config: any): Promise<ValidationCheckResult> {
  const wpUrl = process.env.NEXT_PUBLIC_WP_API_URL || config.wordPressApiUrl || '';

  if (!wpUrl) {
    return {
      passed: false,
      message: 'Cannot validate content mapping (WP URL not configured)',
      severity: 'warning',
      code: 'CONTENT_MAPPING_UNCHECKED',
    };
  }

  try {
    const response = await fetchWithTimeout(`${wpUrl}/marveo/v1/content-inventory`);
    if (!response.ok) {
      return {
        passed: false,
        message: 'Content inventory not yet scanned',
        severity: 'warning',
        code: 'CONTENT_NOT_SCANNED',
      };
    }

    const inventory = await response.json();
    const hasMappedContent = inventory.total_count > 0;

    return {
      passed: hasMappedContent,
      message: hasMappedContent ? `Content inventory scanned: ${inventory.total_count} items` : 'No content found',
      severity: hasMappedContent ? 'info' : 'warning',
      code: 'CONTENT_MAPPING_CHECK',
    };
  } catch (error) {
    return {
      passed: false,
      message: `Content mapping check failed: ${(error as Error).message}`,
      severity: 'warning',
      code: 'CONTENT_MAPPING_ERROR',
    };
  }
}

/**
 * Validate frontend adapter setup (for Existing Headless path)
 */
function validateFrontendAdapter(config: any): ValidationCheckResult {
  const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || config.frontendUrl || '';

  if (!frontendUrl) {
    return {
      passed: false,
      message: 'Frontend URL not configured for adapter',
      severity: 'error',
      code: 'ADAPTER_NO_FRONTEND_URL',
    };
  }

  return {
    passed: true,
    message: 'Frontend adapter configured',
    severity: 'info',
    code: 'ADAPTER_OK',
  };
}

export type { ValidationCheckResult, ComprehensiveValidationResult };
