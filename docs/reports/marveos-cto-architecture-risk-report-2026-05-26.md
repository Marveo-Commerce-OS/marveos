# Marveos CTO Architecture and Risk Report

**Date:** 2026-05-26  
**Prepared for:** CTO review  
**Scope:** `marveos`, `marveo-connector`, `marveo-templates`  
**Assessment basis:** current implementation only

---

## 1. Executive Position

Marveos is already a meaningful operational platform, but it is not yet a fully automated production deployment system.

Today, the codebase supports a strong managed-service model:

- commercial onboarding and entitlement enforcement
- workspace creation and orchestration state tracking
- hybrid native and WordPress-bridge authentication
- connector verification for existing WordPress sites
- support assignment and launch-readiness workflows

The platform does **not** yet support a trustworthy self-serve deployment motion for production clients because deployment execution is still largely represented as orchestration state rather than real infrastructure automation.

### CTO conclusion

The product is fit for **controlled client onboarding with internal operator involvement**. It is not yet fit for **broad self-serve rollout** without additional investment in deployment execution, distributed security controls, and workflow consolidation.

---

## 2. Decision Summary

| Area | Status | CTO Assessment | Primary Owner |
| --- | --- | --- | --- |
| Persistence model | Yellow | Works today, but centralizes too much risk in one JSONB control document. | Platform Engineering |
| Authentication and authorization | Yellow | Real role-aware security model, but not yet distributed-safe. | Platform Engineering + Security |
| Commercial onboarding | Yellow | Good enough for managed funnel operations. | Product Engineering |
| Workspace orchestration | Yellow | Real orchestration state machine, not real infrastructure truth. | Platform Engineering |
| WordPress connector | Yellow | Valuable adapter layer, but not a mature sync substrate. | Integrations Engineering |
| Template operations | Yellow | Operationally useful catalog, but deployment coupling is incomplete. | Product Engineering |
| Deployment automation | Red | Major gap. Workflow exists; infrastructure executor does not. | Platform Engineering + DevOps |
| Security hardening | Yellow/Red | Intent is strong; implementation is still partly single-instance. | Security + Platform Engineering |
| Client rollout readiness | Yellow | Suitable for operator-led clients, not broad self-serve. | CTO / Delivery |

---

## 3. Core Architecture Reality

### 3.1 System control plane

The true control plane is the Postgres-backed admin store in `lib/adminStore.ts`. Almost all platform state is persisted into one JSONB document keyed by a single row and read back into an application-owned aggregate object.

**Important code anchors**

- Postgres table shape and JSONB storage: `lib/adminStore.ts`
- Postgres upsert write path: `lib/adminStore.ts`
- read/update public API: `lib/adminStore.ts`
- default store composition: `lib/adminStore.ts`

**Implication**

This architecture is fast to evolve, but it places data integrity, concurrency discipline, and tenant isolation pressure on application logic instead of database structure.

**CTO view**

This is acceptable in the current stage if the system is explicitly treated as a controlled operations platform. It is not an ideal long-term foundation for high-concurrency multi-tenant scale.

**Owner:** Platform Engineering

### 3.2 Authentication model

The platform uses a hybrid auth architecture:

- native session resolution through `marveo_native_session`
- WordPress bridge session resolution through `admin_token` and `admin_user`
- role normalization from WordPress roles and Marveo roles into a single enforcement model
- master control module/action guards for internal surfaces

**Important code anchors**

- session resolution and role normalization: `lib/auth.ts`
- native session creation and validation: `lib/nativeAuth.ts`
- login flow with OTP and lockout logic: `app/api/auth/login/route.ts`
- module/action permission guard: `lib/master/permissions/guards.ts`

**Implication**

The security model is real and operational. This is not superficial frontend gating.

**Risk**

OTP challenge state, lockout state, and request throttling are process-local. In a horizontally scaled production environment that leads to inconsistent security behavior.

**Owner:** Platform Engineering and Security

### 3.3 Workspace model

Workspaces are created as orchestration objects containing ownership scope, onboarding step state, deployment-readiness flags, support state, and rollout metadata.

**Important code anchors**

- workspace factory and baseline requirements: `lib/cloudOrchestration.ts`
- entitlement resolution and scoped workspace counts: `lib/workspaceEntitlements.ts`
- workspace creation API: `app/api/cloud/workspaces/route.ts`

**Implication**

The system already has a real workspace domain. However, a workspace is still mostly an orchestration record, not a guaranteed reflection of provisioned services.

**Owner:** Platform Engineering

---

## 4. Subsystem Findings

### 4.1 Persistence and data integrity

**Finding**

The JSONB store makes the system flexible, but domain boundaries are soft. Commercial data, auth data, workspace data, finance data, and operations state all move through a single aggregate persistence model.

**What is working**

- Postgres is already the persistence backend.
- Legacy file migration exists.
- Store caching is deliberately short-lived.

**Primary concerns**

- no normalized tenant boundary at the DB layer
- no row-level isolation model per workspace, organization, or subscription
- wide-write blast radius for unrelated domain updates
- future reporting and audit depth will become harder as state volume grows

