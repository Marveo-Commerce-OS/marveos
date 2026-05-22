# Master Platform UI (Control Center)

Date: 2026-05-20
Phase: Product-surface cleanup (Master Platform UI)

## Goal

Reposition `/master` as the Marveo operating control center, not as a single website management dashboard.

Key product rule:
- Master Platform manages Marveo business operations across clients, workspaces, deployments, support, connectors, templates, billing, and system operations.
- If Marveo itself needs website management, Marveo should be represented as a client/workspace.

## Canonical Master Sidebar

Required sidebar for `/master`:
- Overview
- Clients
- Workspaces
- MVP Deployments
- Support Queue
- Launch Readiness
- Connectors
- Templates
- Plans & Billing
- Audit Logs
- System Settings

Removed from Master sidebar:
- Pages
- Blog
- Products
- Orders
- Customers
- Reports
- Advanced Settings

These legacy website-management modules remain under `/dashboard` during migration.

## Master Routes

- `/master` -> Control Center overview
- `/master/clients` -> client account/organization list
- `/master/workspaces` -> workspace operations list
- `/master/mvp-deployments` -> existing MVP queue (preserved)
- `/master/support` -> support assignment queue
- `/master/launch-readiness` -> readiness aggregation across workspaces
- `/master/connectors` -> connector status and roadmap tracks
- `/master/templates` -> template catalog status
- `/master/billing` -> plans/subscription footprint
- `/master/audit-logs` -> sensitive action/audit history
- `/master/system-settings` -> internal platform settings (read-only where needed)

## Data Classification (Live vs Placeholder)

Live data currently used:
- Workspace counts and status
- Client list derived from workspace/business profile data
- Support assignment state
- Launch blocker signals from workspace orchestration and connector state
- Connector status counts
- Audit log entries
- Account plan and workspace limit usage
- Maintenance setting state

Placeholder / not yet connected:
- Revenue analytics and subscription ledger details
- Payment provider integration
- Shopify/Laravel/Custom API connector operations
- Template catalog CRUD workflows
- Full system settings editing from Master UI (read-only indicators shown)

## Backward Compatibility

Preserved in this phase:
- `/dashboard` and `/dashboard/*` routes remain available (legacy internal surface)
- `/portal` remains the client workspace surface
- `/setup/mvp` remains unchanged

Not changed in this phase:
- Connector plugin implementation
- Onboarding flow implementation
- Legacy dashboard feature logic

## UX Notes

- `/master` no longer renders WooCommerce revenue/orders/pages/products as primary master overview signals.
- Master overview emphasizes operational KPIs: clients, workspaces, deployments, support, launch blockers, connectors, failures.
- Placeholders are explicitly labeled as "Coming soon" or "Not yet connected" to avoid implying backend support that does not exist yet.
