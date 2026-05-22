# MVP QA Smoke Test Report (SAFE Phase 2G)

Date: 2026-05-20
Environment: local dev (http://localhost:3000)
Tester: Copilot QA run

## Scope

Validated end-to-end MVP smoke flows without adding features or refactoring.

## SAFE MVP Blocker Fix Pass (2026-05-20)

This report was updated after a blocker-only fix pass.

### Targeted Validation Results

| Blocker | Status | Validation evidence |
|---|---|---|
| Bug 1: Launch readiness connector scoping | RESOLVED | `/master/launch-readiness` now shows non-existing website blockers without connector/token requirements; existing website still shows connector blockers. |
| Bug 2: Existing website failed/manual connector persistence | RESOLVED | `POST /api/cloud/workspaces/ws_1779316388307_1j3ajhrp/connector/verify` with invalid domain now persists `FAILED` + `supportRequired=true`; manual status update persists `SUPPORT_REQUIRED` + `supportRequired=true`; checklist support requirement remains required for these states. |
| Bug 3: Platform visibility consistency | RESOLVED | `/dashboard/mvp-deployments/ws_1779316388307_1j3ajhrp` now shows `Detected platform: WordPress/WooCommerce` and `WooCommerce: Enabled`, matching normalized source fallback used in master workspace view. |

### Remaining Items (Post-Fix)

- Portal separation client-role-only proof remains partial due missing dedicated client-only fixture account in this environment.
- Launch guard still reports architecture/module validation requirements for workspaces that have not completed those steps; this is expected behavior and not part of the connector scoping blocker.

## QA Preconditions

- Internal demo auth used for master access:
  - username: demo-admin
  - password: configured in local env
- During testing, local plan cap blocked additional onboarding runs after first workspace (`starter` limit = 1).
- QA-only environment adjustment was applied to continue smoke coverage:
  - `.admin-data/ecommerce-admin-config.json` accountPlan changed from `starter` to `business`.

## Pass/Fail Matrix

| Area | Route / Flow | Result | Evidence / Notes |
|---|---|---|---|
| Internal access | `/master-login` | PASS | Login page rendered with internal auth form. |
| Internal access | `/master` | PASS | Control Center loaded with internal sidebar and metrics. |
| Internal access | `/master/mvp-deployments` | PASS | Queue loaded with created workspaces and blockers. |
| Internal access | `/master/workspaces` | PASS | Workspaces table loaded; connector + platform columns visible. |
| Internal access | `/master/launch-readiness` | FAIL | Blockers are inaccurate for non-existing website workspaces (see Bug 1). |
| Client onboarding | `/setup/mvp` base flow | PASS | Wizard loads and proceeds through all stages. |
| Client onboarding | New Website path | PASS | Workspace created: `ws_1779316278061_10c59xoh`. |
| Client onboarding | Existing Website path | PASS (with defects) | Workspace created: `ws_1779316388307_1j3ajhrp`; connector subflow defects captured. |
| Client onboarding | Custom/Headless path | PASS | Workspace created: `ws_1779316395781_q18jbi9j`. |
| Existing website connection | Generate connector token | PASS | Token generated (`marveo_...`) in details step. |
| Existing website connection | Install instructions display | PASS | Connector install instructions rendered. |
| Existing website connection | Verify domain/preflight | PASS | Invalid domain returns failed verification state and error copy. |
| Existing website connection | Save connector status | FAIL | Existing workspace remained `NOT_CONNECTED` after failed/manual path (see Bug 2). |
| Existing website connection | Show metadata | PARTIAL | Setup details panel shows metadata fields; persisted detail view shows platform as Unknown (see Bug 3). |
| Existing website connection | Fallback to support setup if failed | PASS | Request support setup path sets support required and assigns support. |
| Master visibility | Appears in `/master/workspaces` | PASS | All three test workspaces listed. |
| Master visibility | Appears in `/master/mvp-deployments` | PASS | All three listed with launch readiness status. |
| Master visibility | Connector status appears | PASS | Connector status column present. |
| Master visibility | Platform appears | PASS (surface-specific defect) | Platform visible in `/master/workspaces`; inconsistent in detail page (Bug 3). |
| Master visibility | Launch checklist appears | PASS | Checklist visible in workspace detail page. |
| Master visibility | Blockers accurate | FAIL | Connector blockers incorrectly shown for non-existing website types (Bug 1). |
| Portal separation | `/portal` should not show internal tools | PASS | Internal session navigating to `/portal` redirected to `/master`. |
| Portal separation | Internal users should not use portal | PASS | Internal session redirected from `/portal` to `/master`. |
| Portal separation | Client users should not access master | PARTIAL | Direct client-only role could not be exercised in this env; unauth/internal boundary exists but client-role-only validation not completed. |
| Launch checklist | Workspace created item | PASS | `Workspace created` marked Done. |
| Launch checklist | Website type selected item | PASS | `Website type selected` marked Done. |
| Launch checklist | Connector/template selected item | PASS | `Connector or template selected` marked Done. |
| Launch checklist | Support required only when needed | PASS | New Website had no support requirement; Existing manual path required support. |
| Launch checklist | Not falsely marked ready | PASS | All tested workspaces remained Needs review / Blocked. |

## Exact Bugs Found

### Bug 1: Launch Readiness Applies Connector Blockers to Non-Existing Website Workspaces
- Severity: High (demo-blocking for readiness credibility)
- Route: `/master/launch-readiness`
- Repro:
  1. Create `NEW_WEBSITE` and `CUSTOM_HEADLESS` workspaces.
  2. Open `/master/launch-readiness`.
  3. Observe top blockers include connector plugin/token issues for all workspace types.
- Observed:
  - Non-existing website workspaces show blocker text like:
    - "Connector plugin installation not confirmed"
    - "Site connection token not validated"
- Expected:
  - Connector-specific blockers should only apply to `EXISTING_WEBSITE` where connector flow is relevant.

### Bug 2: Existing Website Failed/Manual Path Does Not Persist Connector Status
- Severity: Medium
- Routes: `/setup/mvp`, `/master/workspaces`, `/dashboard/mvp-deployments/:workspaceId`
- Repro:
  1. Existing Website path.
  2. Generate token, run verify with unreachable domain (FAILED shown in setup panel).
  3. Choose Request support setup and complete installation.
  4. Check master workspaces connector status.
- Observed:
  - Connector status persisted as `NOT_CONNECTED`.
- Expected:
  - Failed/manual support route should persist `FAILED` or `SUPPORT_REQUIRED` so master visibility reflects actual state.

### Bug 3: Existing Website Platform Visibility Inconsistent Across Surfaces
- Severity: Medium
- Routes: `/master/workspaces` vs `/dashboard/mvp-deployments/:workspaceId`
- Repro:
  1. Complete Existing Website flow with `currentPlatform` as WordPress/WooCommerce.
  2. Open both routes.
- Observed:
  - `/master/workspaces` shows platform `WordPress/WooCommerce`.
  - Workspace detail page shows `Detected platform: Unknown`.
- Expected:
  - Both surfaces should consistently show platform using the same fallback strategy.

## Exact Routes Tested

- `/master-login`
- `/master`
- `/master/mvp-deployments`
- `/master/workspaces`
- `/master/launch-readiness`
- `/setup/mvp`
- `/portal`
- `/dashboard/mvp-deployments/ws_1779316388307_1j3ajhrp`

## Historical Recommendations (Superseded)

Superseded by SAFE MVP Blocker Fix Pass. The three priority blockers listed above have now been fixed and validated.

1. Fix launch readiness blocker scoping by website type.
- Apply connector blocker logic only when `websiteType === EXISTING_WEBSITE`.

2. Persist connector status on failed/manual existing-website completion.
- On verify failure and/or manual support route, persist connector status as `FAILED` or `SUPPORT_REQUIRED` at workspace level.

3. Normalize platform display fallback in workspace detail page.
- Use fallback order matching master list:
  - `connectorSiteMetadata.platform`
  - `collectedBusinessData.currentPlatform`
  - `Unknown`

4. Add explicit client-role smoke fixture for auth boundary validation.
- Provide one client-only demo user to validate `client user -> /master` denial path.

## Final QA Judgment

- Can this MVP be tested with a real client now?
  - Yes, for guided onboarding walkthrough and non-production pilot testing.
  - No, for readiness sign-off demos that depend on accurate launch blocker semantics.

- What must be fixed before demo?
  - Bug 1 (launch readiness connector blocker scoping).
  - Bug 2 (persist connector status for failed/manual existing-site paths).

- What can wait?
  - Bug 3 (cross-surface platform consistency).
  - Client-only auth fixture for full portal-separation proof.
