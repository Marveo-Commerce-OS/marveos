# Pilot Readiness Checklist

Use this checklist before running a guided pilot or internal rehearsal.

## Core Access

- [ ] Admin login works at `/master-login`
- [ ] Master overview loads at `/master`
- [ ] Internal demo mode note is visible on master overview when demo mode is enabled

## MVP Onboarding

- [ ] `/setup/mvp` loads from a clean state
- [ ] New Website path reaches Review and installation
- [ ] Existing Website path shows token generation and verification controls
- [ ] Custom/Headless path reaches Review and installation

## Internal Visibility

- [ ] Workspace appears in `/master/workspaces`
- [ ] Workspace appears in `/master/mvp-deployments`
- [ ] Connector status is visible where relevant
- [ ] Platform is visible consistently where relevant

## Launch Readiness

- [ ] Launch checklist loads for created workspace
- [ ] Launch blockers are shown accurately
- [ ] Connector blockers only affect `EXISTING_WEBSITE`
- [ ] Launch readiness is not falsely marked Ready

## Existing Website Connection

- [ ] Connector token can be generated
- [ ] Connector instructions display
- [ ] Domain verification can be run
- [ ] Failed/manual path persists support-required status correctly
- [ ] Master views reflect connector status after verification outcome

## Portal Separation

- [ ] Internal users are redirected away from `/portal`
- [ ] `/portal` does not expose internal master tools
- [ ] Client-only auth check is documented as a known limitation if no client test identity exists

## Pilot Decision

- [ ] Safe for guided internal demo
- [ ] Safe for controlled pilot walkthrough
- [ ] Known limitations reviewed with stakeholders before session
