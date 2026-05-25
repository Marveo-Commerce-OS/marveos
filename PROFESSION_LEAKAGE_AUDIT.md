# Profession Leakage Audit

Date: 2026-05-25
Repository: marveos
Scope: focused audit for hardcoded Makeup Artist fallback or profession leakage

## 1. Search Patterns Used

Primary repository-wide pattern sweep:

- makeup
- makeup-artist
- Makeup Artist
- professionKey
- professionOnboardingAnswers
- professionOnboardingAnswersByKey
- selectedProfession
- selectedProfessionKey
- getProfessionConfig
- resolveProfessionConfig
- generic-service-business
- enabledModules
- createDashboardWidgets
- applyProfessionConfig
- activateModules

Commands used (source-oriented):

- grep -RInE "makeup-artist|Makeup Artist|\\bmakeup\\b|professionKey|professionOnboardingAnswersByKey|professionOnboardingAnswers|selectedProfession|selectedProfessionKey|getProfessionConfig|resolveProfessionConfig|generic-service-business|enabledModules|createDashboardWidgets|applyProfessionConfig|activateModules" --exclude-dir=.next --exclude-dir=node_modules --exclude-dir=.git --exclude='*.tsbuildinfo' .
- grep -RIn "getProfessionConfig\\|resolveProfessionConfig\\|professionOnboardingAnswersByKey\\|professionOnboardingAnswers\\|selectedProfession\\|selectedProfessionKey" --exclude-dir=.next --exclude-dir=node_modules --exclude-dir=.git --exclude='*.tsbuildinfo' app lib config modules types docs *.md

## 2. Files Reviewed

Core logic and runtime surfaces:

- app/setup/mvp/page.tsx
- app/(os)/os/dashboard/page.tsx
- app/api/master/provisioning/profile-complete/route.ts
- lib/provisioning/profileCompletionFlow.ts
- lib/provisioning/index.ts
- lib/provisioning/applyProfessionConfig.ts
- lib/provisioning/activateModules.ts
- lib/provisioning/createDashboardWidgets.ts
- lib/provisioning/createDefaultRoles.ts
- lib/provisioning/createOnboardingChecklist.ts
- config/professions/index.ts
- config/professions/generic-service-business.ts
- config/professions/makeup-artist.ts

Supporting/metadata/docs checked for classification:

- lib/adminStore.ts
- .admin-data/ecommerce-admin-config.json
- app/master/templates/page.tsx
- docs/qa/template-repo-mapping-test-plan.md
- ARCHITECTURE_BOUNDARY_MAP.md
- PROFESSION_ISOLATION_CHECKS.md

## 3. Findings by Classification

### 1) Safe Explicit Profession Usage

- app/setup/mvp/page.tsx
  - profession default is empty, not makeup-artist.
  - makeup onboarding payload is only attached when professionKey is explicitly makeup-artist.
- app/api/master/provisioning/profile-complete/route.ts
  - professionKey is optional and passed through without makeup fallback.
- lib/provisioning/profileCompletionFlow.ts
  - effective profession is resolved via explicit existing/requested profession logic.
  - missing/unknown request resolves through resolveProfessionConfig with generic fallback.
  - workspace-level provisioning functions receive profession.key, not hardcoded makeup.
- config/professions/index.ts
  - DEFAULT_PROFESSION_KEY is generic-service-business.
  - resolveProfessionConfig uses generic fallback for missing/unknown keys.
- lib/provisioning/createDashboardWidgets.ts
  - makeup widget set only when input.professionKey is exactly makeup-artist; otherwise generic widgets.
- lib/provisioning/createDefaultRoles.ts and lib/provisioning/createOnboardingChecklist.ts
  - makeup-specific outputs only under explicit professionKey match.
- app/(os)/os/dashboard/page.tsx
  - makeup-specific copy/widgets gated by explicit profession and known config.

### 2) Unsafe Fallback/Default

- Found: 1
- app/(os)/os/dashboard/page.tsx
  - Previous issue: onboarding answer reads used only collected.professionOnboardingAnswers (legacy flat object), which could leak answer interpretation across professions.
  - Risk: profession-scoped answers in professionOnboardingAnswersByKey were not preferred.

### 3) Legacy Consumer Needing Migration

- app/(os)/os/dashboard/page.tsx
  - Was a legacy-only consumer before fix.
  - Now updated to prefer professionOnboardingAnswersByKey[professionKey] and fallback to legacy professionOnboardingAnswers only for backward compatibility.

### 4) Dead/Unused Reference

- config/professions/index.ts
  - getProfessionConfig is currently exported but has no active runtime usage in app/lib source (only documentation references).

### 5) Documentation-Only Reference

- ARCHITECTURE_BOUNDARY_MAP.md
- PROFESSION_ISOLATION_CHECKS.md
- docs/qa/template-repo-mapping-test-plan.md

## 4. Fixes Applied

Only unsafe/legacy issue fixed:

- app/(os)/os/dashboard/page.tsx
  - Updated boolFromCollected to:
    - Prefer collected.professionOnboardingAnswersByKey[professionKey] when available.
    - Fallback to collected.professionOnboardingAnswers for backward compatibility.
  - Updated calls to pass current resolved profession key.

No other behavior changes were made.
No feature additions, module migrations, schema changes, or unrelated refactors were performed.

## 5. Remaining Legacy Consumers

- None in active app/lib/config runtime code that rely only on professionOnboardingAnswers.
- Legacy fallback path remains intentionally in dashboard reader for compatibility with older stored data.

## 6. Validation Result

Commands executed:

- npx tsc --noEmit
- npm run build
- npm run lint

Result:

- TypeScript: pass
- Build: pass
- Lint: completes with existing warnings outside this audit scope; no errors introduced by the audit fix

## Special Checks Status

1. No missing profession resolves to makeup-artist: PASS
2. No unknown profession resolves to makeup-artist: PASS
3. No setup page preselects makeup-artist: PASS
4. No provisioning helper activates makeup modules unless explicit: PASS
5. No dashboard shows makeup copy unless explicit: PASS
6. No old consumer relies only on professionOnboardingAnswers when professionOnboardingAnswersByKey exists: PASS (fixed in dashboard)
