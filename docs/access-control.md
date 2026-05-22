# Access Control System

Marveo implements a strict separation between **CLIENT SETTINGS** and **SYSTEM SETTINGS** to ensure security and proper operational control.

## Table of Contents

- [Overview](#overview)
- [Client Settings](#client-settings)
- [System Settings](#system-settings)
- [Permission Model](#permission-model)
- [Storage Rules](#storage-rules)
- [Examples](#examples)

---

## Overview

### Principle

- **CLIENT SETTINGS**: Business-level configuration that affects user-facing experience
  - Safe for client/business admins to edit
  - Stored in WordPress options (can be backed up/restored)
  - Examples: logo, business name, contact info, content

- **SYSTEM SETTINGS**: Infrastructure and security configuration that controls deployment
  - Only for super admins / system architects
  - Some settings are locked after initial deployment
  - Examples: API URLs, secrets, tokens, deployment mode

### Rule: Tokens Never in WordPress

GitHub and Vercel tokens must NEVER be stored in WordPress options or environment variables loaded from WordPress. They should only exist in:
- Vercel environment variables (for plugin update checks)
- Local `.env` files (never committed)
- Secret management systems (AWS Secrets Manager, HashiCorp Vault)

---

## Client Settings

### Business Profile

**Access**: Client Admins ✓

Fields that client admins can safely edit:

```yaml
Business Profile:
  - Business name
  - Industry
  - Business model (B2C, B2B, Hybrid, Catalogue Only)
  - Country/Currency
  - Contact email
  - Contact phone
  - WhatsApp phone
  - Business address
  - Business hours
  
Location Info:
  - Office locations (for multi-location support)
  - Map coordinates
  - Store hours by location
```

**Storage**: WordPress options → `marveo_settings_business_profile`

**REST Endpoint**: `POST /wp-json/marveo/v1/settings/business_profile`

```json
{
  "business_name": "Your Company",
  "industry": "retail",
  "contact_email": "contact@yourdomain.com",
  "contact_phone": "+1234567890",
  "whatsapp_phone": "+1234567890",
  "business_address": "123 Main St",
  "business_hours": "Mon-Fri 9am-5pm"
}
```

---

### Brand Settings

**Access**: Client Admins ✓

Visual identity that client admins can customize:

```yaml
Brand Settings:
  - Logo (media ID)
  - Favicon (media ID)
  - Primary color (#hex)
  - Secondary color (#hex)
  - Typography (Inter, Poppins, Playfair Display, Open Sans)
  - Header style (Standard, Minimal, With Banner, Sticky)
  - Footer style (Standard, Minimal, Extended, Newsletter Focused)
  - Layout mode (Full Width, Boxed, Grid)
```

**Storage**: WordPress options → `marveo_settings_brand_settings`

**REST Endpoint**: `POST /wp-json/marveo/v1/settings/brand_settings`

```json
{
  "logo": 123,
  "primary_color": "#14B8A6",
  "secondary_color": "#A3E635",
  "typography": "Inter",
  "header_style": "Standard"
}
```

---

### Content Settings

**Access**: Client Admins ✓

User-facing content:

```yaml
Content Settings:
  - Homepage title and subtitle
  - About page content
  - Mission/Vision/Values statements
  - Social links (array)
  - Testimonials (array)
  - Banner text
  - CTA text
```

**Storage**: WordPress options → `marveo_settings_content_settings`

**REST Endpoint**: `POST /wp-json/marveo/v1/settings/content_settings`

```json
{
  "homepage_title": "Welcome to Our Store",
  "homepage_subtitle": "Quality products for everyone",
  "mission": "To serve our customers with integrity",
  "social_links": [
    { "platform": "facebook", "url": "https://facebook.com/..." },
    { "platform": "instagram", "url": "https://instagram.com/..." }
  ]
}
```

---

### Commerce Settings

**Access**: Client Admins (mostly) ✓

Sales and commerce configuration:

```yaml
Commerce Settings:
  - Checkout mode (Native WooCommerce, External, Enquiry Only, Quote Request)
  - Product source (WooCommerce, Custom Post Type, External API)
  - Currency code (USD, EUR, GBP, etc.)
  - Tax configuration (read-only from WooCommerce)
  - Shipping information
  - Payment methods accepted
```

**Storage**: WordPress options → `marveo_settings_commerce_settings`

**REST Endpoint**: `POST /wp-json/marveo/v1/settings/commerce_settings`

```json
{
  "checkout_mode": "Native WooCommerce",
  "currency": "USD",
  "shipping_info": "Free shipping on orders over $100",
  "payment_methods": "Credit Card, PayPal, Apple Pay"
}
```

---

### SEO Settings

**Access**: Client Admins ✓

Search engine optimization:

```yaml
SEO Settings:
  - Site title
  - Site description
  - Site keywords
  - Analytics IDs (Google Analytics, Meta Pixel)
  - Search Console verification
  - Robots.txt content
  - Sitemap enabled/disabled
```

**Storage**: WordPress options → `marveo_settings_seo_settings`

**REST Endpoint**: `POST /wp-json/marveo/v1/settings/seo_settings`

```json
{
  "site_title": "Your Store - Quality Products",
  "google_analytics": "G-XXXXXXXXXX",
  "meta_pixel": "123456789",
  "sitemap_enabled": true
}
```

---

## System Settings

### Advanced/System Configuration

**Access**: Super Admins Only 🔐

Infrastructure and security settings (mostly locked after deployment):

```yaml
Advanced Settings:
  Locked (Cannot change after deployment):
    - Deployment mode (wordpress | headless | hybrid)
    - Onboarding path (new_build | existing_wordpress | existing_headless)
    - Deployment architecture
    - API URL
    - Revalidation secret
    - License key
  
  Editable by Super Admin:
    - Frontend URL (for headless mode)
    - Update channel (stable | beta | development)
    - Debug mode (on/off)
```

**Storage**: WordPress options → `marveo_settings_advanced_settings`

**Permission Check**: `is_super_admin()`

**REST Endpoint**: `POST /wp-json/marveo/v1/settings/advanced_settings`

```json
{
  "frontend_url": "https://yourdomain.com",
  "update_channel": "stable",
  "debug_mode": false
}
```

---

### Module Settings

**Access**: Super Admins Only 🔐

Feature flags and module enablement:

```yaml
Module Settings:
  - Active modules (array of module names)
  - Feature flags (conditional features)
  - Module dependencies validation
```

**Storage**: WordPress options → `marveo_settings_module_settings`

**Permission Check**: `is_super_admin()`

**REST Endpoint**: `POST /wp-json/marveo/v1/settings/module_settings`

```json
{
  "active_modules": ["products", "blog", "pages", "newsletter", "analytics", "seo"],
  "feature_flags": {
    "experimental_ai_content": false,
    "advanced_inventory": true
  }
}
```

---

### Integration Settings

**Access**: Super Admins Only 🔐

Third-party integrations and webhooks:

```yaml
Integration Settings:
  - CRM webhook URL (encrypted)
  - Email provider (sendgrid | mailgun | aws | wordpress)
  - Email API key (encrypted, super admin only)
  - Slack webhook URL (encrypted)
  - Custom webhooks (array)
```

**Storage**: WordPress options (encrypted) → `marveo_settings_integration_settings`

**Permission Check**: `is_super_admin()`

**Encryption**: Use WordPress `wp_hash` for sensitive values

**REST Endpoint**: `POST /wp-json/marveo/v1/settings/integration_settings`

```json
{
  "crm_webhook_url": "https://crm.example.com/webhooks/leads",
  "email_provider": "sendgrid",
  "email_api_key": "<encrypted>",
  "slack_webhook": "<encrypted>"
}
```

---

## Permission Model

### Roles and Capabilities

```
┌─────────────────────────────────────────────────────────┐
│                   WordPress User                        │
└─────────────────────────────────────────────────────────┘

                            ↓

        ┌───────────────────┴───────────────────┐
        ↓                                       ↓
    Editor                                 Administrator
    └─ Can edit client settings         └─ Can edit client AND system settings
       └─ Business profile                  └─ Can change deployment options
       └─ Brand settings                    └─ Can manage modules
       └─ Content (pages/posts/etc)        └─ Can configure integrations
       └─ SEO settings                      └─ Can view licenses
       └─ Commerce info                     └─ Can perform migrations

                            ↓

                      Super Admin
                      └─ ONLY role allowed to:
                         └─ Change deployment mode (locked after init)
                         └─ Rotate revalidation secret
                         └─ Update API credentials
                         └─ Access license management
                         └─ View system logs
```

### Endpoint Permission Checks

All Marveo REST endpoints check permissions:

```php
// /wp-json/marveo/v1/settings/{group}

// For CLIENT settings (business_profile, brand_settings, etc.)
if (current_user_can('manage_options')) {
    return true; // Admins and Super Admins can edit
}

// For SYSTEM settings (advanced_settings, module_settings, integrations)
if ($group === 'advanced_settings' || $group === 'integration_settings' || $group === 'module_settings') {
    return is_super_admin(); // ONLY Super Admins
}

// Otherwise: Forbidden
return false;
```

---

## Storage Rules

### Where Sensitive Data Goes

```
┌─────────────────────────────────────────┐
│          Sensitive/Infrastructure       │
├─────────────────────────────────────────┤
│ GitHub Token              → Vercel env   │
│ Revalidation Secret       → Vercel env   │
│ API Credentials           → .env.local   │
│ License Key               → Vercel env   │
│ Webhook URLs              → DB (enc)     │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│      Business / Public Config           │
├─────────────────────────────────────────┤
│ Logo                      → WP Media     │
│ Business Name             → WP Options   │
│ Contact Email             → WP Options   │
│ Colors/Typography         → WP Options   │
│ Homepage Content          → WP Options   │
└─────────────────────────────────────────┘
```

### Encryption for Sensitive Options

Sensitive strings stored in WordPress options should be encrypted:

```php
// When saving
$encrypted = wp_hash('value' . AUTH_KEY);
update_option('marveo_sensitive_value', $encrypted);

// When retrieving
$value = get_option('marveo_sensitive_value');
$decrypted = wp_hash('value' . AUTH_KEY); // Must match
```

### What's Safe to Check Into Git

```
✓ ALLOWED in git:
  - .env.example (template only, no real values)
  - Code for client settings UI
  - Documentation
  - Type definitions

✗ NEVER in git:
  - .env or .env.local
  - .env.production
  - Any file with real API keys
  - Vercel deployment logs
```

---

## Examples

### Example 1: Client Admin Editing Brand

```typescript
// Frontend: Client admin clicks "Edit Brand"
// Permission: Editor role (manage_options)

async function updateBrand(colors) {
  const response = await fetch(
    '/wp-json/marveo/v1/settings/brand_settings',
    {
      method: 'POST',
      headers: { 'X-WP-Nonce': wpNonce },
      body: JSON.stringify({
        primary_color: '#FF6B6B',
        secondary_color: '#FFD93D'
      })
    }
  );
  
  // Result: Colors updated, stored in wp_options
  // Next.js app fetches via getCachedConfig() and rerenders
}
```

### Example 2: Super Admin Enabling New Module

```typescript
// Admin clicks "Enable Products Module"
// Permission: is_super_admin()
// Validation: Check dependencies satisfied

async function enableModule(moduleName) {
  // First validate dependencies
  const validation = await fetch('/wp-json/marveo/v1/modules/validate', {
    method: 'POST',
    body: JSON.stringify({ modules: [...currentModules, moduleName] })
  });
  
  if (!validation.ok) {
    // Show error about missing dependencies
    return;
  }
  
  // Then update module settings
  const response = await fetch(
    '/wp-json/marveo/v1/settings/module_settings',
    {
      method: 'POST',
      body: JSON.stringify({
        active_modules: [...currentModules, moduleName]
      })
    }
  );
  
  // Only Super Admin can execute this
}
```

### Example 3: Attempting Unauthorized Access

```typescript
// Non-super-admin tries to change deployment mode

const response = await fetch(
  '/wp-json/marveo/v1/settings/advanced_settings',
  {
    method: 'POST',
    body: JSON.stringify({
      deployment_mode: 'headless' // Not allowed!
    })
  }
);

// Result: 403 Forbidden (not is_super_admin())
// Error: "Insufficient permissions"
```

### Example 4: Storing GitHub Token (WRONG)

```bash
# WRONG - Never store in WordPress!
wp option update marveo_github_token 'ghp_xxxxxxxx'

# RIGHT - Only in Vercel
# 1. Go to Vercel project settings
# 2. Environment Variables
# 3. Add: GITHUB_PLUGIN_UPDATES_TOKEN = ghp_xxxxxxxx
# 4. Scope to "Production" only
```

---

## Migration from Legacy Deployments

Legacy deployments may have limited access control. When migrating:

1. **Detect legacy settings** in WordPress options
2. **Map to new permission model**:
  - Legacy settings → Client settings (Business Profile, Brand, Content)
  - Legacy API URLs → System settings (Locked)
3. **Create backup** of old options before migration
4. **Set super admin flag** on primary account for system settings access
5. **Document for client** which team members should be Admins vs Super Admins

---

## Best Practices

✓ **DO**:
- Use Strong password and two-factor authentication
- Rotate revalidation secret regularly
- Use app passwords instead of login passwords for API access
- Audit who has super admin access
- Enable WordPress activity logs
- Backup before major changes
- Test in staging before production

✗ **DON'T**:
- Share super admin credentials
- Commit API keys to git
- Use login password for API access
- Allow non-super-admin to manage modules
- Store GitHub tokens in WordPress
- Leave debug mode enabled in production
- Keep old API credentials when migrating

---

## See Also

- [Deployment Modes](./deployment.md)
- [Module System](./modules.md)
- [Security Guide](./security.md)
