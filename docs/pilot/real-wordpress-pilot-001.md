# Real WordPress Pilot 001 Validation Report

Date: 2026-05-22
Environment: local pilot validation (Marveo app + WordPress connector test flow)
Tester: Internal guided pilot run
Pilot ID: WP-PILOT-001

## 1. WordPress site connected successfully

Status: PASS (guided pilot path)

Evidence observed:
- Existing Website onboarding flow reached connector verification and completion states.
- Workspace and deployment surfaces reflected connector progression after verification/manual support path handling fixes.
- WordPress/WooCommerce platform context was detected in setup and surfaced in deployment views after consistency fixes.

Notes:
- Connection success in this pilot is defined as the app correctly handling verification outcomes and persisting connector state for operational follow-up.

## 2. Token-based verification worked

Status: PASS

Evidence observed:
- Token workflow now uses plugin-generated token as source of truth.
- Verification endpoint accepted token + domain and returned expected outcomes.
- Domain/site-origin mismatch guard prevented invalid cross-site token acceptance.
- Failed verification path persisted safe FAILED/SUPPORT_REQUIRED state (no silent success).

Security handling confirmed:
- No token value exposure in API persistence paths.
- UI masking behavior reduced accidental token disclosure risk during setup.

## 3. Metadata detected

Status: PASS

Metadata signals observed:
- Platform metadata (WordPress/WooCommerce) captured from connector site metadata.
- Discovery summary reflected detected modules/capabilities and WooCommerce state in user-facing onboarding output.
- Persisted metadata became visible across master/deployment surfaces after normalization updates.

## 4. Any friction noticed during setup

Friction observed:
- User uncertainty on where to obtain token before plugin-generated token guidance was clarified.
- Domain entry/verification step remains sensitive to exact site origin formatting; mismatch protection is correct but can feel strict to non-technical users.
- When verification fails, users still require guided support handoff; this is functional but interrupts self-serve momentum.

Operational friction:
- Multi-tenant quota behavior previously blocked expected onboarding capacity until ownership-scoped quota logic was corrected.

## 5. Any UI wording that confused the tester

Confusing wording noted (before current copy updates):
- Download/install wording previously implied one-click certainty; users hit friction when docs/download links were inconsistent.
- Token instructions were previously ambiguous about source (dashboard-generated vs plugin-generated).
- Discovery summary language previously felt too technical for non-technical operators.

Current state after wording updates:
- Improved, but still monitor for:
  - "support setup" phrasing clarity (does user understand expected turnaround and next action?)
  - strict domain mismatch messages (ensure plain-language remediation guidance)

## 6. Any connector/install issue

Issues encountered during pilot cycle:
- Plugin download URL initially pointed to a missing package path (404) and required correction.
- External docs hostname dependency created empty/unavailable docs experience in local context; fallback installation page was added.
- Connector verification failure/manual path state persistence was previously inconsistent and has now been fixed.

Current status:
- Blocking install issues from this cycle were addressed for pilot continuity.

## 7. What must be hardened before second pilot

Must-harden items:
- Release artifact integrity:
  - Ensure plugin package URL and version metadata are always synchronized in update feed.
  - Add pre-release validation for download URL availability.
- Verification resilience:
  - Expand user-safe guidance for domain mismatch remediation.
  - Add explicit retry telemetry and support assignment audit trail for failed verification.
- Cross-surface consistency:
  - Keep connector status/platform/metadata rendering identical across setup, master workspace list, and deployment detail pages.
- Pilot observability:
  - Capture structured event logs for token verify attempts, mismatch rejections, support handoffs, and final connection state.
- Environment confidence:
  - Run one staging-like pilot pass (not only local) with real docs hostname and package host paths.

## 8. What can wait

Can wait (non-blocking for pilot 2 if must-harden items are complete):
- Additional UX polish/animation improvements in setup flow.
- Extended copy refinement for advanced module discovery details.
- Broader self-serve docs expansion beyond connector-install baseline.
- Secondary reporting dashboards for pilot analytics (if core event logs already exist).

## Overall pilot judgment

Pilot 001 indicates the Existing Website connector flow is now viable for a controlled second pilot, provided release-link integrity, verification observability, and staging-like validation are completed first.