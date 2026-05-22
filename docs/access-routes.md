# MarvéoOS Access Routes

Last updated: 2026-05-20  
Build: Phase 2F

---

## Route Map

### 1. Master Platform Login

| Field | Value |
|---|---|
| Route | `/login` |
| Auth required | None — public |
| After login (operator) | Navigate to `/dashboard` |
| After login (client/demo) | Redirected to `/portal` |
| Forgot password | `/login/forgot-password` |

Login calls `POST /api/auth/login` with `{ username, password }`.  
On success, sets `admin_token` and `admin_user` HTTP-only cookies (7-day expiry).

---

### 2. Master Platform Dashboard

| Field | Value |
|---|---|
| Route | `/dashboard` |
| Auth required | Valid session cookie (`admin_token`) |
| Role required | WordPress role `administrator` **or** `shop_manager` |
| Additional gate | `setup_completed = true` AND `validation_passed = true` (from connector plugin status) |
| If not authenticated | Redirect → `/login` |
| If role insufficient | Redirect → `/login?error=unauthorized` |
| If setup incomplete | Redirect → `/setup` |

Super admin (`administrator` role) has full access to all dashboard sub-routes.  
`shop_manager` role is limited to modules allowed by `roleModuleVisibility` in adminStore.

---

### 3. MVP Deployments Queue

| Field | Value |
|---|---|
| Route | `/dashboard/mvp-deployments` |
| Auth required | Inherits dashboard layout — same as `/dashboard` |
| Role required | `administrator` or `shop_manager` (isAdmin) |
| Workspace detail | `/dashboard/mvp-deployments/[workspaceId]` |

This is the internal operations queue for managing client onboarding deployments.

---

### 4. Client MVP Onboarding Wizard

| Field | Value |
|---|---|
| Route | `/setup/mvp` |
| Auth required | None — setup layout has no session gate |
| Feature flag | `NEXT_PUBLIC_ENABLE_MVP_ONBOARDING` must not be `false` |
| API calls within wizard | All call admin-authenticated endpoints — require session cookie |

In a live deployment the wizard is operated by a logged-in admin on behalf of the client.  
The setup layout (`/setup/layout.tsx`) applies no auth gate.

---

### 5. Client Workspace Portal

| Field | Value |
|---|---|
| Route | `/portal` |
| Auth required | Valid session cookie (`admin_token`) |
| Role required | Any authenticated user (no WP role check beyond session) |
| If not authenticated | Redirect → `/login` |

The portal layout (`/portal/layout.tsx`) calls `getSession()` only — it does not check WP roles.  
This is the client-facing landing page after login.

---

### 6. Setup / Activation

| Field | Value |
|---|---|
| Route | `/setup` |
| Auth required | None |
| Route | `/setup/activate` |
| Auth required | None |

`/setup` displays deployment status and blocks access to `/dashboard` until `setup_completed` and `validation_passed` are true. In demo mode these are bypassed.

---

## Role Summary

| Route | Session required | WP Role | Super admin only |
|---|---|---|---|
| `/login` | No | — | — |
| `/portal` | Yes | Any | No |
| `/setup` | No | — | — |
| `/setup/activate` | No | — | — |
| `/setup/mvp` | No (UI) / Yes (API) | Admin/manager (API) | No |
| `/dashboard` | Yes | administrator, shop_manager | No |
| `/dashboard/mvp-deployments` | Yes | administrator, shop_manager | No |
| `/dashboard/mvp-deployments/[id]` | Yes | administrator, shop_manager | No |
| `/dashboard/workspaces` | Yes | administrator, shop_manager | No |
| `/dashboard/deployment` | Yes | administrator, shop_manager | No |

### API-level Role Requirements (key routes)

| API Route | Minimum Role |
|---|---|
| `POST /api/auth/login` | Public |
| `GET /api/cloud/workspaces` | isAdmin (administrator or shop_manager) |
| `POST /api/cloud/workspaces` | isAdmin |
| `GET/PUT /api/cloud/workspaces/:id/onboarding` | isSuperAdmin (administrator only) |
| `GET/POST /api/cloud/workspaces/:id/launch-guard` | isSuperAdmin |
| `GET /api/cloud/workspaces/lookups` | isSuperAdmin |
| `GET/POST /api/cloud/deployment-links` | isAdmin |
| `GET/POST /api/cloud/deployment-links/:id` | isSuperAdmin |
| `GET/POST /api/cloud/workspaces/:id/connector` | isAdmin |
| `POST /api/cloud/workspaces/:id/connector/verify` | isAdmin |
| `POST /api/connector/check` | isAdmin |
| `GET/DELETE /api/admin/audit` | isSuperAdmin |
| `GET/POST/PUT /api/admin/users` | isAdmin (GET), isSuperAdmin (POST/PUT) |
| `POST /api/admin/smtp-test` | isSuperAdmin |

---

## Demo / Local Development Access

Demo mode is **already implemented** in the codebase. It bypasses WordPress API authentication and the setup completion gate — no real WordPress backend is required.

### Enable Demo Mode

Add these to your `.env.local` file:

```env
# Enable demo auth bypass (server-side check)
MARVEO_DEMO_MODE=true

# Enable demo UI hints in login page (shows pre-filled username)
NEXT_PUBLIC_MARVEO_DEMO_MODE=true

# Optional: override default demo credentials
MARVEO_DEMO_USERNAME=demo-admin
MARVEO_DEMO_PASSWORD=demo-pass-2026

# Optional: expose username in login form
NEXT_PUBLIC_MARVEO_DEMO_USERNAME=demo-admin
```

### Default Demo Credentials

| Field | Value |
|---|---|
| Username | `demo-admin` |
| Password | `demo-pass-2026` |

These defaults are used when `MARVEO_DEMO_USERNAME` / `MARVEO_DEMO_PASSWORD` env vars are not set.

### Demo Mode Behaviour

- `POST /api/auth/login` accepts the demo credentials without calling WordPress JWT API.
- Session cookie is set with `roles: ['administrator']` and `isAdmin: true`.
- `getRuntimeDeploymentStatus()` returns `setup_completed: true, validation_passed: true` — dashboard is accessible.
- Demo login redirects to `/portal` by default. Navigate manually to `/dashboard` for the operator interface.
- Demo session expires after 7 days (same as live sessions).

### What Demo Mode Does NOT Cover

- Real WooCommerce data (orders, products, customers return empty or error).
- Remote connector plugin verification — `/api/connector/check` and `/api/connector/verify` will fail unless a real WordPress site is reachable.
- SMTP email sending.
- Real audit log entries from WordPress user actions.

### Production Safety

Demo mode is guarded by `process.env.NODE_ENV !== 'production'`. It **cannot be activated in production** regardless of env var values — the `isDemoAuthEnabled()` and `isDemoMode()` functions both enforce this check.

---

## Root Page Behaviour

`/` (root) redirects:
- To `/dashboard` if a valid session cookie exists.
- To `/login` if no session.
