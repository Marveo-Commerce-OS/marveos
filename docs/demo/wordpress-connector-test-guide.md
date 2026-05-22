# WordPress Connector Test Guide

This guide is for a real connector verification rehearsal against a reachable WordPress site.

## Preconditions

- WordPress site is reachable from the Marveo app host.
- The Marveo connector plugin package is available.
- You have WordPress admin access to install and activate the plugin.

## Existing Website Setup Flow (Client View)

The onboarding flow is explicitly ordered as:

1. Download Connector
2. Install Connector on WordPress
3. Generate Secure Connection Token in WordPress Connector
4. Paste Generated Secure Connection Token in Marveo
5. Verify Connection

The token can be found in WordPress Admin → Marvéo Connector → Connection Token.

## 1. Install Connector Plugin

1. Log into WordPress admin.
2. In `/setup/mvp`, use `Download Connector Plugin (.zip)` (placeholder package link in MVP) or open `View Installation Guide`.
3. Install the Marveo connector plugin.
3. Activate the plugin.
4. Confirm the plugin is active in WordPress.

## 2. Configure Token

1. Open `/setup/mvp`.
2. Choose `Existing Website`.
3. In WordPress connector settings, generate a secure connection token and save it.
4. In Setup Details, paste that value into `Generated Secure Connection Token`.
5. Do not share the token publicly. It securely links the WordPress site to Marvéo.

## 3. Enter Domain In MVP Flow

1. In `/setup/mvp`, enter the site domain in `Current website domain`.
2. Enter `WordPress Admin URL` (example: `https://example.com/wp-admin`).
3. Keep the connector path selected.
4. Review the install instructions panel before verification.

## 4. Verify Connection

1. Click `Verify WordPress Connection`.
2. Expected successful behavior:
   - connection status moves to connected state
   - platform is detected
   - WooCommerce state is shown if present
   - verification timestamp updates

3. Expected failed behavior:
   - failure message is shown
   - connector state persists as failed/support-required where applicable
   - `Manual Support Setup` path can be used safely

## 5. Support Fallback (Manual Support Setup)

1. Click `Let a Marvéo specialist assist` when the client wants guided help or does not have WordPress ready.
2. Confirm onboarding shows that the setup team can install the connector, verify the WordPress site, and complete the connection safely.
3. Continue deployment and confirm support assignment appears in:
   - `/master/support`
   - `/master/mvp-deployments`

## 6. Confirm Metadata

After verification, confirm the setup screen shows:
- detected platform
- WooCommerce state as `Installed`, `Not installed`, or `Unknown`
- WordPress version if available
- verification timestamp
- a friendly discovery summary that lists pages, menus, products when present, and WooCommerce state

## 7. Confirm Master Visibility

After workspace creation, confirm in internal views:

### `/master/workspaces`
- workspace appears
- connector status appears
- platform appears

### `/master/mvp-deployments`
- workspace appears in queue
- launch readiness status appears

### `/master/mvp-deployments/:workspaceId`
- connector status is visible
- platform is visible
- WooCommerce status is visible
- checklist is visible

## 8. Confirm Checklist Behavior

For `EXISTING_WEBSITE`:
- connector verification should be required
- the submitted domain must match the verified site origin
- mismatches should stop continuation with a safe error message
- support requirement should appear only when needed
- failed/manual path should remain review-blocked until resolved

## Notes

- This MVP does not yet perform full content sync.
- This MVP focuses on safe verification, status persistence, and operational visibility.
- If you do not have a reachable real WordPress site, use the failure path as a safe fallback demo.