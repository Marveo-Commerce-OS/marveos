# MASTER ROLE ACCESS MODEL

Last updated: 2026-05-26
Scope: Marveo Master internal role access model only.

## 1) Role definitions

- Super Admin: Full platform access across all Master modules and sensitive controls.
- Admin: Operational access for client/workspace/support/deployment execution, without system security and role-privilege administration.
- Customer Support: Ticketing, complaints, enquiries, and support session handling.
- Technical Support: Connector, deployment technical checks, integration validation, and technical tickets.
- Deployment Manager: Workspace deployment lifecycle, launch readiness, and provisioning queue.
- Billing Manager: Commercial plans, subscriptions, payment issues, and billing-related reports.

## 2) Dashboard visibility by role

### Super Admin
- Total Clients
- Active Workspaces
- Plans Sold
- Pending Deployments
- Failed Deployments
- Launch Blockers
- Open Support Assignments
- Complaints
- Revenue/Billing Snapshot
- System Status
- Team Members
- Connected Websites

### Admin
- Total Clients
- Active Workspaces
- Pending Deployments
- Support Assignments
- Launch Blockers
- Complaints
- Connected Websites
- Reports Summary

### Customer Support
- My Assigned Tickets
- Open Complaints
- Awaiting Client Response
- New Enquiries
- Website Support Requests
- WhatsApp/Integration Requests
- Escalated Tickets
- Recent Client Activity

### Technical Support
- Connector Issues
- Failed Deployments
- Integration Validation Pending
- WordPress Connector Status
- Website Technical Issues
- Support Sessions Pending
- Assigned Technical Tickets
- Launch Blockers

### Deployment Manager
- Pending Deployments
- Workspaces Awaiting Setup
- Launch Readiness
- Domain Pending
- Template/Connector Selection
- Deployment Started
- Client Review Ready
- Launch Authorized Pending

### Billing Manager
- Plans Sold
- Pending Payments
- Failed Payments
- Active Subscriptions
- Expired Trials
- Upgrade Requests
- Billing Complaints
- Invoice Issues

## 3) Sidebar visibility by role

### Super Admin
- Overview
- Clients
- Workspaces
- Support Center
- Launch Readiness
- Reports
- Analytics
- Billing
- System Settings
- Role Privileges

### Admin
- Overview
- Clients
- Workspaces
- Support Center
- Launch Readiness
- Reports

### Customer Support
- My Dashboard
- Tickets
- Complaints
- Client Enquiries
- Support Sessions
- Knowledge / Defined Replies

### Technical Support
- My Dashboard
- Connector Issues
- Deployments
- Launch Readiness
- Support Sessions
- Technical Tickets

### Deployment Manager
- My Dashboard
- Deployment Queue
- Workspaces
- Launch Readiness
- Template / Website Requests
- Support Queue

### Billing Manager
- My Dashboard
- Billing
- Subscriptions
- Payment Issues
- Clients
- Reports

## 4) Module permissions

### Normalized module labels
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

### Current model in production
- Module-level boolean visibility and route access is enforced for internal Master roles.
- Effective access is baseline role policy intersected with configured matrix values.
- Super Admin bypasses matrix restrictions by design.

### Granular permission target model (next step)
For each module, support action-level permissions:
- view
- create
- update
- delete
- assign
- approve
- export

Suggested rollout:
- Add per-role, per-module action map in store.
- Expand API authorization middleware to validate action keys.
- Update Role Privileges UI from single checkbox to action matrix.

## 5) Route access rules

Role-aware server-side checks are enforced for Master routes and selected APIs.

### Page route checks
- /master/system-settings -> system settings module
- /master/role-privileges -> role privileges module
- /master/billing -> billing module
- /master/mvp-deployments -> deployment queue module
- /master/support-center (alias) and /master/support -> support queue module
- /master/connectors -> connectors module
- /master/reports -> reports module
- /master/analytics -> analytics module

### API route checks now aligned
- /api/master/system-settings/* -> system settings module
- /api/master/access-control -> role privileges module
- /api/master/billing/plans -> billing module
- /api/master/billing/subscriptions -> billing module
- /api/master/reports/schedule -> reports module

## 6) Remaining gaps

- Support-center API endpoints (tickets/support sessions/defined replies) still contain mixed legacy checks; full module-action parity should be completed as a follow-up hardening pass.
- The Role Privileges matrix is module boolean only; action-level permissions are not yet persisted or enforced.
- Analytics API surface should be reviewed once analytics endpoints are expanded, to keep parity with page guards.
