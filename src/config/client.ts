/**
 * Client Configuration Layer
 * Centralizes all environment-based configuration to avoid scattering process.env across components.
 * This ensures consistency and makes it easy to adjust settings per deployment.
 */

import {
  getActiveModules,
  getBrandProfile,
  getClientProfile,
  getCommerceProfile,
  getDeploymentMode,
  getDeploymentRequirements,
  getIntegrationProfile,
  validateDeploymentConfiguration,
  type DeploymentMode,
  type DeploymentStatus,
} from '@/src/config/deployment';

export type Environment = 'development' | 'staging' | 'production';

export interface MarveoConfig {
  // Application Identity
  appName: string;
  clientName: string;
  clientLogo: string | undefined;
  clientPrimaryColor: string;
  clientSecondaryColor: string;
  brandByline: string;

  // Deployment Configuration
  deploymentMode: DeploymentMode;
  environment: Environment;
  deploymentStatus: DeploymentStatus;
  deploymentRequirements: ReturnType<typeof getDeploymentRequirements>;

  // Profiles
  clientProfile: ReturnType<typeof getClientProfile>;
  brandProfile: ReturnType<typeof getBrandProfile>;
  commerceProfile: ReturnType<typeof getCommerceProfile>;
  integrationProfile: ReturnType<typeof getIntegrationProfile>;

  // URLs
  frontendUrl: string | undefined;
  wordpressApiUrl: string | undefined;
  woocommerceApiUrl: string | undefined;
  wordpressAdminUrl: string | undefined;
  wordpressMediaUrl: string | undefined;

  // API Credentials
  woocommerceConsumerKey: string | undefined;
  woocommerceConsumerSecret: string | undefined;

  // Modules & Features
  activeModules: string[];
  licenseKey: string | undefined;

  // Helpers
  isModuleEnabled(moduleName: string): boolean;
}

/**
 * Validate environment
 */
function validateEnvironment(env: string | undefined): Environment {
  const validEnvs: Environment[] = ['development', 'staging', 'production'];
  if (!env || !validEnvs.includes(env as Environment)) {
    return 'development'; // default
  }
  return env as Environment;
}

/**
 * Get Marvéo configuration from environment variables
 */
export function getConfig(): MarveoConfig {
  const deploymentMode = getDeploymentMode();
  const deploymentRequirements = getDeploymentRequirements(deploymentMode);
  const deploymentValidation = validateDeploymentConfiguration(deploymentMode);
  const activeModules = getActiveModules();
  const clientProfile = getClientProfile();
  const brandProfile = getBrandProfile();
  const commerceProfile = getCommerceProfile();
  const integrationProfile = getIntegrationProfile();

  const config: MarveoConfig = {
    // Application Identity
    appName: process.env.NEXT_PUBLIC_APP_NAME || 'Marvéo',
    clientName: process.env.NEXT_PUBLIC_CLIENT_NAME || 'My Store',
    clientLogo: process.env.NEXT_PUBLIC_CLIENT_LOGO,
    clientPrimaryColor: process.env.NEXT_PUBLIC_CLIENT_PRIMARY_COLOR || '#14B8A6',
    clientSecondaryColor: process.env.NEXT_PUBLIC_CLIENT_SECONDARY_COLOR || '#A3E635',
    brandByline: process.env.NEXT_PUBLIC_BRAND_BYLINE || 'A product by Avario Digital Products',

    // Deployment Configuration
    deploymentMode,
    environment: validateEnvironment(process.env.NEXT_PUBLIC_ENVIRONMENT),
    deploymentStatus: deploymentValidation.status,
    deploymentRequirements,

    // Profiles
    clientProfile,
    brandProfile,
    commerceProfile,
    integrationProfile,

    // URLs
    frontendUrl: process.env.NEXT_PUBLIC_FRONTEND_URL,
    wordpressApiUrl: process.env.WORDPRESS_API_URL || process.env.NEXT_PUBLIC_WP_API_URL,
    woocommerceApiUrl: process.env.WOOCOMMERCE_API_URL,
    wordpressAdminUrl: process.env.WORDPRESS_ADMIN_URL,
    wordpressMediaUrl: process.env.WORDPRESS_MEDIA_URL,

    // API Credentials (server-side only)
    woocommerceConsumerKey: process.env.WOOCOMMERCE_CONSUMER_KEY,
    woocommerceConsumerSecret: process.env.WOOCOMMERCE_CONSUMER_SECRET,

    // Modules & Features
    activeModules,
    licenseKey: process.env.LICENSE_KEY,

    // Module helper
    isModuleEnabled(moduleName: string): boolean {
      return activeModules.includes(moduleName);
    },
  };

  return config;
}

/**
 * Singleton config instance (for server components)
 */
let configInstance: MarveoConfig | null = null;

export function getCachedConfig(): MarveoConfig {
  if (!configInstance) {
    configInstance = getConfig();
  }
  return configInstance;
}

export function clearCachedConfig(): void {
  configInstance = null;
}

export default getConfig;
