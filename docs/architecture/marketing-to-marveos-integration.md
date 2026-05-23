# Marketing to MarveoOS Integration

## Responsibilities

### Marketing Website
- Display pricing and conversion UX.
- Collect onboarding checkout payload.
- Proxy API calls to MarveoOS public onboarding endpoints.
- Redirect user to backend-provided onboarding URL.

### MarveoOS
- Serve plan/pricing/trial metadata.
- Create identity/org/subscription/onboarding session.
- Verify payment references (handoff scaffold).
- Enforce setup entitlement gate.

## API Endpoints

### 1) GET `/api/public/plans?country=NG`
Returns localized plans:
- `planId`, `name`, `description`
- `pricing.country`, `pricing.currency`, `pricing.amount`, `pricing.setupFee`
- `trial.available`, `trial.durationDays`
- `workspaceLimits.maxWorkspaces`
- `featureEntitlements`

### 2) POST `/api/public/onboarding/start`
Input:
- `selectedPlanId`
- `selectedTemplateId` (optional)
- `country`
- `currency` (optional)
- `customer.email`, `customer.name`, `customer.phone`, `customer.company`
- `paymentMode` (`TRIAL` or `PAID`)
- `paymentReference` (optional; required for `PAID`)
- `source` (`marketing_website`)

Output:
- `identityId`
- `organizationId`
- `subscriptionId`
- `subscriptionStatus`
- `onboardingSessionId`
- `redirectUrl`

### 3) GET `/api/subscription/current`
Used by setup gate.
Inputs:
- `session` query param (optional onboarding session id)
- authenticated identity context when available

Outputs:
- `entitled` boolean
- `reason`
- `subscription` object (when available)
- `redirectTo` marketing pricing URL when not entitled
- lock behavior metadata for expired trials

### 4) POST `/api/public/payment/verify`
Current phase: payment verification handoff scaffold.
Input:
- `paymentReference`
Output:
- mark matched subscription as `ACTIVE` or return not found.
