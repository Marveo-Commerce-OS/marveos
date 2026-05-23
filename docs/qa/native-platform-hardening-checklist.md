# Native Platform Hardening Checklist

Date: 2026-05-23
Phase: SAFE 3G

## Platform-Native Auth
- [x] Native identity/session structures added to platform store
- [x] Native-first session resolution implemented
- [x] Bridge login persists native identity/session metadata
- [ ] Native password credential verification implemented (future)

## Role Enforcement
- [x] Master user mutation role list reduced to native operational roles
- [x] Super admin checks run through normalized native roles
- [x] WordPress roles treated as boundary input only

## Demo Isolation
- [x] Master team mutations no longer blocked by demo/internal mode
- [x] Master billing mutations no longer blocked by demo/internal mode
- [x] Demo state exposed as explicit setting (platformSettings.demoMode)

## Persistence Hardening
- [x] Default persistence backend switched to native_file
- [x] WordPress persistence made explicit compatibility mode only
- [x] Support assignment persistence retained
- [x] Subscription status persistence retained
- [x] Template/workspace persistence retained
- [x] Audit log persistence retained
- [x] Connector state persistence retained

## Master Operational Screens
- [x] Team screen updated for native identity sources and persisted invites
- [x] Billing screen updated to reflect live operational records
- [x] System settings screen now reflects real persisted platform settings
- [x] Overview removed demo banner/placeholder metric messaging

## Empty States
- [x] Team: no fake seeded rows injected
- [x] Billing: no fake seeded subscriptions injected
- [x] Existing pages rely on empty lists/objects when no records exist

## Connector Isolation
- [x] Master user and billing APIs no longer depend on WordPress user list
- [x] Connector bridge remains optional compatibility path

## Remaining Staging Blockers
- [ ] Native credential/password storage and reset flow not implemented
- [ ] Optional DB backend (instead of file store) needed for durable multi-instance staging/production
- [ ] Bridge-cookie retirement plan pending full native auth cutover
