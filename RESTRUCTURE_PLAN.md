# Safe Restructure Plan (Phase 3)

This plan is intentionally non-destructive and keeps the app deployable while introducing clean boundaries.

## Move Strategy
- `Move now` means create adapters/aliases/new canonical targets with no route removals.
- `Move later` means defer until imports, navigation, and auth/policy checks are fully migrated.

| Current file/path | Recommended new path | Reason | Risk | Dependencies | Move timing |
|---|---|---|---|---|---|
| `app/dashboard/*` | `app/os/*` | Dashboard is operational workspace surface (OS). | High | sidebar links, redirects, tests | Later (alias first) |
| `app/portal/*` | `app/os/*` (or retain as compatibility alias) | Already OS-facing; unify URL model. | Medium | auth redirect rules | Later |
| `app/master/*` | `app/(master)/master/*` (grouped) | Preserve master domain while introducing route group boundary. | Low | route group conventions | Move now (scaffold only) |
| `app/login/*`, `app/master-login/*`, `app/password/*` | `app/(auth)/*` | Keep auth isolated from business domains. | Medium | redirects and deep links | Later |
| `app/page.tsx`, `app/docs/*`, `app/setup/*` | `app/(public)/*` | Public marketing/onboarding entry separation. | Medium | onboarding redirects | Later |
| `app/api/orders/*`, `app/api/customers/*`, `app/api/products/*`, `app/api/reports/*`, `app/api/stores/*` | `app/api/os/*` adapters | Explicit OS API namespace. | Medium | frontend clients, integration tests | Move now (new namespace + wrappers), full cutover later |
| `app/api/admin/*` | `app/api/master/*` | Remove admin/master duplication. | Medium | current API consumers | Later |
| `lib/commercialOnboarding.ts` | `lib/provisioning/*` + `lib/billing/*` + `lib/professions/*` | Separate provisioning pipeline from billing policy and profession config. | High | state model in `adminStore`, onboarding API | Later (incremental extract) |
| `lib/cloudOrchestration.ts` | `lib/provisioning/*` | Master provisioning responsibility. | Medium | cloud/workspace APIs | Later |
| `lib/auth.ts` | `lib/auth/*` + `lib/permissions/*` | Split session/auth from authorization policy. | Medium | API route guards | Later |
| `lib/emailNotifications.ts` | `lib/notifications/*` | Shared notification abstraction. | Low | email templates and sender config | Move now (parallel wrapper) |
| `lib/types.ts` | `types/*.ts` | Shared domain types with explicit boundaries. | Low | import updates | Move now (types scaffold) |
| `src/lib/marveo.ts` | deprecate after consumers moved to `lib/marveo.ts` | Remove duplicate runtime layer. | Medium | `src/components/MarveoProvider.tsx` | Later |
| `src/components/MarveoProvider.tsx` | deprecate after migration to `components/MarveoProvider.tsx` | Remove duplicate provider implementation. | Medium | any `src` consumers | Later |

## Files That Can Move Now
- Create new bounded directories and add index/readme/type scaffolds.
- Introduce `config/professions/*` canonical profession configuration files.
- Introduce `lib/provisioning/*` staging API (non-automated).
- Introduce route group placeholders `app/(public)`, `app/(auth)`, `app/(master)`, `app/(os)`.

## Files To Delay
- Any existing live route in `app/dashboard/*`, `app/master/*`, `app/portal/*`.
- Existing API routes under `app/api/*` currently serving production features.
- Auth and billing internals until strict validation and tenant policies are in place.

## Execution Order
1. Add non-breaking scaffolds (done in this phase).
2. Add compatibility adapters (`/os` and `/api/os`) while preserving old endpoints.
3. Migrate imports to new lib domain paths behind barrel exports.
4. Move route handlers/pages in batches with regression checks.
5. Remove deprecated duplicates only after zero-usage validation.

## Compatibility Wrappers Implemented (Current Pass)
- OS route wrappers added (no logic duplication):
	- `app/(os)/os/layout.tsx` -> re-export from `app/portal/layout.tsx`
	- `app/(os)/os/page.tsx` -> re-export from `app/portal/page.tsx`
	- `app/(os)/os/orders/page.tsx` -> re-export from `app/dashboard/orders/page.tsx`
	- `app/(os)/os/orders/[id]/page.tsx` -> re-export from `app/dashboard/orders/[id]/page.tsx`
- OS API wrapper introduced for first safe module:
	- `app/api/os/orders/route.ts` -> uses shared module service and permission helpers.

## First Vertical Slice Migration: Orders

Chosen module: `orders` (low-risk operational module with existing API and UI).

### Identified surfaces
- Current UI route: `app/dashboard/orders/*`
- Current API route: `app/api/orders/route.ts`
- Data/service logic: WooCommerce update + audit logging

### New module boundary created
- `modules/orders/index.ts`
- `modules/orders/types.ts`
- `modules/orders/service.ts`
- `modules/orders/permissions.ts`
- `modules/orders/routes.md`

### Migration behavior
- Legacy route retained and working:
	- `app/api/orders/route.ts` now calls `modules/orders/service.ts`.
- New API route added:
	- `app/api/os/orders/route.ts`.
	- Enforces `workspaceId` and optional subscription entitlement via shared permission helpers.
- New OS UI aliases added:
	- `/os/orders` and `/os/orders/[id]` wrappers to legacy dashboard pages.

### Result
- First module migrated to bounded architecture without removing old routes or duplicating business logic.
