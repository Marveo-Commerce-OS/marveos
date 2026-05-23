# Pilot Environment Checklist

## marveo-website
Required env vars:
- `MARVEO_OS_BASE_URL`
- `NEXT_PUBLIC_MARVEO_OS_BASE_URL` (optional mirror)
- `NEXT_PUBLIC_SITE_URL`

## marveos
Required env vars:
- `MARVEO_APP_BASE_URL`
- `NEXT_PUBLIC_MARKETING_PRICING_URL`
- `MARVEO_PAYMENT_VERIFICATION_MODE=sandbox`
- `WORDPRESS_API_URL` or existing WordPress config inputs used by current auth/runtime
- JWT/auth/session env vars already required by current app deployment
- plugin update URL env vars already used by connector/update surfaces

## Payment provider placeholders
Pilot-safe defaults:
- Paystack public key: optional, do not rely on live mode yet
- Paystack secret key: leave unset unless verification service is implemented
- Stripe publishable key: optional, do not rely on live mode yet
- Stripe secret key: leave unset unless verification service is implemented

## URLs
- Marketing URL points to pilot website domain
- App URL points to pilot MarveoOS domain
- pricing redirect from app resolves back to marketing pricing page

## Readiness checks
- NG requests return NGN pricing
- non-NG requests return international pricing
- trial flow redirects into `/setup/mvp`
- paid sandbox flow activates only with sandbox/test references
- public direct `/setup/mvp` access redirects to pricing without entitlement
- internal admin/support bypass still works
