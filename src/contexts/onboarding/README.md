# onboarding

Scope:
- Setup flow and onboarding step orchestration
- Activation flow state progression
- Initial workspace connection validation

Phase 2A contracts:
- types.ts
- constants.ts
- onboarding-flow.contract.ts
- onboarding-status.contract.ts

Phase 2B compatibility:
- onboarding-step.mapper.ts
- onboarding-validation.ts

Planned migration sources:
- app/setup/*
- onboarding-related route handlers under app/api/cloud/*
- onboarding step logic from lib/cloudOrchestration.ts

Safe integration points (future wiring):
- app/api/cloud/workspaces/[workspaceId]/onboarding/route.ts
- app/api/cloud/workspaces/route.ts
- app/api/cloud/workspaces/[workspaceId]/launch-guard/route.ts

Phase 1 status:
- Boundary defined only. No code moved.

Phase 2A status:
- Contract scaffolding added. No production route wiring changed.

Phase 2B status:
- Existing APIs now support optional MVP onboarding fields with numeric-step compatibility preserved.
