# WordPress Dependency Audit (SAFE PHASE 3G)

Date: 2026-05-23
Scope: Marveo Master + platform operations in marveos

## Summary
MarveoOS now treats WordPress as an optional connector boundary, not an operational source of truth. Platform operations (users, roles, subscriptions, workspaces, templates, support, audit, settings) persist in platform-native state.

## Dependency Inventory

### Auth dependencies
- app/api/auth/login/route.ts: WordPress JWT login remains available as a compatibility bridge.
- lib/auth.ts: Session resolution is native-first using marveo_native_session; WordPress token/cookie path is fallback bridge.

Classification:
- remove now: none (bridge required for backward compatibility)
- compatibility only: WordPress JWT exchange and wp/v2/users/me lookup during bridge login
- optional integration: WordPress identity import via bridge session
- future migration: native credential store + password hashing for all internal users

### Role dependencies
- lib/auth.ts: WordPress roles are normalized at boundary into Marveo-native roles.
- app/api/master/users/route.ts: Master role assignment and checks are now enforced using Marveo-native role set.

Classification:
- remove now: direct WordPress role checks inside operational API logic
- compatibility only: wp role -> native role mapping during bridge login
- optional integration: connector-scoped role hints
- future migration: fully remove connector compatibility role constants from auth surface

### Token dependencies
- cookies: admin_token/admin_user retained for bridge compatibility.
- cookies: marveo_native_session added as platform-native session token.
- lib/adminStore.ts: nativeAuth.sessions now persist platform sessions.

Classification:
- remove now: none
- compatibility only: admin_token/admin_user
- optional integration: WordPress bearer token usage for connector-only endpoints
- future migration: deprecate admin_token/admin_user and use native session only

### API dependencies
- WordPress endpoints still used where connector behavior is explicit (content/media/woocommerce/plugin checks).
- Master operational APIs (/api/master/users, /api/master/billing/subscriptions) no longer depend on WordPress as source of truth.

Classification:
- remove now: WordPress user-directory fetch for Master team operations
- compatibility only: bridge login identity verification
- optional integration: connector/site probing and WordPress CMS/commerce APIs
- future migration: native auth endpoint replacing WordPress JWT flow

### Persistence assumptions
- lib/adminStore.ts now uses Postgres-only persistence via DATABASE_URL.
- A one-time legacy import copies existing `.admin-data/ecommerce-admin-config.json` into Postgres when no row exists.

Classification:
- remove now: implicit Vercel => WordPress persistence assumption
- remove now: native_file backend mode
- optional integration: connector metadata persistence from WP handshake
- future migration: move from JSONB blob storage to normalized relational tables if needed

## High-Risk Remaining Couplings
- Bridge login still requires WordPress JWT endpoint when native credentials are not provisioned.
- Some non-Master API routes still use admin_token for WordPress-backed operations by design.

## Recommendation
Treat all WordPress-authenticated sessions as bridge sessions and progressively migrate internal operators to native identities with native credentials.