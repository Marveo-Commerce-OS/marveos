# Trust Flow Test Scaffolds

This repository currently does not have a dedicated automated test runner configured in package scripts.

Existing scripts:
- `npm run build`
- `npm run lint`
- `npm run dev`

Because of that, the files under `tests/trust-flows/` are lightweight TypeScript trust-flow scaffolds intended to:
- preserve focused coverage of production trust-flow cases,
- avoid adding heavy tooling without explicit approval,
- compile cleanly with the existing project TypeScript settings.

## Added Test Files

- `tests/trust-flows/payment-verification.test.ts`
- `tests/trust-flows/support-session.test.ts`
- `tests/trust-flows/workspace-access.test.ts`

## Cases Covered

### Payment verification
1. Fail-closed behavior when provider response is not successful.
2. Amount mismatch rejection.
3. Currency mismatch rejection.
4. Missing provider environment variable rejection.
5. Metadata mismatch rejection.

Notes:
- External provider APIs are mocked via `globalThis.fetch` replacement in test scaffolds.
- No real Paystack/Flutterwave/Stripe/PayPal calls are intended.

### Support OTP and support session
6. Support OTP expiry rejection.
7. Invalid support OTP rejection.
8. Support OTP attempt-limit rejection.
9. Invalid support session token rejection.
10. Expired support session token rejection.

### Workspace access
11. Workspace access denial (scaffolded).
12. Valid workspace access (scaffolded).

## Skipped / Scaffold-Only Cases

These remain scaffold-only until a deterministic module-mocking test harness is approved (for auth/session/admin-store isolation):
- Payment case: No paid activation happens without provider confirmation (integration-level state-transition assertion).
- Workspace access denial / valid access deterministic path forcing.
- Invalid support session cannot mutate workspace support routes (route integration harness required).

Reason:
- `requireWorkspaceAccess` and route handlers depend on runtime auth/store modules and Next.js request/response context.
- The repository currently has no configured runner/mocking stack (Jest/Vitest) for deterministic module substitution.

## How to Validate in Current Setup

1. Type check
- `npx tsc --noEmit`

2. Lint
- `npm run lint`

3. Build
- `npm run build`

4. Tests
- No `test` script exists in `package.json` at this time.
- If a runner is approved later, wire these files into that runner and remove scaffold-only skips.
