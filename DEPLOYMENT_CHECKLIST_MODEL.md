# Deployment Checklist Model

This document defines the internal deployment checklist used in Master/Support deployment workspace detail views.

## Scope

- Audience: internal operations (Master + Support)
- Route scope: deployment workspace detail in Master
- This checklist is not client-facing

## Internal Sections

1. Workspace Setup
- Workspace Created
- Business Profile Completed
- Profession Config Applied
- Modules Activated
- Support Owner Assigned

2. Website Setup
- Website Path Selected
- Template or Connector Selected
- Website Content Prepared
- Domain Submitted
- Frontend Domain Connected
- CMS / Backend Subdomain Connected

3. Deployment & Integration
- Deployment Started
- Deployment Completed
- Environment Variables Applied
- Connector Installed
- Connector Verified
- Sync Validation Passed

4. Launch Readiness
- Launch Guard Passed
- Internal QA Completed
- Client Review Ready
- Client Approval Received
- Launch Authorized

## Status Meanings

- `completed`: requirement satisfied from validated workspace/deployment state
- `in_progress`: started and actively moving toward completion
- `awaiting_client`: waiting on client input/approval/domain data
- `awaiting_support`: waiting on support/internal operator action
- `blocked`: blocked by prerequisite or guard failure
- `optional`: not required in current path/context
- `not_started`: no progress signal yet

## Owner Meanings

- `client`: client action, confirmation, or data required
- `support`: internal support or operations action required
- `system`: platform-derived state from validated workflow signals

## Client Visibility Rules

Internal checklist must remain in Master/Support views only.

Do not expose these internal implementation checks in client-facing setup UI:
- environment variable operations
- connector install/verification internals
- backend CMS preparation internals
- launch guard technical diagnostics and recovery actions

## Future Client Checklist (OS Setup Center)

Client-facing checklist should be separate, simplified, and action-focused.

It should:
- use non-technical language
- show only client-relevant milestones
- avoid exposing internal queue/support operations details
- avoid exposing launch guard internals

The client-facing checklist will be implemented later under OS Setup Center and must not reuse this internal model directly without a visibility mapping layer.
