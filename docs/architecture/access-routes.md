# Access Routes (Product-Surface Split)

Date: 2026-05-20

## Route Audit

### `/master-login`

Purpose:
- Internal Marveo Control Center login for operations team.

Behavior:
- Uses the same backend login endpoint (`POST /api/auth/login`) as other login surfaces.
- Intended for internal users (`administrator`, `shop_manager`).

Redirect on success:
- Internal roles -> `/master`
- Client roles -> `/portal`

If redirected here due to denied access:
- In development, query debug is shown (`from`, `error`, `roles` when available).

### `/login`

Purpose:
- General/client login entry.

Behavior:
- Verifies WordPress JWT credentials (or demo credentials in local demo mode).
- Classifies role into internal vs client surface.
- Includes link to `/master-login` for internal team.

Redirect on success:
- `administrator` / `shop_manager` -> `/master`
- `customer` / `subscriber` -> `/portal`

### `/master`

Purpose:
- Canonical internal platform root.

Access:
- Session required.
- `isAdmin` guard required (`administrator` or `shop_manager`).
- Setup validation required (`setup_completed` and `validation_passed`), otherwise redirect to `/setup`.
- If unauthenticated -> redirect to `/master-login`.
- If authenticated client role (`customer` / `subscriber`) -> redirect to `/portal`.

### `/master/mvp-deployments`

Purpose:
- Internal MVP deployments queue.

Access:
- Inherits `/master` guard.

Detail route:
- `/master/mvp-deployments/[workspaceId]`

### `/master/workspaces`

Purpose:
- Internal workspace/client orchestration.

Access:
- Inherits `/master` guard.

### `/portal`

Purpose:
- Client workspace surface.

Access:
- Session required.
- Client role required (`customer` or `subscriber`).
- Internal roles redirected to `/master`.
- If unauthenticated -> redirect to `/login`.
- If unknown role -> redirect to `/login?error=unauthorized`.

Current rendering:
- Minimal client workspace shell with safe module placeholders.
- Does not expose internal operations navigation.

### `/setup/mvp`

Purpose:
- MVP onboarding flow for deployment setup.

Access:
- Preserved as-is.

## Preserved Legacy Internal Routes

Still active for backward compatibility:
- `/dashboard`
- `/dashboard/mvp-deployments`
- `/dashboard/workspaces`
- `/dashboard/*`

Migration note:
- `/master` is the canonical internal route surface.
- `/dashboard` remains temporarily for compatibility and phased migration.

## Allowed Role Map

Internal platform roles:
- `administrator` (Super Admin/Admin)
- `shop_manager` (Admin/Support)

Client workspace roles:
- `customer` (Client Owner)
- `subscriber` (Client Staff)

Denied:
- Roles outside the above sets are rejected at login.

## Redirect Matrix

After login:
- Internal -> `/master`
- Client -> `/portal`
- Unsupported role -> 403

During navigation:
- `/portal` + internal role -> redirect `/master`
- `/portal` + no session -> redirect `/login`
- `/master` + no session -> redirect `/master-login`
- `/master` + client role -> redirect `/portal`
- `/master` or `/dashboard` + incomplete setup -> redirect `/setup`
- `/` with session -> internal to `/master`, client to `/portal`
- `/` without session -> `/login`

Development debug behavior:
- In non-production environments, denied/redirected login pages may include query debug values (`from`, `error`, `roles`) for troubleshooting access behavior.

## Current Support Coverage

What `/master` currently supports:
- Internal dashboard and module navigation
- Workspaces
- MVP deployments queue and detail
- Deployment links
- Admin settings (role-dependent)

What `/portal` currently supports:
- Client-only workspace shell (placeholder stage)
- No internal operation tools

## Future Migration Plan

1. Replace remaining hardcoded `/dashboard` links across internal views with `/master` links.
2. Add optional visible deprecation banners on key `/dashboard` pages.
3. Once usage drops to zero and QA passes, convert `/dashboard/*` to permanent redirects into `/master/*`.
