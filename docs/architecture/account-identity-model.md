# Account and Identity Model

## One-Account Principle
Marketing and MarveoOS share one identity lifecycle.
No separate website-only account should be created during checkout.

## Entities
- `Identity`: user-level record keyed by email.
- `Organization`: commercial account context owned by identity.
- `Subscription`: plan, currency, amount, trial and payment status.
- `OnboardingSession`: short-lived setup continuation token.

## Current Implementation Notes
- Identity is upserted by normalized email in backend onboarding start endpoint.
- Organization is created/reused for identity.
- Subscription is created from selected plan and localized pricing.
- Onboarding session is generated and passed to `/setup/mvp?session=...`.

## WP/Auth Coexistence
Current auth remains WordPress-backed for existing internal/client access.
Commercial identity scaffolding is introduced to orchestrate onboarding entitlement now without breaking pilot authentication surfaces.
