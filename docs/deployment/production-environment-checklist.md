# Production Environment Checklist

## marveo-website
Required env vars:
- `MARVEO_OS_BASE_URL`
- `NEXT_PUBLIC_MARVEO_OS_BASE_URL` (optional)
- canonical site URL / analytics / cookie domain settings as required by deployment platform

## marveos
Required env vars:
- `MARVEO_APP_BASE_URL`
- `NEXT_PUBLIC_MARKETING_PRICING_URL`
- `MARVEO_PAYMENT_VERIFICATION_MODE`
- WordPress auth/session/runtime configuration already required by platform
- plugin update URL configuration
- admin config persistence credentials if using WordPress-backed admin config store

## Payment providers
Do not set production verification mode until these exist:
- Paystack secret key
- Stripe secret key
- webhook secrets
- provider verification implementation
- idempotency strategy
- refund/cancellation handling

## Auth and session
- login domain alignment verified
- cookie security flags verified
- cross-domain redirect flow tested between marketing and app domains

## Operational checks
- pricing API reachable from marketing
- onboarding start API reachable from marketing
- payment verify API returns safe failure when provider verification is not enabled
- onboarding recovery API works by session and email
- expired trials show upgrade-required state

## Release gate
Do not promote to production until sandbox-only assumptions are removed or explicitly accepted for the target environment.
