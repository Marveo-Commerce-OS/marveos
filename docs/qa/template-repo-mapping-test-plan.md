# SAFE PHASE 3E QA: Template Repo Mapping

## Objective

Validate that template metadata in Marveo Master maps to real artifacts in `marveo-templates`, and that public visibility respects artifact status gates.

## Test Matrix

1. Master metadata fields
- Open `/master/templates`.
- Confirm each template can display and edit:
  - `repoSource`
  - `repoPath`
  - `version`
  - `artifactStatus`
  - `sector`
  - `category`

2. Publish guard validation
- Edit a template to `status=ACTIVE` and `visibility=PUBLIC` with:
  - `artifactStatus=MISSING`
  - `requiresSupport=false`
- Expected: save/create is rejected with message `Cannot publish until template artifact is mapped.`

3. Support/manual exception path
- Set:
  - `status=ACTIVE`
  - `visibility=PUBLIC`
  - `artifactStatus=MISSING`
  - `requiresSupport=true`
- Expected: save is allowed.

4. Public template API filtering
- Call `/api/public/templates?status=ACTIVE&visibility=PUBLIC&websiteType=NEW_WEBSITE`.
- Expected: only templates meeting public eligibility are returned.
- Confirm templates with `artifactStatus=MISSING` are excluded unless support/manual exception applies.

5. Website template catalog behavior
- Open marveo-website templates page.
- Force API error or unavailable response.
- Expected: no dummy fallback templates are shown.
- Expected: user sees explicit unavailable-state message.

6. Setup wizard NEW_WEBSITE behavior
- Open setup MVP and select NEW_WEBSITE.
- Confirm template options are loaded from API only.
- If API returns empty, expected message: no templates available for selected plan/country.
- Confirm deployment is blocked when no template is selected.

7. Repository mapping integrity
- Verify mapped artifact files exist in marveo-templates:
  - `landing-pages/business-pro/template.json`
  - `beauty/makeup-artist/template.json`
- Ensure these files include matching `templateId`, `version`, and classification fields.

8. Manual import endpoint
- POST to `/api/master/templates/import` with valid templates payload.
- Expected: records upsert and response returns imported count.
- Retry with invalid payload.
- Expected: validation error response without partial corruption.

## Sign-off Criteria

- All checks pass without regression in pricing/onboarding/connector flows.
- Public template exposure is strictly API-gated and artifact-aware.
- No independent dummy catalogs remain in website/setup template selection flows.
