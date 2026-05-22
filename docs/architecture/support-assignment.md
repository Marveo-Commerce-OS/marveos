# Support Assignment API (Phase 2C)

## Endpoint

- GET /api/cloud/workspaces/:workspaceId/support-assignment
- POST /api/cloud/workspaces/:workspaceId/support-assignment

## Purpose

Provide a dedicated backend contract for assigning support in onboarding, without introducing real officer matching logic yet.

## Contract

Uses:
- src/contexts/support/support-assignment.contract.ts

Accepted POST fields:
- workspaceId (path)
- clientId
- priority
- reason
- setupType
- requiredSkills
- initialNotes

Optional placeholders:
- supportOfficerId
- supportOfficerName

## Behavior

- Stores assignment metadata on workspace record as `supportAssignment`.
- Defaults to placeholder assignment if officer identity is not provided.
- Returns assignment status for API consumers.
- Appends audit log event: `cloud.support.assigned`.

## Safety Notes

- No connector plugin changes.
- No workforce matching engine introduced.
- No launch-blocking logic tied to assignment in this phase.

## Phase 2E Usage

Internal dashboard views now call this endpoint from:
- `/dashboard/mvp-deployments` (queue action)
- `/dashboard/mvp-deployments/:workspaceId` (detail action)

Current UI behavior:
- Uses placeholder officer identity when no real matching exists.
- Supports repeated assignment updates as non-destructive operational notes.
- Keeps assignment as informational support context, not launch authority.
