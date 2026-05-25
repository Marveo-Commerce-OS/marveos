# Workspace Entitlement Audit

## Scope
This audit reviews workspace entitlement, workspace-cap enforcement, and plan/limit display paths in the Marveo OS codebase.

## Findings

### 1) Hardcoded Enforcement Sources (Pre-fix)
- `lib/adminStore.ts`
  - `PLAN_WORKSPACE_LIMITS` hardcoded map: starter=1, business=3, enterprise=999.
- `app/api/cloud/workspaces/route.ts`
  - Enforced limits using `PLAN_WORKSPACE_LIMITS`.
  - Mapped commercial `growth` to legacy `business` for enforcement.
- `app/api/cloud/deployment-links/route.ts`
  - Enforced limits using `PLAN_WORKSPACE_LIMITS`.
- `app/master/_lib/controlCenter.ts`
  - Hardcoded ternary workspace limit derivation from `accountPlan`.

### 2) UI/Metadata Sources
- `lib/adminStore.ts`
  - Commercial plan metadata includes per-plan `workspaceLimit`.
  - Example: `growth.workspaceLimit = 5`.
- `lib/commercialOnboarding.ts`
  - Public plans API exposes `workspaceLimits.maxWorkspaces` from commercial plans.
- `app/master/billing/page.tsx`
  - Displays commercial plan workspace limits.

### 3) Mismatch Risk Identified
- Commercial metadata: `growth.workspaceLimit = 5`.
- Legacy enforcement path: `growth -> business -> 3`.
- Resulting risk:
  - Billing mismatch
  - Onboarding inconsistency
  - Entitlement confusion
  - Support disputes

### 4) Plan Name Mismatch
- Legacy account plans: `starter`, `business`, `enterprise`.
- Commercial plans: `starter`, `growth`, `enterprise`.
- Existing code mixed both models in enforcement paths.

### 5) Workspace Count Scope Mismatch Risks
- Some paths counted global workspaces.
- Others scoped by client org/subscription.
- Public onboarding requires scoped counting to prevent cross-client bleed.

## Centralization Implemented

### Single Source of Truth
- New centralized resolver:
  - `lib/workspaceEntitlements.ts`
  - `resolveWorkspaceEntitlement(...)`
- Authority:
  - `store.cloud.commercial.plans[].workspaceLimit`
- Behavior:
  - Resolves plan from commercial metadata
  - Supports alias mapping for legacy naming (`business` <-> `growth`)
  - Computes scoped workspace usage (org/subscription) or global usage
  - Fails safely when plan metadata is missing/invalid

## Enforcement Paths Updated
- `app/api/cloud/workspaces/route.ts`
  - Replaced hardcoded map enforcement with centralized entitlement resolver.
  - Added safe failure (503) when plan metadata cannot resolve.
  - Added clear 402 payload with plan/limit/count/remaining on exhaustion.

- `app/api/cloud/deployment-links/route.ts`
  - Replaced hardcoded map enforcement with centralized entitlement resolver.
  - GET now reports plan/limit/count/remaining from centralized resolver.

- `app/master/_lib/controlCenter.ts`
  - Workspace limit snapshot now sourced from centralized resolver.

## Multi-workspace Governance Hardened
- `app/api/cloud/workspaces/route.ts`
  - Added duplicate-creation safeguards:
    - Reuses existing workspace for same onboarding session when detected.
    - Prevents accidental duplicate pending workspace creation from stale/repeated submissions by fingerprint checks (name/email/baseUrl) within same org/subscription and recent time window.
  - Legitimate multi-workspace creation remains supported when entitlement allows.

## Onboarding UX Alignment
- `app/api/public/onboarding/session/[sessionId]/route.ts`
  - Added `workspaceEntitlement` summary in response.

- `app/setup/mvp/page.tsx`
  - Hydrates and displays active workspace entitlement (used/limit/remaining).
  - Blocks start-install button when capacity is exhausted.
  - Shows clear upgrade message when at cap.
  - Updated completion CTA copy from `Start another setup` to `Create another workspace`.

## Residual Risks / Follow-ups
- Legacy `accountPlan` model still exists for platform defaults and some admin settings.
- Alias mapping (`business` <-> `growth`) remains required while both naming schemes coexist.
- Commercial plan editing in admin portal remains mostly read/display focused; full per-plan CRUD governance is still a follow-up area.

## Files touched by this fix
- `lib/workspaceEntitlements.ts` (new)
- `app/api/cloud/workspaces/route.ts`
- `app/api/cloud/deployment-links/route.ts`
- `app/master/_lib/controlCenter.ts`
- `app/api/public/onboarding/session/[sessionId]/route.ts`
- `app/setup/mvp/page.tsx`
- `WORKSPACE_ENTITLEMENT_AUDIT.md` (new)
