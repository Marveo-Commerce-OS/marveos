# Marvéo Setup & Activation Flow

This guide explains how to connect a WordPress/WooCommerce store to Marvéo using the Marvéo Connector plugin and the Marvéo dashboard setup page.

## Overview

The setup process involves two main components:

1. **Marvéo Connector Plugin** - Installed on the WordPress site
2. **Marvéo Setup Page** - In the Marvéo dashboard

The flow securely connects your WordPress store to Marvéo in minutes.

## Prerequisites

- WordPress 5.9 or higher installed
- Administrator access to WordPress
- WooCommerce installed (optional, but recommended)
- HTTPS enabled (required for production)
- Access to Marvéo account

## Step 1: Install the Marvéo Connector Plugin on WordPress

### Via WordPress Admin

1. Log in to your WordPress admin dashboard
2. Go to **Plugins → Add New**
3. Search for **Marvéo Connector**
4. Click **Install Now**
5. Click **Activate**

### Via WP-CLI

```bash
wp plugin install marveo-connector --activate
```

### Manual Installation

1. Download the Marvéo Connector plugin ZIP file
2. Go to **Plugins → Add New** in WordPress admin
3. Click **Upload Plugin**
4. Select the ZIP file and click **Install Now**
5. Click **Activate Plugin**

### Verify Installation

1. In WordPress admin, go to **Plugins**
2. Find "Marvéo Connector" in the list
3. Verify it shows as "Active"
4. An admin notice should appear with your activation token

## Step 2: Copy Your Activation Token

After activating the plugin, WordPress displays an admin notice with your activation token.

### Method 1: From Admin Notice

