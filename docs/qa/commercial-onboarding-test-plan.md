# Commercial Onboarding Test Plan

## Pricing source of truth
- Confirm pricing page requests backend plans API.
- Confirm Nigeria monthly pricing renders NGN values returned by backend.
- Confirm Nigeria annual pricing renders NGN values returned by backend.
- Confirm non-Nigeria monthly pricing renders international values returned by backend.
- Confirm non-Nigeria annual pricing renders international values returned by backend.
- Confirm fallback static pricing is shown only when plans API fails.

## Trial flow
- Start trial from pricing page.
- Confirm backend creates identity, organization, subscription, and onboarding session.
- Confirm subscription status is `TRIAL`.
- Confirm `intendedBillingInterval` matches the selected monthly or annual interval.
- Confirm redirect enters `/setup/mvp?session=...`.

## Paid flow
- Start paid monthly onboarding with sandbox reference.
- Confirm initial subscription status is not `ACTIVE` before verification.
- Confirm verification activates a monthly subscription and returns onboarding redirect URL.
- Start paid annual onboarding with sandbox reference.
- Confirm verification activates an annual subscription and returns onboarding redirect URL.
- Confirm invalid payment reference does not activate subscription.
- Confirm amount mismatch or interval mismatch does not activate subscription.

## Trial enforcement
- Force trial end date into the past.
- Confirm backend marks trial as expired.
- Confirm `/setup/mvp` shows clean upgrade-required state.
- Confirm user can still login/view but cannot continue onboarding actions requiring entitlement.

## Trial upgrade path
- Prepare upgrade by session ID for expired trial and confirm backend returns pending paid amount/currency/provider.
- Prepare upgrade by email for expired trial and confirm intended billing interval is preserved.
- Override upgrade interval and confirm backend recalculates amount for the new interval.
- Verify prepared upgrade payment and confirm subscription activates and onboarding redirect remains usable.

## Recovery
- Start trial, close browser, recover by session ID.
- Start trial, close browser, recover by email.
- Start paid sandbox flow, verify payment, close browser, recover session and continue.

## Access control
- Confirm public direct `/setup/mvp` without entitlement redirects to pricing.
- Confirm internal admin/support/demo user can still access `/setup/mvp` directly.
- Confirm `/master` and `/portal` continue to load normally.

## Non-scope regression check
- Confirm WordPress connector flows remain unchanged.
- Confirm no Next.js adapter or marketplace paths were introduced.
