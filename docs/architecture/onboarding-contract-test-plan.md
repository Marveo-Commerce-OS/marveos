# Onboarding Contract Test Plan (Phase 2B)

No automated test framework is currently committed in this repository.
This plan defines the minimum compatibility tests to add before deeper onboarding migration.

## Scope

- Numeric onboarding compatibility
- MVP step key compatibility
- Optional onboarding fields in existing APIs
- Launch guard informational MVP signals

## Target Endpoints

- /api/cloud/workspaces [POST]
- /api/cloud/workspaces/:workspaceId/onboarding [PUT]
- /api/cloud/workspaces/:workspaceId/launch-guard [GET, POST]

## Compatibility Cases

1. Legacy workspace creation still works
- Send only existing required fields
- Expect 201 and workspace created

2. Workspace creation accepts optional onboarding seed fields
- Include planId, websiteType, businessProfile, selectedTemplateId, supportRequired
- Expect 201 and fields persisted

3. Legacy onboarding PUT still works
- Send step + action only
- Expect successful transition

4. Onboarding PUT accepts onboardingStepKey without breaking
- Send onboardingStepKey + action
- Expect compatibility mapping to numeric step if valid

5. Onboarding PUT ignores invalid optional fields safely
- Send invalid onboardingStatus/websiteType
- Expect legacy transition still succeeds with warnings

6. collectedBusinessData validation is non-blocking
- Send mismatched payload shape
- Expect transition success and validation details in response

7. Launch guard response includes mvpSignals
- Expect mvpSignals object present while ready/block behavior remains unchanged

## Non-Goals in Phase 2B

- No UI test coverage changes
- No connector plugin integration tests
- No deployment automation tests

## Suggested Tooling for Phase 2C

- Unit tests: Vitest or Jest for mapper and validators
- API contract tests: Next route handler integration tests
- Smoke tests: scripted fetch checks for backward compatibility
