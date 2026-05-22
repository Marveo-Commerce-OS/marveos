# MarveoOS Platform Map (Safe Phase 1)

This document maps the current MarveoOS codebase into three core drivers for MVP preparation.

## Core Drivers

### 1. Master Platform
Purpose: Multi-tenant control plane, workspace provisioning, governance, and operational guardrails.

Current implementation areas:
- app/api/cloud/*
- app/dashboard/workspaces/*
- lib/cloudOrchestration.ts
- lib/adminStore.ts (cloud and audit portions)

Responsibilities:
- Workspace lifecycle and plan limits
- Deployment links and provisioning orchestration
- Audit trail and command queueing
- Schema versioning and rollout channels

### 2. Client Workspace / OS
Purpose: Per-client operations experience and runtime-driven business UI.

Current implementation areas:
- app/dashboard/*
- app/api/runtime/workspaces/[workspaceId]/route.ts
- components/* (runtime provider/renderer path)
- lib/marveo-api.ts
- lib/marveo.ts
- lib/api.ts

Responsibilities:
- Dashboard modules and role-based access
- Runtime bundle rendering
- Client-level business operations (orders, products, customers, blog, reports)

### 3. Connector Gateway
Purpose: Bridge between MarveoOS and WordPress/WooCommerce via plugin APIs.

Current implementation areas:
- app/setup/activate/*
- src/services/marveoConnector.ts
- marveo-connector/includes/class-rest-api.php
- marveo-connector/includes/class-rest-api-extended.php

Responsibilities:
- Store activation and first-admin bootstrap
- Deployment status and runtime feed endpoints
- Settings and module synchronization endpoints

## Active Runtime Path vs Transitional Path

Active runtime/provider path (current default):
- components/MarveoProvider.tsx
- components/MarveoRenderer.tsx
- lib/marveo-api.ts
- lib/marveo.ts

Transitional/legacy adapter path (pending migration verification):
- src/components/MarveoProvider.tsx
- src/lib/marveo.ts
- src/lib/hooks/useMarveo.ts

Status: Transitional path remains in repository during Phase 1 for safety. No removals in this phase.

## Phase 1 Constraints

- No runtime behavior changes
- No route rewrites
- No file removals
- No feature additions
- Boundaries are documented and scaffolded only
