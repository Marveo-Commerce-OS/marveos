export type DeploymentMode = 'wordpress' | 'headless';

export type BusinessModel = 'B2C' | 'B2B' | 'Hybrid' | 'Catalogue Only' | 'Enquiry Only';

export type CheckoutMode = 'Native WooCommerce' | 'External checkout' | 'Enquiry only' | 'Quote request';

export type ProductSource = 'WooCommerce' | 'Custom post type' | 'External API';

export interface DeploymentClientProfile {
  businessName: string;
  industry: string;
  businessModel: BusinessModel;
  countryCurrency: string;
  contactEmail: string;
  whatsappPhone: string;
}

export interface DeploymentBrandProfile {
  logo?: string;
  favicon?: string;
  primaryColor: string;
  secondaryColor: string;
  typography: string;
  headerFooterStyle: string;
}

export interface DeploymentCommerceProfile {
  woocommerceEnabled: boolean;
  checkoutMode: CheckoutMode;
  productSource: ProductSource;
  taxShippingPaymentStatus: string;
}

export interface DeploymentIntegrationProfile {
  googleAnalytics?: string;
  metaPixel?: string;
  searchConsole?: string;
  crmWebhook?: string;
  emailProvider?: string;
  paymentGatewayStatus?: string;
  apiCredentialsStatus?: string;
}

export interface DeploymentStatus {
  mode: DeploymentMode;
  setup_completed: boolean;
  validation_passed: boolean;
  missing_requirements: string[];
  active_modules: string[];
  client_profile: DeploymentClientProfile;
  last_validated_at: string | null;
}

export interface DeploymentRequirements {
  mode: DeploymentMode;
  requiredEnvVars: string[];
  optionalEnvVars: string[];
  requiredWordPressSettings: string[];
}

export interface DeploymentValidationResult {
  setupCompleted: boolean;
  validationPassed: boolean;
  missingRequirements: string[];
  status: DeploymentStatus;
}

function readEnv(key: string): string {
  return (process.env[key] || '').trim();
}

function parseActiveModules(rawValue: string): string[] {
  return rawValue
    .split(',')
    .map((moduleName) => moduleName.trim())
    .filter(Boolean);
}

export function getDeploymentMode(): DeploymentMode {
  const value = readEnv('MARVEO_DEPLOYMENT_MODE');
  return value === 'headless' ? 'headless' : 'wordpress';
}

export function getClientProfile(): DeploymentClientProfile {
  return {
    businessName: readEnv('NEXT_PUBLIC_CLIENT_NAME') || 'My Store',
    industry: readEnv('NEXT_PUBLIC_CLIENT_INDUSTRY') || 'General',
    businessModel: (readEnv('NEXT_PUBLIC_BUSINESS_MODEL') as BusinessModel) || 'Hybrid',
    countryCurrency: readEnv('NEXT_PUBLIC_COUNTRY_CURRENCY') || 'USD',
    contactEmail: readEnv('NEXT_PUBLIC_CONTACT_EMAIL') || '',
    whatsappPhone: readEnv('NEXT_PUBLIC_WHATSAPP_PHONE') || '',
  };
}

export function getBrandProfile() {
  return {
    logo: readEnv('NEXT_PUBLIC_CLIENT_LOGO') || undefined,
    favicon: readEnv('NEXT_PUBLIC_CLIENT_FAVICON') || undefined,
    primaryColor: readEnv('NEXT_PUBLIC_CLIENT_PRIMARY_COLOR') || '#14B8A6',
    secondaryColor: readEnv('NEXT_PUBLIC_CLIENT_SECONDARY_COLOR') || '#A3E635',
    typography: readEnv('NEXT_PUBLIC_CLIENT_TYPOGRAPHY') || 'Inter',
    headerFooterStyle: readEnv('NEXT_PUBLIC_CLIENT_LAYOUT_STYLE') || 'Standard',
  };
}

export function getCommerceProfile(): DeploymentCommerceProfile {
  return {
    woocommerceEnabled: readEnv('WOOCOMMERCE_ENABLED') !== 'false',
    checkoutMode: (readEnv('NEXT_PUBLIC_CHECKOUT_MODE') as CheckoutMode) || 'Native WooCommerce',
    productSource: (readEnv('NEXT_PUBLIC_PRODUCT_SOURCE') as ProductSource) || 'WooCommerce',
    taxShippingPaymentStatus: readEnv('NEXT_PUBLIC_TAX_SHIPPING_PAYMENT_STATUS') || 'unchecked',
  };
}

export function getIntegrationProfile(): DeploymentIntegrationProfile {
  return {
    googleAnalytics: readEnv('NEXT_PUBLIC_GOOGLE_ANALYTICS_ID') || undefined,
    metaPixel: readEnv('NEXT_PUBLIC_META_PIXEL_ID') || undefined,
    searchConsole: readEnv('NEXT_PUBLIC_SEARCH_CONSOLE_ID') || undefined,
    crmWebhook: readEnv('CRM_WEBHOOK_URL') || undefined,
    emailProvider: readEnv('NEXT_PUBLIC_EMAIL_PROVIDER') || undefined,
    paymentGatewayStatus: readEnv('NEXT_PUBLIC_PAYMENT_GATEWAY_STATUS') || undefined,
    apiCredentialsStatus: readEnv('NEXT_PUBLIC_API_CREDENTIALS_STATUS') || undefined,
  };
}

