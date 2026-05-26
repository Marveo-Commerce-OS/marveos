# MASTER OPERATIONAL PERMISSION MODEL

Last updated: 2026-05-26
Scope: Marveo Master internal role operations model.

## 1) Role definitions

- Super Admin: Full platform ownership, policy and security control.
- Admin: Operational owner for cross-team execution without deep security policy ownership.
- Customer Support: Ticket desk, complaints, client communication, and support sessions.
- Technical Support: Connector and deployment technical triage and issue resolution.
- Deployment Manager: Deployment queue ownership, launch readiness, and approvals.
- Billing Manager: Subscription lifecycle, payments, billing actions, and billing escalations.

## 2) Module definitions

- Overview
- Clients
- Workspaces
- Deployment Queue
- Support Queue
- Tickets
- Defined Replies
- Launch Readiness
- Connectors
- Billing
- Reports
- Analytics
- System Settings
- Role Privileges

## 3) Action permissions

Action keys supported:
- view
- create
- update
- delete
- assign
- approve
- export

Compatibility rule:
- If only legacy module boolean exists, it resolves into a role-safe action profile.
- Legacy booleans remain supported while action maps become the primary enforcement source.

## 4) Assignment model

Operational entities that support assignment:
- ticket
- deployment
- support_queue
- launch_readiness
- support_session

Assignment record shape:
- id
- entityType
- entityId
- workspaceId
- assignedToUserId
- assignedToName
- assignedRole
- assignedAt
- assignedBy
- assignmentStatus
- metadata

Assignment statuses:
- unassigned
- assigned
- in_progress
- awaiting_response
- escalated
- completed

## 5) Activity feed model

Activity event shape:
- id
- type
- actor
- target
- workspaceId
- createdAt
- metadata

Current event types:
- ticket_assigned
- deployment_assigned
- connector_failed
- payment_failed
- launch_approved
- support_session_started
- template_selected
- website_connected

## 6) Audit log model

Operational audit event shape:
- id
- actor
- action
- entity
- entityId
- workspaceId
- timestamp
- metadata

Coverage focus:
- assignment changes
- permission-sensitive actions
- launch approvals
- billing actions
- support access
- deployment approvals

## 7) Route enforcement rules

Principles:
- UI visibility does not grant API rights.
- Module action checks are enforced on route handlers.

Sensitive APIs now action-guarded:
- role privileges
- billing plans/subscriptions
- system settings and test utilities
- support assignment routes
- ticket assignment route
- launch readiness validation/approval
- reports export

## 8) Compatibility rules

- Existing module-level visibility is retained.
- Action-level resolver combines role defaults + stored overrides + legacy compatibility.
- Super Admin retains global allow behavior.

## 9) Remaining limitations

- Privilege matrix currently writes per-role per-module action flags; no user-specific overrides yet.
- Some older Master APIs still rely on legacy access checks and should be migrated to the action guard consistently.
- Activity feed and operational audit are lightweight and intentionally not analytics-heavy yet.
- Deployment and connector events are partially instrumented; broader event coverage is planned.
