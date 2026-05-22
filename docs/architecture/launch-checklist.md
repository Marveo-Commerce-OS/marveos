# Launch Checklist API (Phase 2C)

## Endpoint

- GET /api/cloud/workspaces/:workspaceId/launch-checklist

## Purpose

Expose aggregated launch readiness signals for MVP backend confidence without changing existing launch guard pass/block rules.

## Inputs and Signals

Aggregates from workspace data:
- onboarding status and step key
- deployment readiness snapshot
- support assignment
- domain presence from business profile / collected data / content base URL
- launch guard timestamp when available

## Checklist Items Returned

- workspace created
- website type selected
- business details completed
- connector or template selected
- deployment started
- support assigned
- domain submitted
- launch guard checked
- client review ready

## Output Shape (high-level)

- workspaceId
- onboardingStepKey
- onboardingStatus
- launchGuardLastCheckedAt
- deploymentReadiness
- supportAssignment
- readyForLaunch
- items[]
- blockers[]
- generatedAt

## Safety Notes

- Additive API only.
- Does not block or alter existing launch guard behavior.
- Connector integration remains unchanged.

## Phase 2E Usage

Internal dashboard views consume this endpoint in:
- `/dashboard/mvp-deployments` for queue-level readiness snapshots.
- `/dashboard/mvp-deployments/:workspaceId` for detailed readiness and blockers.

Operational actions:
- Manual checklist refresh from queue and detail screens.
- Checklist remains informational and complementary to launch guard, not authoritative.
