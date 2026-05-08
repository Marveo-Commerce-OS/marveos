# Marvéo Connector Plugin Specification

The **Marvéo Connector** is a WordPress plugin that bridges WordPress/WooCommerce with the Marvéo operations platform. This plugin enables secure communication, data synchronization, and first-time setup between WordPress and Marvéo.

## Overview

| Aspect | Details |
|--------|---------|
| **Plugin Name** | Marvéo Connector |
| **Plugin Slug** | `marveo-connector` |
| **Main File** | `marveo-connector.php` |
| **Repository** | (separate repo - to be created) |
| **Minimum WP** | 5.9+ |
| **Requires PHP** | 7.4+ |
| **License** | GPL-2.0-or-later |

## Core Functionality

### 1. Plugin Activation Flow

When the plugin is activated for the first time, it:

1. **Creates Activation Token**
   - Generates a 32-character random token
   - Stores in `wp_options` table as `marveo_activation_token` with 24-hour expiry
   - This token is single-use and consumed upon first Marvéo admin account creation

2. **Stores Setup Metadata**
   - `marveo_activated_at` — timestamp of activation
   - `marveo_version` — plugin version
   - `marveo_site_id` — unique identifier for this WordPress installation
   - `marveo_connector_status` — 'pending_setup' → 'active'

3. **Creates WordPress User Account** (Optional - based on setup approach)
   - Username: `marveo_system`
   - Email: from site admin email
   - Role: Super Admin (on multisite) or Administrator (single site)
   - Password: randomly generated, shown once on admin notice

### 2. JWT Authentication Endpoint

**Already in WordPress:** The plugin requires the `JWT Authentication` plugin or `wp-json-basic-auth` to be active.

Marvéo connects via:
```
POST /wp-json/jwt-auth/v1/token
Content-Type: application/json

{
  "username": "user",
  "password": "pass"
}
```

The plugin ensures that only authorized users (Administrator or Shop Manager roles) can obtain JWT tokens for Marvéo access.

### 3. Configuration REST Endpoints

The plugin exposes these REST endpoints (all require authentication):

#### Get Connector Status
```
GET /wp-json/marveo/v1/status
Authorization: Bearer {token}

Response:
{
  "status": "active",
  "connector_version": "1.0.0",
  "site_id": "12345abcde",
  "wordpress_version": "6.4",
  "woocommerce_version": "8.3.1",
  "jwt_enabled": true,
  "first_admin_created": true
}
```

#### Get Site Info
```
GET /wp-json/marveo/v1/site-info
Authorization: Bearer {token}

Response:
{
  "site_url": "https://example.com",
  "site_name": "Example Store",
  "admin_email": "admin@example.com",
  "woocommerce_installed": true,
  "active_plugins": ["woocommerce", "jwt-auth"],
  "multisite": false
}
```

#### Initialize First Admin
```
POST /wp-json/marveo/v1/init-admin
Authorization: Bearer {activation_token}
Content-Type: application/json

Request:
{
  "username": "marveo_admin",
  "email": "admin@marveo.local",
  "password": "secure_password_here"
}

Response:
{
  "success": true,
  "user_id": 1,
  "message": "Marvéo admin user created successfully"
}
```

### 4. User Synchronization Hooks

The plugin listens to WordPress user events and optionally syncs to Marvéo:

- `user_register` — New user created
- `profile_update` — User profile changed
- `delete_user` — User deleted
- `set_user_role` — Role changed

*Note:* Actual sync endpoint depends on Marvéo API design (future phase).

### 5. WooCommerce Integration Hooks

- `woocommerce_payment_complete` — Order paid
- `woocommerce_order_status_changed` — Order status changed
- `woocommerce_product_updated` — Product info changed

*Note:* These are placeholder hooks for future real-time sync capability.

## Installation & Setup

### For Clients (WordPress Site Admin)

1. **Download and Install**
   ```bash
   # Via WordPress admin or WP-CLI
   wp plugin install marveo-connector --activate
   ```

2. **Verify Activation**
   - Go to **Plugins** in WordPress admin
   - Confirm "Marvéo Connector" shows as active
   - Admin notice displays activation token (24-hour window)

3. **Copy Activation Token**
   - From WordPress admin notice or:
   ```bash
   wp option get marveo_activation_token
   ```

4. **Go to Marvéo Portal Setup**
   - Open Marvéo deployment URL
   - Select "Setup with Activation Token"
   - Paste token + create first Marvéo admin user
   - Plugin confirms and marks setup complete