**Recommendation**

Do not attempt a full rewrite immediately. First isolate high-risk domains into separately versioned logical modules, then selectively normalize commercial billing, workspace provisioning events, and auth/session state.

**Owner:** Platform Engineering

### 4.2 Authentication and platform access

**Finding**

The auth design is stronger than a typical early-stage internal tool. Native and WordPress bridge identity models already coexist, and role mapping into explicit Marveo roles is a good platform decision.

**What is working**

- internal versus client role separation is explicit
- super-admin and module-action authorization is implemented server-side
- workspace-scoped access checks exist
- first-login and invite-password flows are supported

**Primary concerns**

- lockout and OTP challenges are not durable or shared
- cookies are the effective trust boundary for multiple surfaces
- WordPress bridge persistence writes local password entries for bridged users, which increases long-term auth complexity

**Recommendation**

Move challenge, rate-limit, and session-control state into shared backing storage before any serious multi-instance rollout.

**Owner:** Security and Platform Engineering

### 4.3 Commercial onboarding and entitlement

**Finding**

Commercial onboarding is real and one of the stronger slices of the system. Plans, templates, onboarding sessions, subscription states, and entitlement decisions are consistently used to control onboarding access and workspace creation.

**Important code anchors**

- public plans and templates: `lib/commercialOnboarding.ts`
- current entitlement resolution: `lib/commercialOnboarding.ts`
- entitlement API surface: `app/api/subscription/current/route.ts`

**What is working**

- region-aware pricing support
- trial expiry handling
- subscription-linked workspace capacity
- public onboarding completion notifications

**Primary concerns**

- billing truth still lives in application-owned state
- payment lifecycle and entitlement are not clearly decoupled from the main control document

**Recommendation**

Keep this as-is for managed onboarding, but treat billing system decoupling as a medium-term architecture priority.

**Owner:** Product Engineering and Platform Engineering

### 4.4 Onboarding workflow

**Finding**

The onboarding page in `app/setup/mvp/page.tsx` is a real orchestration client. It manages draft state, entitlement checks, template hydration, connector verification, workspace creation, support assignment, and checklist retrieval.

**What is working**

- real API-driven workflow
- local draft recovery
- public onboarding session hydration
- connector verification from UI
- launch-readiness handoff

**Primary concerns**

- critical orchestration logic is concentrated in a large client component
- current step-guarding suppresses parts of the full wizard model, indicating workflow drift between intended and live flow

**Recommendation**

Preserve the current UI, but progressively move workflow transitions and side-effect sequencing into backend workflow handlers.

**Owner:** Product Engineering

### 4.5 WordPress connector

**Finding**

The connector is real and already useful for runtime data access, connection verification, deployment-status reporting, content mapping, and module activation.

**Important code anchors**

- core status and init-admin endpoints: `marveo-connector/includes/class-rest-api.php`
- runtime and command endpoints: `marveo-connector/includes/class-rest-api-extended.php`
- placeholder sync hooks: `marveo-connector/includes/class-hooks.php`

**What is working**

- `/status` is a useful probe endpoint
- deployment status can be surfaced back to Marveos
- content and module commands exist
- existing-site verification is one of the more real end-to-end flows in the platform

**Primary concerns**

- runtime read endpoints are broadly accessible based on connector status
- hooks for user/order/product sync are placeholders only
- the connector is currently closer to a runtime adapter than a sync and control agent

**Recommendation**

Treat the connector as production-usable for verification and runtime reads, but not yet as the backbone for ongoing operational synchronization.

**Owner:** Integrations Engineering

### 4.6 Template system

**Finding**

The template system is operationally real. It supports metadata management, import, resync from `marveo-templates`, publish rules, and public filtering by market, plan, business type, sector, and profession.

**What is working**

- resync from sibling template repo
- public visibility rules
- artifact presence gating for non-support templates
- template matching and scoring against onboarding context

**Primary concerns**

- template eligibility does not guarantee installability
- deployment automation is not yet coupled tightly enough to template selection

**Recommendation**

Do not overstate template readiness externally. Keep templates positioned as curated operational starting points until automated install and launch paths are real.

**Owner:** Product Engineering

### 4.7 Deployment and launch

**Finding**

This is the highest-risk gap in the platform. Deployment links exist, launch checklist exists, launch guard exists, and readiness is evaluated. But the actual execution layer is incomplete.

**Important code anchors**

- deployment link creation: `app/api/cloud/deployment-links/route.ts`
- deployment link finalize route: `app/api/cloud/deployment-links/[linkId]/route.ts`
- launch guard and readiness validation: `app/api/cloud/workspaces/[workspaceId]/launch-guard/route.ts`
- orchestration readiness evaluator: `lib/cloudOrchestration.ts`

**Critical implementation reality**

The finalize route explicitly documents the real deployment actions as future work:

- infrastructure provisioning
- DNS configuration
- SSL certificate generation
- webhook registration
- content sync trigger

That means the platform currently tracks and validates deployment state better than it actually performs deployment.

**CTO conclusion**

This is the main blocker to self-serve rollout.

**Owner:** Platform Engineering and DevOps

