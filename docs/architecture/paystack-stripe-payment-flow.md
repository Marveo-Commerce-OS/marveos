# Paystack and Stripe Payment Flow

## Nigeria / Paystack Flow
1. Marketing pricing fetches plan/pricing from MarveoOS with `country=NG`.
2. Backend responds with NGN pricing and recommended provider `PAYSTACK`.
3. Website starts onboarding with `paymentMode=PAID`.
4. MarveoOS creates:
   - identity
   - organization
   - subscription with status `PAST_DUE`
   - onboarding session
5. Website verifies payment through `POST /api/public/payment/verify`.
6. On successful verification, subscription becomes `ACTIVE` and redirect URL to `/setup/mvp?session=...` is returned.

## International / Stripe Flow
1. Marketing pricing fetches plan/pricing for non-NG country.
2. Backend responds with international pricing and recommended provider `STRIPE`.
3. Same orchestration applies as Paystack, but provider is `STRIPE`.

## Sandbox Mode
Current safe behavior:
- verification mode defaults to `sandbox`
- only sandbox/test/demo references should activate subscriptions
- arbitrary paid references must not auto-activate subscriptions

## Production Readiness Requirement
Before enabling live provider verification:
- provider secret keys configured
- provider verification service implemented
- webhook signature validation implemented
- duplicate event/idempotency handling tested
- subscription activation rules tested against failed/refunded/abandoned payments
