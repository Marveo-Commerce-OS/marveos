# Existing Website Connection (SAFE Phase 2F)

This document describes the MVP architecture for connecting an existing website (WordPress/WooCommerce) during Marveo onboarding.

## Goals

- Provide a safe, non-destructive connection path for existing client sites.
- Verify plugin connectivity before launch without blocking all onboarding progress.
- Persist connection status and metadata for support, checklist, and master dashboards.

## Scope (MVP)

- Domain-based plugin preflight check.
- Workspace-scoped connector token storage (token is generated in the WordPress connector plugin and pasted into onboarding).
- Token is located in WordPress Admin → Marvéo Connector → Connection Token.
- Workspace verification endpoint that persists status + metadata.
- Launch checklist items for existing website verification readiness.
- Support fallback only when manual setup is selected or connector verification fails.

## Architecture

### 1. Onboarding UI

File: `app/setup/mvp/page.tsx`

- Existing Website details screen includes:
  - Domain input and WordPress Admin URL input (`https://example.com/wp-admin` format helper).
  - A clearly numbered connector flow:
    1) Download Connector
    2) Install Connector on WordPress
    3) Generate Secure Connection Token in WordPress Connector
    4) Paste Generated Secure Connection Token into Marveo onboarding
    5) Verify Connection
  - Connector download entry point (`Download Connector Plugin (.zip)`) and installation guide link (`View Installation Guide`).
  - Install guide URL is configurable via `NEXT_PUBLIC_CONNECTOR_INSTALL_GUIDE_URL`; default fallback is `/docs/connector-installation`.
  - Editable token field for pasting the plugin-generated token (`Generated Secure Connection Token`).
  - Security warning near the token field telling the client not to share the token publicly.
  - Token field masks on blur, reveals on focus, and includes a show/hide toggle plus a safe clear action.
  - `Verify WordPress Connection` action after plugin save in WordPress.
  - Status + metadata panel (platform, WooCommerce, versions, counts, last check).
  - Explicit guided setup fallback with a Marvéo specialist for clients who want help or do not have WordPress ready.

### 2. Probe Layer

File: `lib/connectorProbe.ts`

- Normalizes URL and probes safe connector endpoints.
- Derives capability flags and lightweight counts.
- Returns normalized metadata used by both preflight and persistent verification routes.

### 3. API Surface

- `POST /api/cloud/connector/preflight`
  - Non-persistent check from UI details screen.
  - Returns verification and metadata for immediate feedback.

- `POST /api/cloud/workspaces/:workspaceId/connector`
  - Actions: `generate_token`, `set_token`, `update_status`, `reset`.
  - Stores workspace connector state and token.

- `POST /api/cloud/workspaces/:workspaceId/connector/verify`
  - Persistent verification path for deployment-time workspace update.
  - Validates the submitted domain against the verified site origin.
  - Rejects domain mismatches with a safe error and stores failure state without exposing the token.
  - Stores `connectorSiteMetadata` and updates `connectorStatus`.

- `POST /api/cloud/workspaces/:workspaceId/connector/verify-token`
  - Explicit token match verification endpoint.

### 4. Persistence

File: `lib/adminStore.ts`

Connector status model:

- `NOT_CONNECTED`
- `TOKEN_GENERATED`
- `PENDING_VERIFICATION`
- `CONNECTED`
- `FAILED`
- `SUPPORT_REQUIRED`

Connector metadata persisted on workspace includes platform and discovery details used by checklist and dashboard views.

Token safety rules:

- One token per domain is expected in the Existing Website flow.
- The verification path must reject mismatched domain/site responses before continuing.
- Token values are not logged and should not appear in discovery or metadata summaries.

### 5. Checklist and Support Rules

File: `app/api/cloud/workspaces/[workspaceId]/launch-checklist/route.ts`

For `EXISTING_WEBSITE` workspaces:

- Required checklist items include website connection verification and connector readiness.
- Support assignment is required only when:
  - manual setup was selected, or
  - connector status is `FAILED` or `SUPPORT_REQUIRED`.
- WooCommerce copy uses friendly labels: `Installed`, `Not installed`, or `Unknown`.
- The post-verification view should surface a discovery summary instead of raw counts alone.

For `NEW_WEBSITE` workspaces:

- Collect `frontendDomain` and `backendCmsSubdomain`.
- Persist `domainStrategy` as `HEADLESS_WORDPRESS`.
- Treat WordPress backend preparation and connector auto-install as internal preparation milestones.
- Do not require client-side plugin download as a launch blocker.

## End-to-End Flow

1. User selects Existing Website.
2. User enters domain and WordPress Admin URL.
3. User downloads connector package and follows installation guide.
4. User installs/activates WordPress connector.
5. User generates a secure connection token inside WordPress connector settings.
6. User pastes that token into onboarding.
7. User clicks Verify WordPress Connection (preflight).
8. If the submitted domain does not match the verified site origin, onboarding stops with a safe mismatch error.
9. If manual support is selected, onboarding marks support-required and support assignment is created during deployment.
10. Deployment creates workspace and persists onboarding details.
11. Deployment stores pasted token against workspace and verifies connector.
12. Connector status + metadata are stored.
13. Checklist and support requirements are computed from persisted state.

## Operational Visibility

- Master workspace table shows connector status + detected platform.
- MVP deployment detail shows connector status, platform, WooCommerce flag, and scanned counts.
- Existing Website setup shows a friendly discovery summary with pages, menus, products when available, and WooCommerce state.

## What Is Not In MVP

- Full activation token handshake between plugin and MarveoOS.
- Automated content sync/import pipeline.
- Scheduled connector health monitoring.
- Full JWT-protected endpoint integration.

## Real WordPress Test Procedure

1. Prepare a WordPress site reachable from MarveoOS.
2. Install and activate the marveo-connector plugin.
3. Open onboarding at `/setup/mvp`, choose Existing Website.
4. Enter site domain and WordPress Admin URL.
5. Use `Download Connector Plugin (.zip)` or the installation guide link if plugin is not installed yet.
6. Find the token in WordPress Admin → Marvéo Connector → Connection Token.
7. Paste that token into onboarding.
8. Click `Verify WordPress Connection` and confirm status becomes `CONNECTED`.
9. Continue deployment and verify workspace connector metadata is present in:
   - `/master/workspaces`
  - `/master/mvp-deployments/:workspaceId`
10. Validate checklist includes connection items and no support requirement unless manual/failure path is used.

## UX Notes

- The token field should show the pasted token while focused and mask it on blur.
- The token field should include a show/hide toggle and a safe clear action.
- The metadata area should prioritize the discovery summary and keep WordPress version secondary.
