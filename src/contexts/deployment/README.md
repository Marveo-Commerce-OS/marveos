# deployment

Scope:
- Deployment status interpretation
- Launch guard checks
- Validation and readiness outcomes

Phase 2A contracts:
- deployment-handoff.contract.ts

Planned migration sources:
- src/lib/deploymentStatus.ts
- deployment checks in dashboard/setup guards
- app/api/cloud/workspaces/*/launch-guard and related handlers

Safe integration points (future wiring):
- app/api/cloud/workspaces/[workspaceId]/launch-guard/route.ts
- app/api/cloud/deployment-links/*

Phase 1 status:
- Boundary defined only. No code moved.

Phase 2A status:
- Contract scaffolding added. No production route wiring changed.
