# Commercial Onboarding Flow

## Goal
Public acquisition no longer enters `/setup/mvp` directly.
All public onboarding now follows pricing -> account/trial/payment -> entitlement -> MarveoOS onboarding.

## Canonical Flow
1. User opens marketing pricing page.
2. Marketing fetches live plans from `GET /api/public/plans` in MarveoOS.
3. User selects plan, billing interval, optional template, and submits onboarding start form.
4. Marketing calls `POST /api/public/onboarding/start` with:
   - payment mode (`TRIAL` or `PAID`)
   - billing interval (`MONTHLY` or `ANNUAL`)
5. MarveoOS creates or updates:
   - identity
   - organization
   - subscription/trial
   - onboarding session
6. Trial flow:
   - intended billing interval is stored
   - redirect URL to `/setup/mvp?session=...` is returned immediately
7. Paid flow:
   - pending paid subscription is created
   - payment verification validates amount/currency/interval
   - redirect URL is returned after successful verification
8. Setup gate calls `GET /api/subscription/current`.
9. Access outcomes:
   - `TRIAL`/`ACTIVE` -> allow setup
   - trial expired -> show upgrade-required state
   - no entitlement -> redirect to marketing pricing
   - internal role -> bypass allowed for demo/support/testing

## Template Source of Truth
Master templates are the canonical source in MarveoOS store.

Public visibility contract:
- `GET /api/public/templates`
- supports filters: `status`, `visibility`, `websiteType`, `country`, `planId`

Selection rules:
- only `ACTIVE` + `PUBLIC` templates are shown publicly
- onboarding/start validates selected template availability before creating session
- setup NEW_WEBSITE pulls template list from backend and respects plan/country/website type filters
- EXISTING_WEBSITE does not force template selection by default

## Trial Upgrade Path
Minimal safe upgrade support is now available through `POST /api/public/subscription/upgrade`.

Use cases:
- expired trial wants to continue with intended monthly or annual billing interval
- active trial wants to switch into a paid plan before expiry

Behavior:
- resolves subscription by session or email
- preserves or updates intended billing interval
- recalculates backend amount/currency from current plan source-of-truth
- marks subscription as `PAST_DUE` pending payment verification
- refreshes onboarding session so existing setup flow can continue after verification

## Internal Bypass
Internal/admin/support/demo users can continue to enter `/setup/mvp` directly when authenticated with internal roles.

## Public Blocking Rule
Public users without valid onboarding session or entitlement must not continue in `/setup/mvp`.
