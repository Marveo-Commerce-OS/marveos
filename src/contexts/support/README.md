# support

Scope:
- Operational support utilities
- Admin diagnostics and test endpoints
- Maintenance and support-side configurations

Phase 2A contracts:
- support-assignment.contract.ts

Planned migration sources:
- support/admin portions of lib/adminStore.ts
- app/api/admin/* and support-oriented route handlers

Safe integration points (future wiring):
- app/api/admin/*
- future support assignment route group under app/api/support/*

Phase 1 status:
- Boundary defined only. No code moved.

Phase 2A status:
- Contract scaffolding added. No production route wiring changed.
