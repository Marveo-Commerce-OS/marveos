# Free Trial and Entitlement Model

## Backend-Controlled Trial Fields
Stored in subscription records:
- `trialEnabled`
- `trialDurationDays`
- `trialStartDate`
- `trialEndDate`
- `status` (`TRIAL`, `ACTIVE`, `PAST_DUE`, `SUSPENDED`, `CANCELLED`, `EXPIRED`)

Trial duration is controlled by backend defaults and per-plan settings, not marketing frontend.

## Entitlement Gate Rules
`/setup/mvp` checks `GET /api/subscription/current`.

Outcomes:
- Active trial/subscription -> allow setup.
- Trial expired -> show clean upgrade-required state.
- No entitlement -> redirect to marketing pricing page.
- Internal roles -> bypass for support/demo/testing.

## Expiry Lock Behavior
Current lock metadata for trial expiry:
- allow login/view
- block publishing
- block launch
- block new workspace actions

This behavior is surfaced in API response and can be enforced by downstream surfaces.
