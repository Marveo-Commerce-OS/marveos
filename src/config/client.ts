/**
 * Client Configuration Layer
 * Centralizes all environment-based configuration to avoid scattering process.env across components.
 * This ensures consistency and makes it easy to adjust settings per deployment.
 */

export type DeploymentMode = 'wordpress' | 'headless';
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
 * Parse comma-separated module list from environment variable
 */
function parseActiveModules(modulesString: string | undefined): string[] {
  if (!modulesString) return [];
  return modulesString
    .split(',')
    .map((m) => m.trim())
    .filter((m) => m.length > 0);
}

/**
 * Validate deployment mode
 */
function validateDeploymentMode(mode: string | undefined): DeploymentMode {
  const validModes: DeploymentMode[] = ['wordpress', 'headless'];
  if (!mode || !validModes.includes(mode as DeploymentMode)) {
    return 'wordpress'; // default
  }
  return mode as DeploymentMode;
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
  const activeModulesString = process.env.ACTIVE_MODULES;
  const activeModules = parseActiveModules(activeModulesString);

  const config: MarveoConfig = {
    // Application Identity
    appName: process.env.NEXT_PUBLIC_APP_NAME || 'Marvéo',
    clientName: process.env.NEXT_PUBLIC_CLIENT_NAME || 'My Store',
    clientLogo: process.env.NEXT_PUBLIC_CLIENT_LOGO,
    clientPrimaryColor: process.env.NEXT_PUBLIC_CLIENT_PRIMARY_COLOR || '#14B8A6',
    clientSecondaryColor: process.env.NEXT_PUBLIC_CLIENT_SECONDARY_COLOR || '#A3E635',
    brandByline: process.env.NEXT_PUBLIC_BRAND_BYLINE || 'A product by Avario Digital Products',

    // Deployment Configuration
    deploymentMode: validateDeploymentMode(process.env.MARVEO_DEPLOYMENT_MODE),
    environment: validateEnvironment(process.env.NEXT_PUBLIC_ENVIRONMENT),

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

export default getConfig;
