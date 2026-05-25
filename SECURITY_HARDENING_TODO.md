# Security Hardening TODO (Phase 8)

## Completed In This Pass
- Native credential validation hardened in `lib/nativeAuth.ts`:
	- Removed placeholder password behavior.
	- Added secure password hash verification via `lib/nativePasswords.ts`.
	- Added non-enumerating authentication behavior (uniform failure path).
	- Session issuance remains post-verification only.
- Payment verification path hardened in `lib/commercialOnboarding.ts`:
	- Production now requires `provider_api` verification mode.
	- Sandbox-trust path blocked in production.
	- Paid plan activation now depends on provider verification hook.
	- Trial and paid activation remain separated.
- Public endpoint hardening added:
	- Shared validation + rate-limit guard in `lib/security/requestGuards.ts`.
	- Applied to all `app/api/public/*` endpoints.
- Tenant and role helper primitives added in `lib/permissions/access.ts`:
	- `requireWorkspaceAccess()`
	- `requireMasterAccess()`
	- `requireOSAccess()`
	- `requireSubscriptionEntitlement()`
- Support access hardening added in `lib/support-access/session.ts`:
	- Explicit support session token validation.
	- Expiration enforcement.
	- Audit log on validated support-session usage.
	- Enforced on support assignment mutation endpoints.

## Critical
- Provider integrations for `verifyProviderPayment` are still stubbed and must be completed per provider SDK/API.
- Add full schema validation library (e.g., zod-based schemas) to replace route-level parsing for all mutation routes.

## High
- Roll out `requireWorkspaceAccess()` across remaining workspace-scoped cloud routes.
- Normalize older `ensureAdminSession()` route guards to use shared permission helpers.
- Add dedicated support-session issuance endpoint with OTP challenge before session token generation.

## Medium
- Add persistent/distributed rate limiting backend (current limiter is process-local and TODO-safe only).
- Strengthen session controls: rotation, idle timeout, and revocation checks across native and wordpress-bridge sessions.
- Add CSRF review for cookie-authenticated mutation routes.

## Low
- Consolidate auth debug query params usage to prevent accidental role leakage in non-dev contexts.
- Add security regression tests for role boundaries (Master vs OS vs Public).

## Tracking Matrix
- Placeholder auth: `COMPLETED`
- Weak payment verification: `PARTIAL` (provider integrations pending)
- Public endpoint strict validation: `PARTIAL` (schema framework rollout pending)
- Tenant isolation gaps: `PARTIAL` (helpers added + runtime endpoint enforced, wider rollout pending)
- Role permission risks: `PARTIAL` (shared helpers added, legacy routes pending migration)
- Support access risks: `PARTIAL` (session enforcement added, OTP-backed issuance pending)