export function getActiveModules(): string[] {
  return parseActiveModules(readEnv('ACTIVE_MODULES'));
}

export function getDeploymentRequirements(mode: DeploymentMode): DeploymentRequirements {
  const baseRequiredEnvVars = [
    'NEXT_PUBLIC_APP_NAME',
    'NEXT_PUBLIC_CLIENT_NAME',
    'NEXT_PUBLIC_CLIENT_PRIMARY_COLOR',
    'NEXT_PUBLIC_CLIENT_SECONDARY_COLOR',
    'NEXT_PUBLIC_BRAND_BYLINE',
    'LICENSE_KEY',
  ];

  if (mode === 'headless') {
    return {
      mode,
      requiredEnvVars: [
        ...baseRequiredEnvVars,
        'NEXT_PUBLIC_FRONTEND_URL',
        'WORDPRESS_API_URL',
        'WOOCOMMERCE_API_URL',
        'MARVEO_REVALIDATION_SECRET',
        'WOOCOMMERCE_CONSUMER_KEY',
        'WOOCOMMERCE_CONSUMER_SECRET',
      ],
      optionalEnvVars: [
        'NEXT_PUBLIC_CLIENT_LOGO',
        'NEXT_PUBLIC_CLIENT_FAVICON',
        'NEXT_PUBLIC_CLIENT_TYPOGRAPHY',
        'NEXT_PUBLIC_CLIENT_LAYOUT_STYLE',
        'NEXT_PUBLIC_GOOGLE_ANALYTICS_ID',
        'NEXT_PUBLIC_META_PIXEL_ID',
        'NEXT_PUBLIC_SEARCH_CONSOLE_ID',
        'CRM_WEBHOOK_URL',
        'NEXT_PUBLIC_EMAIL_PROVIDER',
        'NEXT_PUBLIC_PAYMENT_GATEWAY_STATUS',
        'NEXT_PUBLIC_API_CREDENTIALS_STATUS',
        'ACTIVE_MODULES',
      ],
      requiredWordPressSettings: [
        'siteurl',
        'home',
        'blogname',
      ],
    };
  }

  return {
    mode,
    requiredEnvVars: baseRequiredEnvVars,
    optionalEnvVars: [
      'NEXT_PUBLIC_FRONTEND_URL',
      'WORDPRESS_API_URL',
      'WOOCOMMERCE_API_URL',
      'NEXT_PUBLIC_CLIENT_LOGO',
      'NEXT_PUBLIC_CLIENT_FAVICON',
      'NEXT_PUBLIC_CLIENT_TYPOGRAPHY',
      'NEXT_PUBLIC_CLIENT_LAYOUT_STYLE',
      'NEXT_PUBLIC_GOOGLE_ANALYTICS_ID',
      'NEXT_PUBLIC_META_PIXEL_ID',
      'NEXT_PUBLIC_SEARCH_CONSOLE_ID',
      'CRM_WEBHOOK_URL',
      'NEXT_PUBLIC_EMAIL_PROVIDER',
      'NEXT_PUBLIC_PAYMENT_GATEWAY_STATUS',
      'NEXT_PUBLIC_API_CREDENTIALS_STATUS',
      'ACTIVE_MODULES',
    ],
    requiredWordPressSettings: [
      'siteurl',
      'home',
      'blogname',
    ],
  };
}

export function validateDeploymentConfiguration(mode: DeploymentMode = getDeploymentMode()): DeploymentValidationResult {
  const clientProfile = getClientProfile();
  const activeModules = getActiveModules();
  const requirements = getDeploymentRequirements(mode);
  const missingRequirements: string[] = [];

  for (const envVar of requirements.requiredEnvVars) {
    if (!readEnv(envVar)) {
      missingRequirements.push(`Missing env var: ${envVar}`);
    }
  }

  if (!clientProfile.businessName) {
    missingRequirements.push('Missing client business name');
  }

  if (!clientProfile.contactEmail) {
    missingRequirements.push('Missing client contact email');
  }

  if (mode === 'headless') {
    if (!readEnv('NEXT_PUBLIC_FRONTEND_URL')) {
      missingRequirements.push('Missing frontend URL for headless mode');
    }

    if (!readEnv('WORDPRESS_API_URL')) {
      missingRequirements.push('Missing WordPress API URL for headless mode');
    }

    if (!readEnv('WOOCOMMERCE_API_URL')) {
      missingRequirements.push('Missing WooCommerce API URL for headless mode');
    }

    if (!readEnv('MARVEO_REVALIDATION_SECRET')) {
      missingRequirements.push('Missing revalidation secret for headless mode');
    }
  }

  const validationPassed = missingRequirements.length === 0;
  const setupCompleted = validationPassed && activeModules.length >= 0;

  return {
    setupCompleted,
    validationPassed,
    missingRequirements,
    status: {
      mode,
      setup_completed: setupCompleted,
      validation_passed: validationPassed,
      missing_requirements: missingRequirements,
      active_modules: activeModules,
      client_profile: clientProfile,
      last_validated_at: validationPassed ? new Date().toISOString() : null,
    },
  };
}
