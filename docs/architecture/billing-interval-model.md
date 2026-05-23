# Billing Interval Model

## Supported Billing Intervals
- `MONTHLY`
- `ANNUAL`

## Plan Source of Truth
Each plan region stores:
- `currency`
- `monthly.amount`
- `monthly.setupFee`
- `annual.amount`
- `annual.setupFee`
- optional `annualDiscountPercent`
- trial settings
- workspace limits
- feature entitlements

## Subscription Model
Each commercial subscription stores:
- `billingInterval`
- `intendedBillingInterval`
- `amount`
- `currency`
- `status`

`billingInterval` is the active billing term for the subscription record.
`intendedBillingInterval` preserves user intent during trial and pre-activation paid flows.

## Trial Behavior
Trial subscriptions are still backend-controlled and not charged.
The selected interval is stored as intended interval so upgrade can continue with the user-selected monthly or annual preference.

Minimal upgrade support is exposed through `POST /api/public/subscription/upgrade`, which converts a trial or expired trial into a pending paid subscription using the intended interval unless an explicit interval override is provided.

## Verification Rules
Payment verification must validate against:
- provider
- selected plan
- billing interval
- amount
- currency
- organization/email context when provided
