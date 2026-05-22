# MVP Demo Script

## Demo Objective

Show a clean guided walkthrough of the current Marveo MVP:
- internal admin access
- guided onboarding at `/setup/mvp`
- master visibility after workspace creation
- launch checklist and readiness surfaces
- existing website connector verification path

## Demo Accounts

### Internal admin
- Route: `/master-login`
- Username: `demo-admin`
- Password: use the local demo password from `.env.local`
- Notes:
  - This is internal-only demo access.
  - Demo mode is intended for local/internal rehearsal, not client-facing authentication.

### Client account
- No dedicated client-only demo identity is currently seeded.
- Use this as a talking point, not as a live proof of client-role access control.

## Routes To Visit

1. `/master-login`
2. `/master`
3. `/setup/mvp`
4. `/master/workspaces`
5. `/master/mvp-deployments`
6. `/master/launch-readiness`
7. Optional: `/dashboard/mvp-deployments/:workspaceId` after creating a workspace

## Expected Flow

### 1. Internal entry
- Sign in at `/master-login`.
- Open `/master`.
- Confirm internal control center renders and demo mode note is visible.

### 2. Guided setup
- Open `/setup/mvp`.
- Choose a plan.
- Enter business profile.
- Choose one onboarding path:
  - `NEW_WEBSITE` for the cleanest happy-path demo
  - `EXISTING_WEBSITE` if you want to show connector token + verification flow
  - `CUSTOM_HEADLESS` if you want to show support-required path

### 3. Review and installation
- Proceed to Review.
- Explain support requirement logic:
  - New Website: support optional unless selected
  - Existing Website: support required on manual/failure path
  - Custom/Headless: support expected
- Start installation.
- Wait for workspace ready state.

### 4. Internal visibility after setup
- Open `/master/workspaces`.
- Confirm workspace appears.
- Open `/master/mvp-deployments`.
- Confirm workspace appears in deployment queue.
- Open `/master/launch-readiness`.
- Show launch blockers/readiness summary.

### 5. Existing Website connector path
- On `/setup/mvp`, choose Existing Website.
- Generate connector token.
- Show installation instructions.
- Enter domain.
- Run Verify connection.
- Explain expected outcomes:
  - valid site: metadata and connector state update
  - invalid/unreachable site: failed/manual support path persists correctly

## Talking Points

- The MVP already supports a guided onboarding contract rather than a loose admin form flow.
- Existing Website onboarding is now safely scoped:
  - connector blockers apply only where connector verification is actually relevant.
- Master views now reflect connector and platform state consistently.
- Launch checklist and launch readiness are intentionally conservative and do not falsely mark workspaces launch-ready.
- Support routing is still intentionally lightweight but operationally visible.

## Known Limitations

- No full sync engine yet.
- No automated Vercel/GitHub deployment pipeline yet.
- Support assignment is placeholder queue routing.
- No dedicated client-only demo account is seeded yet.
- Payments/billing are not live integrations.

## What Not To Show Yet

- Do not position payment/billing as production-ready.
- Do not position template catalog as finalized.
- Do not position support officer matching as intelligent routing.
- Do not promise Shopify/Laravel/API connector parity yet.
- Do not demo `/portal` as a finished client-access proof unless a client-only test identity exists.
