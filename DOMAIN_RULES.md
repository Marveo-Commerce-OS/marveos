# Domain Rules (Phase 4)

## Master Owns
- Platform clients
- Licenses
- Plans
- Subscriptions
- Provisioning queue
- Workspace status
- Profession setup
- Support access
- Deployment status
- Template assignment
- Payment oversight

Implementation note:
- Master orchestration should live in `lib/provisioning/*`, `lib/billing/*`, `lib/support-access/*`, and `app/api/master/*`.

## OS Owns
- Bookings
- Orders
- Leads and enquiries
- Clients/customers
- WhatsApp inbox
- AI assistant usage
- Inventory
- Team operations
- Reports and analytics
- Client workspace settings

Implementation note:
- OS feature modules should live under `modules/*` and be exposed via `app/os/*` and `app/api/os/*`.

## Shared Core Owns
- Authentication helpers
- Tenancy helpers
- Permissions
- Audit logs
- Notifications
- Payment provider interfaces
- Integration interfaces
- Common types

Implementation note:
- Shared code should remain framework-agnostic where possible and avoid importing from route/page layers.

## Mixing Rules
- `app/master/*` must not directly depend on `modules/*` feature implementations without a shared service boundary.
- `app/os/*` must not mutate Master-only governance entities directly.
- `app/api/public/*` must never bypass auth, tenant checks, or payment verification policy.
- Connector/template repo logic must stay package-driven and not be copied into `app/*` business flows.
- Transitional aliases are allowed only when marked and tracked in `RESTRUCTURE_PLAN.md`.
