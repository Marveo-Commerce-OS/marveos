# Native Platform Model

## Objective
MarveoOS operates as a platform-native operational system. WordPress/WooCommerce are optional connector integrations.

## Core Ownership Domains
MarveoOS owns and persists:
- auth sessions
- users and identities
- organizations
- subscriptions and billing states
- workspaces
- templates
- support assignment
- permissions and role enforcement
- audit logs
- launch readiness and deployment status
- system settings

## Data Model Anchors
Primary store: lib/adminStore.ts

Primary native sections:
- nativeAuth.identities
- nativeAuth.sessions
- nativeAuth.permissions
- platformSettings
- cloud.commercial.identities
- cloud.commercial.organizations
- cloud.commercial.subscriptions
- cloud.workspaces
- audit

## Role Model
Operational role checks use Marveo-native roles:
- SUPER_ADMIN
- ADMIN
- SUPPORT_OFFICER
- DEPLOYMENT_MANAGER
- BILLING_MANAGER
- CLIENT_OWNER
- CLIENT_STAFF

WordPress roles are normalized only at boundary (compatibility login/import).

## Session Model
Session priority:
1. marveo_native_session (native)
2. admin_token/admin_user (bridge compatibility)

Native sessions are persisted in nativeAuth.sessions with expiry and source tagging.

## Persistence Model
Default backend: native_file
Optional compatibility backend: wordpress_compat

Environment:
- MARVEO_STORE_BACKEND=native_file (default)
- MARVEO_STORE_BACKEND=wordpress_compat (temporary compatibility only)

## Demo Isolation
Demo mode is represented by platformSettings.demoMode and must not drive operational state transitions in Master APIs.
Operational APIs persist real records and should not fabricate demo rows.

## Operational Empty State Rules
When no data exists for users/subscriptions/workspaces/templates/support:
- return empty arrays/objects from APIs
- render explicit empty-state UX
- do not inject fake records
