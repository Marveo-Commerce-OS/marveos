/**
 * Marvéo Connector Service
 * Handles communication with the WordPress Marvéo Connector plugin
 */

interface ConnectorStatus {
  status: string;
  connector_version: string;
  site_id: string;
  wordpress_version: string;
  woocommerce_version: string | null;
  jwt_enabled: boolean;
  first_admin_created: boolean;
}

interface SiteInfo {
  site_url: string;
  site_name: string;
  admin_email: string;
  woocommerce_installed: boolean;
  active_plugins: string[];
  multisite: boolean;
}

interface InitAdminPayload {
  username: string;
  email: string;
  password: string;
}

interface InitAdminResponse {
  success: boolean;
  user_id: number;
  message: string;
}

interface ConnectorError {
  code: string;
  message: string;
  details?: string;
}

/**
 * Normalize WordPress site URL (ensure trailing slash, valid protocol)
 */
function normalizeSiteUrl(url: string): string {
  let normalized = url.trim();

  // Add protocol if missing
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = 'https://' + normalized;
  }

  // Remove trailing slash for consistency
  if (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }

  return normalized;
}

/**
 * Parse error response from WordPress REST API
 */
function parseErrorResponse(data: any): ConnectorError {
  const code = data?.code || 'unknown_error';
  const message = data?.message || 'An unknown error occurred';
  const details = data?.data?.details || undefined;

  return { code, message, details };
}

/**
 * Check connector status on WordPress site
 * GET /wp-json/marveo/v1/status
 */
export async function checkConnectorStatus(
  siteUrl: string
): Promise<ConnectorStatus | ConnectorError> {
  try {
    const url = new URL(
      '/wp-json/marveo/v1/status',
      normalizeSiteUrl(siteUrl)
    );

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return parseErrorResponse(data);
    }

    return data as ConnectorStatus;
  } catch (error) {
    if (error instanceof TypeError) {
      return {
        code: 'network_error',
        message: 'Unable to reach the WordPress site. Please check the URL.',
        details: error.message,
      };
    }

    return {
      code: 'unknown_error',
      message: 'An unexpected error occurred',
      details: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Get site info from WordPress site
 * GET /wp-json/marveo/v1/site-info (requires JWT token)
 */
export async function getSiteInfo(
  siteUrl: string,
  jwtToken?: string
): Promise<SiteInfo | ConnectorError> {
  try {
    const url = new URL(
      '/wp-json/marveo/v1/site-info',
      normalizeSiteUrl(siteUrl)
    );

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (jwtToken) {
      headers['Authorization'] = `Bearer ${jwtToken}`;
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      return parseErrorResponse(data);
    }

    return data as SiteInfo;
  } catch (error) {
    if (error instanceof TypeError) {
      return {
        code: 'network_error',
        message: 'Unable to reach the WordPress site. Please check the URL.',
        details: error.message,
      };
    }

    return {
      code: 'unknown_error',
      message: 'An unexpected error occurred',
      details: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Initialize first admin user
 * POST /wp-json/marveo/v1/init-admin
 */
export async function initializeAdmin(
  siteUrl: string,
  activationToken: string,
  payload: InitAdminPayload
): Promise<InitAdminResponse | ConnectorError> {
  try {
    const url = new URL('/wp-json/marveo/v1/init-admin', normalizeSiteUrl(siteUrl));

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Marveo-Activation-Token': activationToken,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      return parseErrorResponse(data);
    }

    return data as InitAdminResponse;
  } catch (error) {
    if (error instanceof TypeError) {
      return {
        code: 'network_error',
        message: 'Unable to reach the WordPress site. Please check the URL.',
        details: error.message,
      };
    }

    return {
      code: 'unknown_error',
      message: 'An unexpected error occurred',
      details: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * User-friendly error messages
 */
export function getErrorMessage(error: ConnectorError): string {
  switch (error.code) {
    case 'network_error':
      return 'Cannot reach the WordPress site. Check the URL and try again.';

    case 'missing_token':
      return 'Activation token is missing. Please provide a valid token.';

    case 'invalid_token_format':
      return 'Invalid token format. Tokens should be alphanumeric strings.';

    case 'invalid_or_expired_token':
      return 'The activation token is invalid or has expired. Generate a new one in WordPress.';

    case 'admin_exists':
      return 'The first admin user has already been created for this site.';

    case 'missing_fields':
      return 'Please fill in all required fields correctly.';

    case 'invalid_email':
      return 'Please provide a valid email address.';

    case 'invalid_username':
      return 'Username must be at least 3 characters long.';

    case 'weak_password':
      return 'Password must be at least 8 characters long.';

    case 'user_creation_failed':
      return 'Failed to create user. This user may already exist.';

    case 'rest_no_route':
      return 'The Marvéo Connector plugin is not installed on this WordPress site.';

    case 'forbidden':
      return 'You do not have permission to set up this connector.';

    case 'unauthorized':
      return 'Authentication failed. Please verify your token and try again.';

    default:
      return error.message || 'An unexpected error occurred. Please try again.';
  }
}
