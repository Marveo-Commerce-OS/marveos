# Onboarding Route Map (Safe Phase 2A)

Date: 2026-05-20
Scope: Contract-first mapping for MVP onboarding flow
Change policy: No runtime behavior changes in this phase

## 1) Existing Routes

### Setup UI routes
- /setup
- /setup/activate

### Dashboard routes involved in onboarding/deployment visibility
- /dashboard (gated by setup/validation)
- /dashboard/workspaces (workspace orchestration and onboarding controls)
- /dashboard/deployment (deployment link generation)

### Existing API routes (onboarding-adjacent)
- /api/cloud/workspaces [GET, POST]
- /api/cloud/workspaces/lookups [GET]
- /api/cloud/workspaces/:workspaceId/onboarding [GET, PUT]
- /api/cloud/workspaces/:workspaceId/launch-guard [GET, POST]
- /api/cloud/workspaces/:workspaceId/schemas [GET, PUT]
- /api/cloud/workspaces/:workspaceId/connector-commands [GET, POST]
- /api/cloud/deployment-links [GET, POST]
- /api/cloud/deployment-links/:linkId [GET, POST]
- /api/runtime/workspaces/:workspaceId [GET]

### Existing connector-related setup client service
- src/services/marveoConnector.ts (used by /setup/activate)

## 2) Current Flow (Observed)

1. User authenticates and reaches dashboard shell.
2. Dashboard layout checks deployment status.
3. If setup or validation is incomplete, user is redirected to /setup.
4. /setup shows deployment state and links to /setup/activate.
5. /setup/activate performs connector status check and first-admin initialization.
6. Workspace creation and orchestration currently happen from /dashboard/workspaces and /dashboard/deployment flows.
7. Launch readiness is evaluated with launch-guard route and connector deployment status.

## 3) MVP Target Flow (Requested)

Target sequence:
User -> Plan/Profile -> Website Type -> New/Existing/Custom Setup -> Deployment Start -> Workspace Created -> Support Assigned -> Launch Checklist

Mapped to typed steps:
1. PLAN_SELECTED
2. PROFILE_CREATED
3. WEBSITE_TYPE_SELECTED
4. BUSINESS_DETAILS_COMPLETED
5. CONNECTOR_TOKEN_GENERATED
6. TEMPLATE_SELECTED
7. DEPLOYMENT_STARTED
8. WORKSPACE_CREATED
9. SUPPORT_ASSIGNED
10. LAUNCH_CHECKLIST_READY

## 4) Gaps vs MVP Flow

- /api/cloud/workspaces/:workspaceId/support-assignment [GET, POST] (added Phase 2C)
- /api/cloud/workspaces/:workspaceId/launch-checklist [GET] (added Phase 2D)
- /api/cloud/workspaces/:workspaceId/connector [GET, POST] (added Phase 2F)
- /api/cloud/workspaces/:workspaceId/connector/verify [POST] (added Phase 2F)
- /api/connector/check [POST] (added Phase 2F — pre-workspace plugin presence check)

### Connector Routes (Phase 2F)

**`POST /api/connector/check`**
- Auth: admin session required
- Body: `{ domain: string }`
- Returns: `{ found, siteOrigin, connectorVersion, wordpressVersion, woocommerceEnabled, connectorPluginStatus }` on success
- Returns: `{ found: false, siteOrigin, error }` on failure
- Used by: onboarding wizard `checkConnectorPlugin()` in details step (before workspace creation)
- SSRF protection: blocks private/loopback ranges in production

**`GET /api/cloud/workspaces/:workspaceId/connector`**
- Auth: admin session required
- Returns: current connector state (status, token, site metadata)

**`POST /api/cloud/workspaces/:workspaceId/connector`**
- Auth: admin session required
- Body: `{ action: 'generate_token' | 'reset' }`
- Generates workspace invite token, sets status to TOKEN_GENERATED, appends audit log

**`POST /api/cloud/workspaces/:workspaceId/connector/verify`**
- Auth: admin session required
- Body: `{ domain: string, connectorToken?: string }`
- Server-side proxy: calls `GET {domain}/wp-json/marveo/v1/status` + `GET {domain}/wp-json/marveo/v1/site-profile`
- On success: stores ConnectorSiteMetadata, sets status CONNECTED, appends audit
- On failure: sets status FAILED, stores error, appends audit
- Called non-blocking during `startDeployment()` for EXISTING_WEBSITE + connector flow

