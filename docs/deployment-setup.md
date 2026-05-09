# Deployment Setup

Marvéo now uses a deployment profile instead of assuming a single client shape. A deployment is not complete until the selected mode has been saved and validated.

## Deployment Modes

### `headless`
Use this when WordPress/WooCommerce are the backend and Next.js/Vercel is the frontend.

Required:
- Frontend URL
- WordPress API URL
- WooCommerce API URL
- Revalidation secret
- WooCommerce API credentials
- Brand profile
- Active modules

### `wordpress`
Use this when WordPress handles the frontend, CMS, WooCommerce, checkout, and admin.

Required:
- WordPress site URL
- WooCommerce status
- Brand profile
- Active modules

## Deployment Status Object

```json
{
  "mode": "headless",
  "setup_completed": false,
  "validation_passed": false,
  "missing_requirements": [],
  "active_modules": [],
  "client_profile": {},
  "last_validated_at": null
}
```

## Required Environment Variables

### Shared
- `NEXT_PUBLIC_APP_NAME`
- `NEXT_PUBLIC_CLIENT_NAME`
- `NEXT_PUBLIC_CLIENT_PRIMARY_COLOR`
- `NEXT_PUBLIC_CLIENT_SECONDARY_COLOR`
- `NEXT_PUBLIC_BRAND_BYLINE`
- `LICENSE_KEY`

### Headless Only
- `NEXT_PUBLIC_FRONTEND_URL`
- `WORDPRESS_API_URL`
- `WOOCOMMERCE_API_URL`
- `MARVEO_REVALIDATION_SECRET`
- `WOOCOMMERCE_CONSUMER_KEY`
- `WOOCOMMERCE_CONSUMER_SECRET`

### WordPress Only
- No Next.js frontend variables are required.
- `NEXT_PUBLIC_FRONTEND_URL` is optional.
- WordPress and WooCommerce settings are validated from the site and saved profile.

## System Settings

These are system-level settings and should not be shown as secrets in the plugin UI:
- Deployment mode
- API URLs
- API keys
- Webhook secrets
- Revalidation secret
- License key
- Plugin update settings
- Active modules
- Feature flags

The GitHub update token must only live in Vercel as `GITHUB_PLUGIN_UPDATES_TOKEN`.

## Migration Notes for Legacy Deployments

Legacy client profiles remain supported, but no client is hardcoded into the runtime.

Migration steps:
1. Set the deployment mode explicitly to `wordpress` or `headless`.
2. Fill the business profile and brand settings.
3. Save the deployment profile in the WordPress plugin.
4. Validate the deployment profile until `validation_passed` becomes `true`.
5. Confirm the plugin update feed and package download are reachable.
6. Move any remaining client-specific values into client configuration or environment variables.

## Deployment Rule

No deployment should be considered complete until:
1. The mode is selected.
2. The profile is saved.
3. Validation passes.
4. The deployment status object shows no missing requirements.
