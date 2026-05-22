# Local Testing Checklist

Date: 2026-05-20
Scope: Access behavior validation for product-surface split (`/master`, `/portal`, `/setup/mvp`)

## Preconditions

- App runs locally (`npm run dev`)
- Browser cookies can be cleared between tests
- If using demo mode, set `.env.local`:

```env
MARVEO_DEMO_MODE=true
NEXT_PUBLIC_MARVEO_DEMO_MODE=true
MARVEO_DEMO_USERNAME=demo-admin
MARVEO_DEMO_PASSWORD=demo-pass-2026
NEXT_PUBLIC_MARVEO_DEMO_USERNAME=demo-admin
```

## Route Access Tests

### 1) Unauthenticated internal access

Steps:
1. Clear cookies.
2. Open `/master`.

Expected:
1. Redirect to `/master-login`.
2. In development, debug card may show `from=/master` and `error=auth_required`.

### 2) Unauthenticated internal sub-route access

Steps:
1. Clear cookies.
2. Open `/master/mvp-deployments`.

Expected:
1. Redirect to `/master-login`.

### 2b) Deployment queue naming

Steps:
1. Sign in as internal user.
2. Open `/master` and internal sidebar.

Expected:
1. Queue label is shown as `Deployment Queue`.
2. No visible `MVP Deployments` label in product UI navigation.

### 3) Unauthenticated client access

Steps:
1. Clear cookies.
2. Open `/portal`.

Expected:
1. Redirect to `/login`.
2. In development, debug card may show `from=/portal` and `error=auth_required`.

### 4) Internal login via master login

Steps:
1. Open `/master-login`.
2. Login with internal role user (`administrator` or `shop_manager`).

Expected:
1. Redirect to `/master`.
2. `/master/mvp-deployments` is accessible.

### 5) Client login via general login

Steps:
1. Open `/login`.
2. Login with client role user (`customer` or `subscriber`).

Expected:
1. Redirect to `/portal`.
2. `/master` should not be accessible.

### 6) Client blocked from master

Steps:
1. Login as client user.
2. Navigate to `/master`.

Expected:
1. Redirect to `/portal`.

### 6b) Client blocked from deployment queues

Steps:
1. Login as client user (`customer` or `subscriber`).
2. Navigate to `/master/mvp-deployments`.
3. Navigate to `/dashboard/mvp-deployments`.

Expected:
1. Both routes redirect to `/portal`.

### 7) Internal blocked from portal

Steps:
1. Login as internal user.
2. Navigate to `/portal`.

Expected:
1. Redirect to `/master`.

### 8) Root route behavior

Steps:
1. With internal session, open `/`.
2. With client session, open `/`.
3. With no session, open `/`.

Expected:
1. Internal session -> `/master`.
2. Client session -> `/portal`.
3. No session -> `/login`.

## Setup and Legacy Compatibility Checks

### 9) Setup gate still active for internal users

Steps:
1. Internal user logs in.
2. Force deployment status incomplete.
3. Navigate to `/master`.

Expected:
1. Redirect to `/setup`.

### 10) Legacy dashboard still preserved

Steps:
1. Internal user logs in.
2. Navigate to `/dashboard` and `/dashboard/mvp-deployments`.

Expected:
1. `/dashboard` route still functions.
2. `/dashboard/mvp-deployments` redirects to `/master/mvp-deployments`.

### 11) Portal menu isolation

Steps:
1. Login as client user and open `/portal`.
2. Review visible workspace sections.

Expected:
1. No internal queue links are visible.
2. No `Deployment Queue`, `MVP Deployments`, `Launch Readiness`, `Audit Logs`, or `System Settings` entries are shown.
3. Client-facing setup progress labels are visible (`My Setup`, `Launch Progress`, `Website Setup`).

## Test User Availability

- Demo user exists only in local demo mode:
  - Username: `demo-admin`
  - Password: `demo-pass-2026` (unless overridden)
- Client role users (`customer`, `subscriber`) are not auto-seeded by this phase and may need to be created in WordPress/admin user management.
- Internal `shop_manager` and `administrator` users must exist in WordPress (or equivalent auth source).
