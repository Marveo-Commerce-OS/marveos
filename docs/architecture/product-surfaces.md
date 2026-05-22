# Product Surfaces

Date: 2026-05-20  
Phase: Route and product-surface cleanup

## Purpose

This document defines the three product surfaces in the current MarveoOS build and the safe migration posture from legacy internal routes.

## Surface A: Marveo Master Platform

Route root:
- `/master`

Audience:
- Internal Marveo team

Allowed roles:
- Super Admin (`administrator`)
- Admin/Support (`shop_manager`)

Current scope in this phase:
- Internal dashboard
- Workspaces and clients operations
- Deployment queue and workspace detail
- Deployment links and provisioning visibility
- Admin settings (when role permits)
- Existing internal commerce/reporting modules

Naming policy:
- Do not use "MVP" in visible product UI labels.
- Use "Deployment Queue" for internal queue surfaces.
- Use "Launch Queue" wording only in launch-readiness contexts.

Implementation notes:
- `/master` uses the same guarded internal shell model as legacy `/dashboard`.
- Existing internal pages are reused through route wrappers under `/master/*`.
- Internal sidebar in `/master` points to `/master/*` routes.

## Surface B: Marveo Client Workspace

Route root:
- `/portal`

Audience:
- Client users after onboarding/deployment

Allowed roles:
- Client Owner (`customer`)
- Client Staff (`subscriber`)

Current scope in this phase:
- Client-safe workspace shell
- No internal operations queue links
- No internal master platform navigation
- Client setup progress labels use: "My Setup", "Launch Progress", and "Website Setup"

Implementation notes:
- `/portal` layout now enforces client-only access.
- Internal roles are redirected from `/portal` to `/master`.
- `/portal` currently renders a minimal client workspace shell and module placeholders.

## Surface C: MVP Onboarding

Route:
- `/setup/mvp`

Audience:
- New deployments and setup flow participants

Status:
- Preserved as-is in this phase.

## Login and Redirect Policy

After successful login:
- Internal roles (`administrator`, `shop_manager`) -> `/master`
- Client roles (`customer`, `subscriber`) -> `/portal`
- Unsupported roles -> denied (403)

Recovery behavior:
- Internal users with incomplete setup/validation are redirected by master/dashboard layout guard to `/setup` (setup recovery path).

## Legacy Compatibility

Legacy internal routes remain active:
- `/dashboard`
- `/dashboard/*`

Compatibility policy:
- Do not remove legacy routes in this phase.
- Use `/master` as the canonical internal entry point going forward.
- Keep `/dashboard` available during migration and communicate deprecation in docs.

Legacy internal routes kept for compatibility:
- `/master/mvp-deployments` (canonical internal deployment queue)
- `/dashboard/mvp-deployments` (redirects to `/master/mvp-deployments`)

Access policy:
- Client roles (`customer`, `subscriber`) must be redirected to `/portal` when requesting either deployment queue route.

## Migration Plan (Non-Destructive)

Stage 1 (this phase):
- Introduce `/master` route surface
- Add role-aware redirects
- Gate `/portal` to client roles
- Preserve `/dashboard`

Stage 2 (next phase):
- Update all internal deep links and docs to prefer `/master`
- Add in-app deprecation notice on selected `/dashboard` pages if needed

Stage 3 (future):
- Remove `/dashboard` only after telemetry and QA confirm no dependency
- Keep permanent redirects from retired paths to `/master` equivalents