### 4.8 Infrastructure and security posture

**Finding**

Security posture is directionally good, but operational hardening is incomplete.

**What is working**

- audit logging exists
- public onboarding routes have rate limiting
- session and login protection settings are configurable in the store
- permission guards protect internal control surfaces

**Primary concerns**

- in-memory rate limiting in `lib/security/requestGuards.ts`
- in-memory login challenge and lockout maps in `app/api/auth/login/route.ts`
- connector runtime access is not strongly bound to per-request authenticated user identity

**Recommendation**

Before widening exposure, move all security-critical ephemeral state to shared infrastructure and tighten connector authorization semantics.

**Owner:** Security and Platform Engineering

---

## 5. Client Readiness Assessment

### 5.1 What can be done for a real client today

The platform can support a real client if Marveo staff are in the loop.

Operationally feasible today:

- run commercial onboarding and entitlement checks
- create workspace records with scoped subscription ownership
- verify WordPress connector installation and metadata
- assign support and track handoff
- generate launch checklist and readiness state

### 5.2 What cannot be claimed today

The platform should **not** currently be described as a fully self-serve production deployment engine for new client environments.

Not yet reliable as a self-serve promise:

- automated infrastructure creation
- automated DNS and SSL completion
- fully automated template-to-live-site provisioning
- distributed-safe security behavior across multiple app instances

### 5.3 Recommended external positioning

The most accurate product posture today is:

> Marveos is a managed onboarding and operational orchestration platform with partial automation, not yet a fully autonomous deployment platform.

**Owner:** CTO, Delivery, and Commercial leadership

---

## 6. Top Risks and Risk Owners

| Priority | Risk | Why it matters | Owner |
| --- | --- | --- | --- |
| P1 | Deployment execution gap | Core self-serve value proposition is not actually automated yet. | Platform Engineering + DevOps |
| P1 | Process-local security controls | Multi-instance rollout would weaken lockout, OTP, and rate-limit guarantees. | Security + Platform Engineering |
| P1 | Overloaded JSONB control plane | Scale, reporting, and concurrent mutation complexity will grow quickly. | Platform Engineering |
| P2 | Connector runtime authorization looseness | Runtime reads are easier to expose than intended if connector status is active enough. | Integrations Engineering + Security |
| P2 | Client workflow logic concentrated in frontend | Increases regression risk and makes future onboarding variants harder to maintain. | Product Engineering |
| P2 | Template readiness not equal to deployment readiness | Commercial and delivery expectations can diverge. | Product Engineering + Delivery |
| P3 | Mixed identity persistence complexity | Native and bridged auth coexistence is valuable, but long-term ownership needs cleanup. | Platform Engineering |

---

## 7. 90-Day CTO Action Plan

### Phase 1: harden what already exists

1. Move login OTP, lockout, and public rate-limit state into shared storage.
2. Tighten connector runtime authorization for non-public endpoints.
3. Add explicit operational telemetry around workspace creation, connector verification, support assignment, and launch approval.

**Owner:** Security + Platform Engineering

### Phase 2: make deployment real

1. Build a deployment executor behind the existing deployment-link and launch surfaces.
2. Represent provisioning steps as real jobs with retries, status, and audit events.
3. Wire DNS, certificate, and environment/bootstrap tasks into the executor.

**Owner:** Platform Engineering + DevOps

### Phase 3: reduce architectural concentration risk

1. Pull workflow-critical sequencing out of the large onboarding client component.
2. Introduce clearer backend workflow handlers for onboarding progression.
3. Begin separating high-churn domains from the monolithic admin store aggregate.

**Owner:** Product Engineering + Platform Engineering

---

## 8. Final Recommendation

Marveos should continue forward as a **managed-service-first platform**.

That means:

- continue piloting with real clients where Marveo operators supervise onboarding
- avoid positioning the current product as hands-off self-serve deployment
- prioritize deployment execution and distributed security hardening above cosmetic expansion

### Final CTO verdict

**Approved for controlled managed onboarding. Not approved yet for broad self-serve production rollout.**

---

## 9. Reference Files Reviewed

- `lib/adminStore.ts`
- `lib/auth.ts`
- `lib/nativeAuth.ts`
- `app/api/auth/login/route.ts`
- `lib/workspaceEntitlements.ts`
- `lib/cloudOrchestration.ts`
- `app/api/cloud/workspaces/route.ts`
- `app/api/cloud/workspaces/[workspaceId]/launch-checklist/route.ts`
- `app/api/cloud/workspaces/[workspaceId]/launch-guard/route.ts`
- `app/api/cloud/deployment-links/route.ts`
- `app/api/cloud/deployment-links/[linkId]/route.ts`
- `lib/commercialOnboarding.ts`
- `app/api/subscription/current/route.ts`
- `app/setup/mvp/page.tsx`
- `marveo-connector/includes/class-rest-api.php`
- `marveo-connector/includes/class-rest-api-extended.php`
- `marveo-connector/includes/class-hooks.php`

---

**Prepared by:** GitHub Copilot  
**Model:** GPT-5.4  
**Product:** Marveos