1. Look for the blue notice at the top of your WordPress admin
2. The notice shows your activation token (32 characters)
3. **Copy the entire token** (it's shown in a gray box with monospace font)

### Method 2: Via WordPress Settings

1. In WordPress admin, go to **Marvéo** (in the left menu)
2. Under "Activation Token" section, you'll see your token
3. Copy the entire token string
4. Note: You have 24 hours to use this token

### Method 3: Via WP-CLI

```bash
wp option get marveo_activation_token
```

**Important:** Your activation token:
- Is 32 characters long (alphanumeric)
- Expires in 24 hours
- Can only be used once
- Is required to set up the connection

## Step 3: Open Marvéo Setup Page

1. Log in to your Marvéo account
2. Go to **Setup → Activate Store** (or `/setup/activate` if you know the URL)
3. You'll see a form with fields for:
   - WordPress Site URL
   - Activation Token
   - Admin Username
   - Admin Email
   - Password
   - Confirm Password

## Step 4: Fill in the Setup Form

### WordPress Site URL

Enter the full URL of your WordPress store:

- **Format:** `https://example.com`
- **Include protocol:** Must start with `https://` or `http://`
- **No trailing slash:** `https://example.com` not `https://example.com/`
- **Must be accessible:** The Marvéo server must be able to reach this URL

**Example:**
```
https://mystore.com
https://store.example.com
```

### Activation Token

Paste the 32-character token you copied from WordPress:

- Copy the **entire** token (all 32 characters)
- It's case-sensitive
- Don't add spaces or modify it

**Example:**
```
abc123def456ghi789jkl012mno345pq
```

### Admin Username

Create a new WordPress administrator username for Marvéo:

- **Minimum 3 characters**
- Use alphanumeric characters
- Should be descriptive (e.g., `marveo_admin`, `connector_user`)
- This is the account Marvéo will use to sync data

**Example:**
```
marveo_admin
connector_user
system_sync
```

### Admin Email

Enter an email address for the new admin account:

- Must be a valid email format
- Will be used for WordPress notifications
- Doesn't need to be your personal email

**Example:**
```
admin@marveo.local
marveo@example.com
connector@store.com
```

### Password

Create a strong password for the admin account:

- **Minimum 8 characters**
- Use a mix of uppercase, lowercase, numbers, and symbols
- This is stored securely in WordPress
- You won't need it for normal operation

**Example:**
```
MarveoSetup2024!
Admin@Connector_Pass123
```

### Confirm Password

Re-enter the password to verify you typed it correctly.

## Step 5: Submit and Verify Connection

1. Review all fields for accuracy
2. Click **Connect to Marvéo** button
3. The page will:
   - Check if the WordPress site is reachable
   - Verify the Marvéo Connector plugin is installed
   - Validate the activation token
   - Create the admin user
   - Mark the connection as active

### Success State

If everything goes well:

1. ✅ You'll see **"Connection Successful!"** message
2. The admin user is created in WordPress
3. Your site is now linked to Marvéo
4. Click **Go to Dashboard** to enter Marvéo

### Error States

If something goes wrong, you'll see an error message with:

- **Clear explanation** of what went wrong
- **Troubleshooting steps** specific to your error
- **Retry button** to try again

#### Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| "Cannot reach WordPress site" | URL is wrong or site isn't online | Verify the URL is correct and the site is online |
| "Plugin not found" | Marvéo Connector not installed | Install and activate the plugin on WordPress |
| "Token is invalid/expired" | Token wasn't used within 24 hours | Regenerate a new token in WordPress admin |
| "Admin already created" | Setup was already completed | Plugin is already connected to another Marvéo instance |
| "Username must be 3+ chars" | Username is too short | Enter a username with at least 3 characters |
| "Invalid email format" | Email isn't formatted correctly | Use a valid email like `user@example.com` |
| "Passwords do not match" | Confirmation password doesn't match | Make sure both password fields are identical |

## Step 6: Verify Connection in WordPress

After successful setup, verify everything is working:

### In WordPress Admin

1. Go to **Marvéo** in the left menu
2. Check that **Connector Status** shows "Active" (green)
3. Verify **Site ID** is populated
4. Check **JWT Auth Status** (should show "Enabled" if JWT Auth plugin is installed)

### In WordPress CLI

```bash
# Check connector status
wp option get marveo_connector_status
# Should return: active

# Check if first admin was created
wp option get marveo_first_admin_created
# Should return: 1

# Check the site ID
wp option get marveo_site_id
# Should return: marveo_xxxxxxxxxxxxx
```

### Test the Connection

From Marvéo, you can verify the connection by:

1. Going to **Dashboard → Connected Stores**
2. Finding your newly connected store
3. Checking that all information displays correctly

## Understanding the Flow

### What Happens During Setup

```
Marvéo Dashboard           WordPress Site
       |                        |
       |-- Check Status ------->|
       |  GET /wp-json/marveo/v1/status
       |                        |
       |<-- Status Response -----|
       |  (plugin installed, not set up)
       |
       |-- Initialize Admin ---->|
       |  POST /wp-json/marveo/v1/init-admin
       |  Authorization: Bearer {token}
       |  {username, email, password}
       |                        |
       |                    [Create user]
       |                    [Mark as active]
       |                    [Consume token]
       |                        |
       |<-- Success Response ---|
       |  {user_id, success}
       |
   [Store connection]
```

### Security Features

1. **Activation Token**
   - 32-character random string
   - Expires in 24 hours
   - Single-use only (consumed after setup)
   - Not stored in Marvéo (only sent during initialization)

2. **HTTPS Required**
   - All communication must be over secure HTTPS
   - Passwords never transmitted in plain text

3. **Admin User**
   - Created with Administrator role
   - Has full WordPress permissions
   - Used only by Marvéo for synchronization

4. **Validation**
   - Site URL must be reachable
   - Plugin must be installed
   - Token must be valid and not expired
   - Email and username must be unique

## Troubleshooting

### I forgot to copy my activation token

**Solution:** Regenerate it in WordPress:

1. Go to **Marvéo** in WordPress admin
2. Click **Regenerate Token** button
3. A new 24-hour token is created
4. Copy and use the new token

### My token expired (24 hours passed)

**Solution:** Generate a fresh token:

1. Go to **Marvéo** in WordPress admin
2. Click **Regenerate Token**
3. The new token is valid for 24 hours
4. Return to Marvéo setup page and try again

### I see "Marvéo Connector plugin not found"

**Checklist:**

1. ✓ Is the plugin installed? Check **Plugins** page in WordPress
2. ✓ Is it activated? Should show as "Active"
3. ✓ Is the WordPress URL correct? (Check admin URL)
4. ✓ Is HTTPS working? Try accessing the site in a browser

**Fix:**
- Install the plugin if missing
- Activate it if inactive
- Correct the URL if wrong
- Enable HTTPS if not already

### The WordPress site isn't reachable

**Checklist:**

1. ✓ Is the URL correct? No typos?
2. ✓ Can you visit the URL in your browser?
3. ✓ Is the site online? Check hosting status
4. ✓ Is WordPress REST API enabled? (Should be by default)
5. ✓ Are firewall rules blocking it?

**Fix:**
- Verify the URL and try again
- Ensure the site is online
- Check with your hosting provider if blocked
- Ensure REST API isn't disabled by a security plugin

### I see CORS or API errors

**Checklist:**

1. ✓ Is HTTPS enabled on the WordPress site?
2. ✓ Is the Marvéo Connector plugin active?
3. ✓ Does the WordPress REST API work? Test with curl:

```bash
curl https://example.com/wp-json/marveo/v1/status
```

**Fix:**
- Enable HTTPS on the WordPress site
- Install and activate the Marvéo Connector plugin
- Check with hosting provider if REST API is blocked
- Disable security plugins temporarily to test

### Setup completes but connection doesn't work

**Checklist:**

1. ✓ Does WordPress admin show "Connector Status: Active"?
2. ✓ Is the Site ID populated?
3. ✓ Can you authenticate with JWT?

**Fix:**
- Go to WordPress admin and verify status
- If showing "Pending Setup", the setup didn't complete
- Try the setup again with correct information
- Contact support if issues persist

## What's Next After Setup

Once your store is connected:

1. **Enable Data Sync**
   - Go to **Marvéo** → **Settings**
   - Enable user and order synchronization

2. **Configure WooCommerce Integration**
   - Set up product sync
   - Enable order tracking

3. **Set Up Webhooks** (Phase 2+)
   - Real-time notifications
   - Instant data updates

4. **Monitor Sync Status**
   - View sync logs
   - Check for any errors

## Advanced Configuration

### Change Marvéo Deployment URL

You can link your WordPress site to a specific Marvéo deployment:

1. In WordPress admin, go to **Marvéo** → **Marvéo Configuration**
2. Enter your Marvéo Deployment URL (e.g., `https://app.marveo.com/client-123`)
3. Save changes
4. The "Complete Setup in Marvéo" button will link directly to this URL

### Using Environment Variables

If managing multiple stores via CLI:

```bash
# Get connection info
wp option get marveo_site_id
wp option get marveo_connector_status
wp option get marveo_deployment_url

# Update deployment URL
wp option update marveo_deployment_url "https://app.marveo.com/client-123"
```

### Regenerate Token Programmatically

For automated setup (advanced):

```bash
# Via WordPress
wp shell
>> update_option( 'marveo_activation_token', bin2hex( random_bytes( 16 ) ) );
>> update_option( 'marveo_activation_token_expires', time() + ( 24 * 60 * 60 ) );

# Via API (requires special endpoint - future feature)
```

## Security Best Practices

1. **Use Strong Passwords**
   - Create complex passwords for the admin account
   - Don't reuse passwords from other accounts

2. **Keep HTTPS Enabled**
   - Always use HTTPS for your WordPress site
   - Required for production Marvéo instances

3. **Monitor Access**
   - Regularly check WordPress user list
   - Verify only authorized Marvéo users have admin access

4. **Update the Plugin**
   - Keep Marvéo Connector updated
   - Install security patches promptly

5. **Regenerate Tokens if Needed**
   - If a token is compromised, regenerate immediately
   - Old tokens are automatically invalidated

## Support and Help

- **Documentation:** See `/docs/connector-plugin-spec.md`
- **WordPress Plugin Docs:** See `/README.md` in the plugin folder
- **API Reference:** See REST API documentation in plugin README

## Glossary

| Term | Definition |
|------|-----------|
| **Activation Token** | 32-character single-use code generated during plugin activation |
| **Site ID** | Unique identifier for your WordPress installation in Marvéo |
| **Connector Status** | Current connection state (pending_setup, active, disconnected) |
| **JWT Auth** | JSON Web Token authentication for REST API access |
| **WP-CLI** | WordPress Command Line Interface for server access |
| **REST API** | WordPress API for external applications to communicate |
| **HTTPS** | Secure protocol for encrypted web communication |

## Changelog

### v1.0 (Initial Setup Flow)
- First-time setup page at `/setup/activate`
- Activation token validation
- Admin user creation
- Status checking
- Error handling and troubleshooting

### Future (v1.1+)
- Multi-site setup
- Bulk site import
- Setup wizard with step-by-step guidance
- Setup templates for different store types
