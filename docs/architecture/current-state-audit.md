# Current State Audit (Safe Phase 1)

Date: 2026-05-20
Scope: marveos + marveo-connector
Mode: Read-only audit plus boundary scaffolding

## Summary

The system is functional and already aligned with Marveo Commerce OS direction, but architecture boundaries are mixed in a few places. Most risk comes from duplicate runtime stacks and monolithic service boundaries, not from missing core capabilities.

## What Is Working Well

- WordPress-backed authentication and guarded dashboard access flow is present and coherent.
- Workspace orchestration model exists and includes onboarding/readiness concepts.
- Connector plugin exposes core activation/runtime/settings/module endpoints.
- Runtime rendering model exists for runtime-driven pages and component registry behavior.

## Reusable Systems

- Runtime bundle client and provider pattern in root-level lib/components.
- Cloud workspace orchestration model and onboarding state machine.
- Connector extended REST API and deployment status contract.
- Setup activation flow between dashboard and plugin endpoint.

## Weak Areas (Architecture)

1. Monolithic store/service boundary:
- lib/adminStore.ts currently contains multiple domains in one unit (admin users, support, cloud orchestration, auditing, persistence).

2. Duplicate runtime/provider systems:
- Root runtime path appears active.
- src adapter/runtime path appears legacy/transitional.

3. API route grouping sprawl:
- app/api currently mixes concerns in one broad surface without explicit domain folders for long-term ownership.

4. Environment variable inconsistency:
- Different variable names and fallback paths exist across modules, increasing misconfiguration risk.

5. Test coverage gap:
- No committed automated tests found for critical flows.

## Technical Debt Snapshot

High:
- Duplicate runtime/provider systems
- Monolithic adminStore domain coupling
- Missing critical-flow tests

Medium:
- Mixed route grouping conventions
- Env var naming drift

Low/Medium:
- Documentation-to-implementation drift in some areas

## Safety Position for Phase 1

- Preserve all working systems.
- Add boundaries and documentation only.
- Mark legacy/transitional systems as deprecated pending migration verification.
- Defer functional refactor to Phase 2.