### For Developers (Plugin Development)

```bash
git clone https://github.com/marveocommerce/marveo-connector.git
cd marveo-connector
npm install
npm run dev
```

## Security Considerations

### 1. Activation Token
- 32-character cryptographically random string
- Expires in 24 hours (configurable via filter `marveo_activation_token_expiry`)
- Single-use only — consumed upon first setup
- Stored in `wp_options` with expiry time

### 2. JWT Authentication
- Only users with `administrator` or `shop_manager` roles can obtain tokens
- Tokens expire after 7 days (configurable)
- Tokens must be transmitted over HTTPS in production

### 3. REST API Access
- All `/wp-json/marveo/v1/*` endpoints require JWT Bearer authentication (except `/init-admin` which uses activation token)
- Endpoints validate nonce for POST requests
- User must have `manage_options` capability for most operations

### 4. Rate Limiting
- Login attempts: max 5 per minute per IP
- API calls: rate limit via `X-RateLimit-Limit` headers
- Brute-force protection via failed attempt tracking

## Database Schema

The plugin uses WordPress options to store configuration:

```php
// Activation & Setup
$marveo_activated_at = get_option( 'marveo_activated_at' );           // timestamp
$marveo_activation_token = get_option( 'marveo_activation_token' );   // string (24h expiry)
$marveo_connector_status = get_option( 'marveo_connector_status' );   // 'pending_setup' | 'active'
$marveo_site_id = get_option( 'marveo_site_id' );                     // unique ID

// Marvéo Instance Info
$marveo_deployment_url = get_option( 'marveo_deployment_url' );       // https://app.marveo.com/client-123
$marveo_first_admin_created = get_option( 'marveo_first_admin_created' ); // boolean
$marveo_version = get_option( 'marveo_version' );                     // plugin version
```

## Hooks & Filters

### Actions

```php
do_action( 'marveo_activated' );                           // Plugin activated
do_action( 'marveo_first_admin_created', $user_id );       // First Marvéo admin created
do_action( 'marveo_user_synced', $user_id, $sync_data );   // User synced to Marvéo
do_action( 'marveo_order_synced', $order_id, $order_data ); // Order synced to Marvéo
```

### Filters

```php
apply_filters( 'marveo_activation_token_expiry', 60 * 60 * 24 );      // 24 hours
apply_filters( 'marveo_jwt_expiry', 60 * 60 * 24 * 7 );               // 7 days
apply_filters( 'marveo_user_sync_enabled', true );                    // Enable user sync
apply_filters( 'marveo_order_sync_enabled', true );                   // Enable order sync
apply_filters( 'marveo_rate_limit', 60 );                             // Requests per minute
```

## Admin Panel Features

The plugin adds:

1. **Marvéo Status Dashboard** (in WordPress admin)
   - Connector status
   - Link to Marvéo portal
   - Setup wizard
   - Sync statistics

2. **Settings Page**
   - Enable/disable user sync
   - Enable/disable order sync
   - View activation token
   - Regenerate activation token
   - Disconnect from Marvéo

3. **Admin Notice (24h after activation)**
   - "Marvéo Connector activated! Copy your setup token: [TOKEN]"
   - Direct link to Marvéo setup URL
   - "Setup Now" button

## Testing Checklist

- [ ] Plugin activates without errors
- [ ] Activation token is generated and valid
- [ ] GET `/wp-json/marveo/v1/status` returns correct info
- [ ] POST `/wp-json/marveo/v1/init-admin` creates user with correct role
- [ ] JWT token auth works for authenticated endpoints
- [ ] Invalid/expired tokens return 401 Unauthorized
- [ ] Rate limiting kicks in after threshold
- [ ] Plugin deactivation cleanly removes hooks
- [ ] Plugin reactivation generates new token

## Roadmap

**Phase 1 (v1.0):** Setup, authentication, status endpoints ← **Current**
**Phase 2 (v1.1):** User synchronization, audit logging
**Phase 3 (v1.2):** Real-time order/product sync, webhooks
**Phase 4 (v2.0):** Admin UI enhancements, advanced reporting

## Support & Troubleshooting

- **Activation token expired?** Regenerate via WordPress admin Settings > Marvéo
- **Can't connect?** Ensure JWT Auth plugin is active and HTTPS is enabled
- **"Access denied" error?** Verify user has Administrator or Shop Manager role
