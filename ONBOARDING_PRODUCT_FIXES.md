# Onboarding Product Fixes

## 1) Business Type vs Profession Rules

- Business Type remains broad and required.
- Sector is stored separately and used to drive profession options.
- Profession is stored separately as `professionKey` and `professionLabel`.
- Custom fields are supported:
  - `customBusinessType`
  - `customProfessionName`
- `Other` is supported for both business type and profession.
- Profession config is applied only when the key maps to a known config.
- Unknown/custom profession falls back to generic service-business config.

## 2) Location Coverage Behavior

- Added configurable location structure for Nigeria in `config/locations/nigeria.ts`.
- Supports:
  - multiple states
  - multiple cities
  - custom coverage areas
- Stored profile fields:
  - `country`
  - `coverageStates: string[]`
  - `coverageCities: string[]`
  - `customCoverageAreas: string[]`

## 3) Website Setup Relocation

- Initial onboarding now runs profile-first flow and skips website connection setup UI path.
- Website setup/connection is no longer required to progress in initial onboarding.
- Initial onboarding hard-blocks legacy website steps (`website_type`, `details`) even if state is manipulated or restored from stale local storage.
- If a blocked website step is reached, onboarding redirects to the next allowed step and shows a safe guidance message.
- Website setup is reserved for: OS -> Setup Center -> Website.
- Workspace creation keeps safe internal defaults for website fields without exposing website connection decisions in first flow.

## 4) Required vs Optional Fields

Required fields enforced before progression from profile step:

- owner name
- email
- business name
- country
- business type (or custom business type when `Other`)
- sector where profession taxonomy applies
- profession where selected sector requires profession
- payment currency
- at least one coverage state or a custom coverage area
- terms acceptance

Optional fields are explicitly marked in UI:

- contact phone
- website URL
- custom coverage areas (optional unless no structured location selected)

Validation behavior:

- Inline field errors are shown.
- Required field failures block progression.
- Save/provision actions do not run until validation passes.
- API failures surface clear error messages.

## 5) Duplicate Email / Session Recovery Behavior

Added classification logic for onboarding recovery states:

- `completedWorkspace`
- `incompleteOnboarding`
- `activeTrial`
- `pendingPayment`
- `recoverableSession`
- `noExistingSession`

Behavior:

- Completed workspace: prompt login/reset password path.
- Incomplete setup: continue setup or start over.
- Active trial: continue to workspace.
- Pending payment: continue payment or restart.
- Recoverable no-session path supports verify email/start over guidance.

## 6) Provisioning Payload Structure

Provisioning now accepts and persists separated onboarding payload fields:

- `businessType`
- `sector`
- `professionKey`
- `customBusinessType`
- `customProfessionName`
- `country`
- `coverageStates`
- `coverageCities`
- `customCoverageAreas`
- `paymentCurrency`
- `onboardingAnswers`

Profession application rule:

- known `professionKey` => mapped profession config
- unknown/custom => generic service-business config

## 7) Remaining Limitations

- Legacy website UI code remains in codebase for backward compatibility, but initial onboarding now blocks access to website steps and routes users to allowed onboarding steps.
- Coverage taxonomy currently includes Nigeria-focused structured states/cities and uses custom areas for other countries.
- Existing lint warnings outside onboarding scope remain in unrelated dashboard/admin files.