## 5) Preserve in Phase 2A

Preserve as-is:
- Existing route contracts and response behavior
- Existing dashboard gating behavior
- Existing setup activation behavior
- Existing connector command and launch guard paths

## 6) Refactor Later (Phase 2B+)

Refactor candidates:
- Unify onboarding step model with contract-first typed step keys
- Align workspace onboarding state with MVP status model
- Add support assignment API path under support context
- Add launch checklist aggregator endpoint under deployment/onboarding boundary
- Normalize route grouping by bounded contexts while preserving outward compatibility

## 7) Safe Integration Points (No Wiring Yet)

Suggested future integration points:
- app/api/cloud/workspaces/:workspaceId/onboarding/route.ts -> adopt onboarding-flow contract types
- app/api/cloud/workspaces/route.ts -> accept websiteType and structured setup payloads
- app/api/cloud/workspaces/:workspaceId/launch-guard/route.ts -> consume launch checklist contract view
- future support route group -> consume support-assignment contract

## 8) Behavior Impact in Phase 2A

- No production route rewiring
- No connector plugin changes
- No UI rebuild
- Contract and documentation scaffolding only

## 9) Phase 2B Compatibility Adoption

Adopted in existing backend APIs with backward compatibility:

- Numeric step model remains supported and authoritative for current clients.
- MVP onboarding step keys are now mapped through a compatibility mapper.
- Optional onboarding fields accepted in onboarding/workspace APIs:
	- websiteType
	- onboardingStepKey
	- onboardingStatus
	- collectedBusinessData
	- supportRequired
	- planId
	- businessProfile
	- selectedTemplateId

Launch guard compatibility awareness added (informational only):
- SUPPORT_ASSIGNED
- LAUNCH_CHECKLIST_READY
- READY_FOR_REVIEW
- READY_FOR_LAUNCH

Important:
- Existing required payloads were not changed.
- Existing launch blocking behavior was not tightened.

## 10) Unmigrated Areas

- No UI onboarding flow wiring to new step keys yet.
- No dedicated support assignment API route yet.
- No launch checklist generator endpoint yet.
- No connector plugin contract changes yet.

## 11) Phase 2C Additions

New additive endpoints introduced:
- /api/cloud/workspaces/:workspaceId/support-assignment
- /api/cloud/workspaces/:workspaceId/launch-checklist

What they provide:
- Support assignment persistence with placeholder officer support
- Launch checklist aggregation over onboarding, deployment readiness, support assignment, and domain signals

Compatibility status:
- Numeric onboarding fallback remains in place
- Existing launch guard behavior remains authoritative
- New checklist endpoint is informational and non-blocking

## 12) Phase 2D Client MVP Route

New route added alongside existing setup flow:
- /setup/mvp

Safety and coexistence:
- Legacy /setup and /setup/activate remain intact.
- MVP route is additive and can be disabled with `NEXT_PUBLIC_ENABLE_MVP_ONBOARDING=false`.

MVP route wiring:
- Creates workspace via /api/cloud/workspaces
- Saves onboarding progress via /api/cloud/workspaces/:workspaceId/onboarding
- Assigns support (when required) via /api/cloud/workspaces/:workspaceId/support-assignment
- Retrieves launch readiness via /api/cloud/workspaces/:workspaceId/launch-checklist

Flow-specific connector visibility rules:
- EXISTING_WEBSITE:
	- Show connector onboarding in setup details.
	- Generate secure connection token.
	- Prompt install of Marveo Connector in existing WordPress site.
	- Verify connection before launch readiness unless manual support setup is selected.
- NEW_WEBSITE:
	- Do not show manual plugin download path during normal setup.
	- Collect `frontendDomain`, `backendCmsSubdomain`, and `domainStrategy=HEADLESS_WORDPRESS`.
	- Treat connector install as auto-install pending/ready milestone, not a manual client action.
- CUSTOM_HEADLESS:
	- Do not show connector options by default.
	- Connector-related guidance appears only after stack indicates WordPress/WooCommerce.

Known placeholders in Phase 2D:
- Template catalog is MVP placeholder choices (business, ecommerce, landing page)
- Support officer assignment uses queue placeholders when no real matching exists
- Connector token generation is represented as a guided placeholder handoff message when unavailable
