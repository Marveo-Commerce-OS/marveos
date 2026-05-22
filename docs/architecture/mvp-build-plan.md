# MVP Build Plan (Post Phase 1)

This plan starts after Safe Phase 1 documentation and boundary scaffolding.

## Goals

- Preserve current runtime behavior while reducing architecture risk.
- Prepare codebase for predictable MVP feature delivery.
- Make domain ownership explicit before major implementation work.

## Refactor Plan

### 1. Split lib/adminStore.ts into domain services

Target split:
- platform-core/store (workspace orchestration + plan + rollout)
- support/store (smtp/forms/tracking/maintenance)
- access/store (managed users + role visibility)
- audit/store (append/read/export)
- storage-adapter (filesystem vs WordPress persistence)

Approach:
- Introduce interfaces first.
- Keep current file as facade during migration.
- Move internals incrementally with compatibility exports.

### 2. Consolidate runtime providers

Target:
- One canonical runtime stack using root components/lib path.

Approach:
- Mark src runtime stack deprecated.
- Add verification checklist for active consumers.
- Remove transitional stack only after route and consumer confirmation.

### 3. Clean API route groups

Target grouping under app/api by context:
- platform-core
- workspace-runtime
- onboarding
- deployment
- support
- connector-gateway
- shared

Approach:
- Start with internal folder aliasing and shared middleware.
- Preserve public route paths initially.
- Introduce route adapters where path migration is needed later.

### 4. Standardize environment variables

Target:
- Single env contract doc + validation layer.

Approach:
- Define canonical names and deprecations.
- Add a typed config validator.
- Log warnings for deprecated variables before removal.

### 5. Add tests for critical flows

Minimum MVP critical test set:
- Login/auth gate flow
- Setup activation flow
- Workspace creation and plan limits
- Runtime workspace endpoint assembly
- Deployment launch guard

Approach:
- Add baseline unit tests for pure logic.
- Add integration tests for critical API routes.
- Add smoke tests for setup and dashboard guard paths.

## Suggested Sequence

1. Add shared contracts and config validation harness.
2. Extract adminStore facade internals into domain modules.
3. Add test coverage around extracted modules.
4. Consolidate runtime provider stack.
5. Normalize API route groups with adapters.

## Exit Criteria for Phase 2 Start

- Domain ownership documented and accepted.
- Migration checklist approved.
- No unresolved deprecation ambiguity for runtime stacks.
- Test harness created for at least first critical flows.

## TODO (Phase 2)

- TODO: Create adminStore facade extraction tracking checklist.
- TODO: Add runtime stack migration verification matrix.
- TODO: Add environment variable deprecation map.

## Phase 2B Status (Compatibility Layer)

Completed:
- Added numeric-to-MVP onboarding step compatibility mapper.
- Added non-invasive onboarding payload validation helpers.
- Extended existing onboarding/workspace APIs with optional MVP onboarding fields.
- Added launch-guard informational MVP signal awareness.

Preserved:
- Existing numeric onboarding steps.
- Existing required request payloads.
- Existing launch gate behavior and block logic.

Remaining for Phase 2C:
- Wire UI and workflow controllers to use MVP step keys as primary source.
- Introduce support assignment route contract usage.
- Add launch checklist aggregator endpoint and persistence strategy.
- Add API-level tests for compatibility and contract validation behavior.

## Phase 2C Status (Backend Reliability)

Completed:
- Added support assignment endpoint for workspace-level onboarding support state.
- Added launch checklist aggregation endpoint for launch readiness visibility.
- Added lightweight route test stubs for compatibility checks.
- Added minimal admin store helpers for support assignment storage only.

Preserved:
- No UI rebuild.
- No connector plugin changes.
- No deployment automation.
- Numeric onboarding fallback retained.

Next (Phase 2D):
- Wire backend contracts into UI workflows incrementally.
- Add executable automated API tests (unit + integration) from stubs.
- Introduce support workflow transitions and SLA states.
- Add optional checklist acknowledgment/update actions while keeping launch guard authority intact.

## Phase 2D Status (Client MVP Onboarding UI)

Completed:
- Added new client-facing onboarding route under setup namespace.
- Implemented MVP step experience:
	- Plan/Profile
	- Website Type
	- Type-specific details (new/existing/custom)
	- Review and deployment start
	- Deployment progress
	- Workspace ready and launch checklist
