# Bounded Contexts (Safe Phase 1)

This file defines architecture boundaries for MVP development without changing existing runtime behavior.

## Context List

1. platform-core
2. workspace-runtime
3. onboarding
4. deployment
5. support
6. connector-gateway
7. shared

## Context Definitions

### platform-core
Owns:
- Multi-workspace orchestration
- Plan enforcement
- Audit and governance
- Rollout/version channels

Does not own:
- WordPress connector protocol details
- Module UI rendering logic

### workspace-runtime
Owns:
- Runtime bundle composition
- Runtime page/component resolution
- Workspace-facing operational experience

Does not own:
- Cloud account plan policy
- Connector activation token handling

### onboarding
Owns:
- Setup step orchestration
- Activation sequence and validations for initial connection
- Step progression/retry policy at app layer

Does not own:
- Long-term deployment rollout governance

### deployment
Owns:
- Deployment readiness checks
- Runtime deployment status interpretation
- Launch guard behavior

Does not own:
- UI module business workflows

### support
Owns:
- Admin support tools and diagnostics
- Email/smtp test and operational support endpoints
- Maintenance/safety toggles

Does not own:
- Client-facing runtime content contracts

### connector-gateway
Owns:
- Calls into WordPress connector APIs
- Connector endpoint contracts and adapters
- Connector command dispatch boundaries

Does not own:
- Workspace business logic decisions

### shared
Owns:
- Shared types/contracts
- Shared endpoint helpers
- Common utility and guard helpers used by multiple contexts

Does not own:
- Domain-specific orchestration

## Initial Folder Scaffolding

Phase 1 adds non-breaking scaffold directories under src/contexts with README boundaries only.
No runtime file moves are performed in this phase.

## Migration Rule for Phase 2

- Move code only when imports, route contracts, and tests are verified.
- Use adapter shims during transitions.
- Keep one canonical runtime provider path after verification.
