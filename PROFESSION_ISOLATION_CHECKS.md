# Profession Isolation Checks

This repository does not currently expose a dedicated test runner script.

The checks below document the safety behavior that must hold for profession isolation:

1. missing professionKey => generic config
- Input: `professionKey` is missing in profile completion.
- Expected: resolver returns `generic-service-business`.
- Expected modules: `leads, clients, payments, reports, team`.

2. unknown professionKey => generic config
- Input: `professionKey="unknown-role"`.
- Expected: resolver returns `generic-service-business`.
- Expected: no makeup widgets/modules applied.

3. makeup-artist => makeup config
- Input: `professionKey="makeup-artist"`.
- Expected: makeup modules/widgets/checklist/roles are applied.

4. photographer => photographer config if available, otherwise generic
- Input: `professionKey="photographer"`.
- Expected: photographer config (known key) applies.
- If key is unavailable in registry, fallback to generic.

5. no onboarding profession => no makeup modules
- Input: setup/profile completed without selecting profession.
- Expected: generic profession is resolved.
- Expected: no makeup-only module activation.

6. makeup selected => makeup modules applied
- Input: setup/profile selected makeup-artist.
- Expected: makeup profession key persisted in workspace profile.
- Expected: makeup modules activated only for that workspace.

## Manual Validation Pointers

- Resolver source:
  - `config/professions/index.ts`
  - `resolveProfessionConfig(professionKey)`

- Dashboard isolation:
  - `app/(os)/os/dashboard/page.tsx`
  - uses explicit `professionKey` from workspace profile/collected data.

- Provisioning isolation:
  - `lib/provisioning/profileCompletionFlow.ts`
  - preserves existing profession unless explicit override.
  - stores onboarding answers under `professionOnboardingAnswersByKey[professionKey]`.

- Setup capture safety:
  - `app/setup/mvp/page.tsx`
  - profession defaults are empty and makeup answers are only submitted when makeup is explicitly selected.
