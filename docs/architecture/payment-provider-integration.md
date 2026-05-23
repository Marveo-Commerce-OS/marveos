# Payment Provider Integration

## Current State
Marveo commercial onboarding now supports provider-aware payment verification contracts, but real provider API verification/webhooks are intentionally not enabled in this phase.

Observed code state:
- `marveo-website` has no Paystack or Stripe SDK integration yet.
- `marveos` contains payment gateway settings placeholders in dashboard settings, but no production provider verification implementation.
- `POST /api/public/payment/verify` now accepts provider-aware verification inputs and safely supports sandbox verification mode.

## Supported Provider Direction
- Nigeria / NGN: Paystack
- International / USD and non-NG countries: Stripe

## Safe Phase 3A Scope
Implemented:
- provider-aware verification contract
- pending paid subscriptions until verification
- sandbox verification mode for controlled local/staging testing
- onboarding redirect returned only after successful verification

Deferred intentionally:
- provider SDK/embed checkout UI
- live provider API verification against Paystack/Stripe endpoints
- provider webhooks
- ledger/invoice reconciliation

## Recommended Next Safe Steps
1. Keep `MARVEO_PAYMENT_VERIFICATION_MODE=sandbox` in local and early staging.
2. Add provider checkout initiation server routes before any frontend SDK use.
3. Add provider transaction verification service in backend.
4. Add webhooks only after idempotency, signature verification, and retry handling are ready.

## Backend Contract Surfaces
- `GET /api/public/plans`
- `POST /api/public/onboarding/start`
- `POST /api/public/payment/verify`
- `GET /api/public/onboarding/session`
- `GET /api/public/onboarding/session/:sessionId`
- `GET /api/subscription/current`
