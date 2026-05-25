# Marveo Architecture Boundary Map (Phase 2)

This boundary map documents current ownership in the existing monorepo state and target domain ownership without moving live files yet.

## Domain Ownership Targets

## Master (internal control room)
- Owns: platform clients, licenses, plans, subscriptions, provisioning queue, workspace status, profession setup, support access, deployment status, template assignment, payment oversight.
- Current route surface:
  - `app/master/*`
  - `app/master-login/*`
  - `app/api/master/*`
- Current libs and contexts primarily aligned:
  - `lib/adminStore.ts`
  - `lib/commercialOnboarding.ts`
  - `lib/cloudOrchestration.ts`
  - `src/contexts/support/*`
  - `src/contexts/deployment/*`

## OS (client-facing operational workspace)
- Owns: bookings, orders, leads, enquiries, clients/customers, WhatsApp inbox, AI usage, inventory, team operations, reports/analytics, workspace settings.
- Current route surface:
  - `app/portal/*` (already OS-facing)
  - `app/dashboard/*` (legacy/transitional OS + mixed admin surface)
  - `app/api/orders/*`, `app/api/customers/*`, `app/api/products/*`, `app/api/reports/*`, `app/api/stores/*`, `app/api/pages/*`, `app/api/posts/*`, `app/api/media/*`

## Shared Core (must be domain-neutral)
- Owns: auth helpers, tenancy helpers, permissions, audit logs, notifications, payment provider interfaces, integration interfaces, common types.
- Current locations:
  - `lib/auth.ts`
  - `lib/nativeAuth.ts`
  - `lib/nativePasswords.ts`
  - `lib/emailNotifications.ts`
  - `lib/types.ts`
  - `src/config/*`
  - `src/lib/endpoints.ts`

## Public / Marketing
- Owns onboarding, pricing, and trial entry points only.
- Current route surface:
  - `app/page.tsx`
  - `app/login/*`
  - `app/docs/*`
  - `app/setup/*`
  - `app/api/public/*`

## API-only boundaries
- `app/api/master/*` -> Internal platform operations.
- `app/api/public/*` -> Public onboarding/pricing/trial/payment verify.
- `app/api/os/*` -> OS operations namespace (orders first-slice wrapper implemented).

## What Must Not Be Mixed
- Master provisioning and billing governance logic must not be embedded in OS UI modules.
- Public onboarding endpoints must not directly mutate privileged Master state without verified context.
- Connector/template package implementation must not be copied into OS runtime logic.
- Transitional adapter code in `src/lib/marveo.ts` and `src/components/MarveoProvider.tsx` must not become the canonical runtime path.

## Current Misplacements / Transitional Areas
- `app/dashboard/*` and `app/master/*` overlap in features (multiple `app/master/*` routes re-export from dashboard pages).
- `app/setup/*` currently redirects to `/dashboard`; target should align with OS (`/os`) boundary once aliases exist.
- Duplicate runtime/provider layer:
  - Canonical candidate: `lib/marveo.ts` and `components/MarveoProvider.tsx`
  - Transitional duplicate: `src/lib/marveo.ts` and `src/components/MarveoProvider.tsx`
- Mixed API naming:
  - Existing domain-neutral endpoints (`app/api/orders`, `app/api/products`, etc.) should move behind `app/api/os/*` adapters over time.
  - Legacy admin endpoints under `app/api/admin/*` overlap with `app/api/master/*`.

## Profession Config Integration Into OS
- Profession config source of truth:
  - `config/professions/index.ts`
  - `config/professions/makeup-artist.ts`
  - `config/professions/photographer.ts`
  - `config/professions/event-planner.ts`
- Runtime helper behavior:
  - `getProfessionConfig(professionKey)` now returns a safe validated config.
  - Unknown profession keys safely fallback to default profession.
  - Missing/unknown modules are filtered so OS dashboards do not crash.
- OS impact model:
  - Enabled modules drive feature visibility.
  - Dashboard widgets define role/profession homepage composition.
  - Sidebar navigation drives OS route exposure.
  - Onboarding questions and terminology shape setup and UX labels.

## Provisioning Integration (Current)
- Internal flow exposed for post-profile completion:
  - `lib/provisioning/profileCompletionFlow.ts`
  - `app/api/master/provisioning/profile-complete/route.ts`
- Current connected stages:
  - license/trial entitlement check
  - profession config resolution
  - module activation
  - default role creation
  - onboarding checklist generation
- Explicitly deferred:
  - template deployment automation
  - Vercel/domain provisioning

## Classification Snapshot (Phase 1)

## Master-owned
- `app/master/*`
- `app/master-login/*`
- `app/api/master/*`
- `lib/adminStore.ts`
- `lib/commercialOnboarding.ts`
- `lib/cloudOrchestration.ts`

## OS-owned
- `app/portal/*`
- Most business operations in `app/dashboard/*`
- `app/api/orders/*`, `app/api/customers/*`, `app/api/products/*`, `app/api/reports/*`, `app/api/stores/*`

## Shared core
- `lib/auth.ts`, `lib/nativeAuth.ts`, `lib/nativePasswords.ts`, `lib/emailNotifications.ts`, `lib/types.ts`
- `src/config/*`, `src/lib/endpoints.ts`

## Public/marketing
- `app/page.tsx`, `app/login/*`, `app/docs/*`, `app/setup/*`, `app/api/public/*`

## API only
- `app/api/**/*`

## Legacy/transitional
- `app/dashboard/*`
- `app/api/admin/*`
- `src/lib/marveo.ts`
- `src/components/MarveoProvider.tsx`

## Duplicate
- Runtime/provider responsibilities duplicated across root-level and `src/*` layers.
- Admin route surfaces duplicated between `app/master/*` and `app/dashboard/*` in several sections.

## Placeholder
- `lib/nativeAuth.ts` contains explicit placeholder password validation (`authenticateUser` TODO) and requires hardening.