- Wired UI to existing backend endpoints without replacing legacy setup route.

Preserved:
- Existing /setup and /setup/activate flows.
- Numeric onboarding compatibility behavior.
- No connector plugin changes.
- No deployment automation changes.

Remaining for Phase 2E:
- Add executable frontend integration tests for onboarding route.
- Improve draft persistence strategy beyond local storage.
- Introduce real support officer matching and assignment lifecycle.
- Replace MVP template placeholders with production template catalog.

## Phase 2E Status (Internal Operations Visibility)

Completed:
- Added internal queue route for operations under `/dashboard/mvp-deployments`.
- Added workspace detail route under `/dashboard/mvp-deployments/:workspaceId`.
- Wired visibility fields for:
	- workspace/client name
	- plan
	- website type
	- onboarding status + current step
	- deployment and launch readiness signals
	- support assignment status
	- blockers and checklist summaries
- Added safe internal actions:
	- refresh checklist
	- assign/update support placeholder
	- copy workspace ID
	- open workspace detail
- Added navigation entry in dashboard sidebar for MVP deployments.

Preserved:
- Existing dashboard and setup behavior remains unchanged.
- Existing auth and role gating pattern remains unchanged.
- Existing launch guard authority remains unchanged.

Residual risks:
- Audit notes visibility depends on super-admin access for `/api/admin/audit`.
- Queue currently performs per-workspace checklist/guard reads, which may need batching at higher scale.

## Phase 2F Status (Existing Website Connector Architecture)

Completed:
- Audited connector plugin (`marveo-connector`) endpoints, auth levels, and integration surface.
- Added connector state types to `lib/adminStore.ts`:
  - `ConnectorStatusKey` union type (NOT_CONNECTED → TOKEN_GENERATED → PENDING_VERIFICATION → CONNECTED → FAILED → SUPPORT_REQUIRED)
  - `ConnectorSiteMetadata` interface
  - Connector fields on `WorkspaceOrchestration`
  - `getWorkspaceConnectorState` and `setWorkspaceConnectorState` helper functions
- Created `/api/cloud/workspaces/:workspaceId/connector` route (GET + POST):
  - GET returns current connector status and token
  - POST generates/resets workspace connector tokens with audit log
- Created `/api/cloud/workspaces/:workspaceId/connector/verify` route (POST):
  - Server-side proxy to remote WordPress site (avoids CORS)
  - SSRF protection in production (blocks private/loopback ranges)
  - Calls `/wp-json/marveo/v1/status` (public) and `/wp-json/marveo/v1/site-profile` (runtime permission)
  - Stores `ConnectorSiteMetadata` and sets workspace connector state
- Created `/api/connector/check` route (POST):
  - Pre-workspace connector presence check (no workspaceId required)
  - Used by onboarding wizard for real-time plugin detection feedback
- Updated `app/setup/mvp/page.tsx` existing website connector section:
  - Added `connectorCheck` ephemeral state (not persisted to localStorage)
  - Added `checkConnectorPlugin()` async function
  - Replaced simple token input panel with full connection UI panel:
    - Step-by-step plugin install instructions
    - Activation token input
    - "Check plugin" button with loading state
    - Connected badge (plugin version, WP version, WooCommerce status, connector status)
    - Not-found/error badge with retry and "Switch to manual support" action
  - Added non-blocking `connector/verify` call during `startDeployment()` after workspace creation
- Updated `app/api/cloud/workspaces/:workspaceId/launch-checklist/route.ts`:
  - Added `connector_verified` checklist item (required for EXISTING_WEBSITE workspaces)
  - Updated `hasConnectorOrTemplate()` helper to count CONNECTED status
  - Added `connectorStatus` and `connectorSiteMetadata` to launch-checklist API response
- Created `docs/architecture/connector-capabilities.md` with full endpoint audit.

Preserved:
- Connector plugin not modified.
- Existing connector commands route unchanged.
- adminStore helpers not aggressively refactored.
- Dashboard not redesigned.
- Deployment automation not added.
- All Phase 2E files and behavior unchanged.

Residual risks:
- No real activation token handshake between WP plugin and MarvéoOS (token is stored client-side only).
- JWT-protected `/site-info` endpoint not yet wired (requires JWT Auth WP plugin).
- Content discovery routes require admin token flow and are not yet integrated.
- `/connector/verify` depends on plugin being reachable from server — private/intranet WP sites will fail gracefully.
