# Pricing and Subscription Source of Truth

## Source of Truth
Marveo Master (MarveoOS backend state) owns:
- plan definitions
- regional pricing and currencies
- billing intervals (`MONTHLY`, `ANNUAL`)
- trial defaults and per-plan trial capability
- workspace limits
- feature entitlements
- identities, organizations, subscriptions, onboarding sessions

Current persisted source: `cloud.commercial` in `lib/adminStore.ts`.

## Why
This prevents drift between marketing and platform billing logic and guarantees one canonical pricing model.

## Marketing Contract
Marketing surfaces pricing UX but must render values returned by backend plan APIs.
Static pricing fallback is allowed only for resilience when API fails.
Frontend must not hardcode monthly or annual prices as a source of truth.

## Pricing Interval Model
Public plans now expose interval-based pricing:
- `pricing.monthly.amount`
- `pricing.monthly.setupFee`
- `pricing.annual.amount`
- `pricing.annual.setupFee`
- optional `pricing.annualDiscountPercent`

Subscriptions also persist:
- `billingInterval`
- `intendedBillingInterval`

## Subscription Status Model
Implemented/scaffolded statuses:
- `TRIAL`
- `ACTIVE`
- `PAST_DUE`
- `SUSPENDED`
- `CANCELLED`
- `EXPIRED`

Setup entitlement currently grants onboarding only for `TRIAL` and `ACTIVE`.
