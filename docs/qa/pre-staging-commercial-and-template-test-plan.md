# Pre-Staging Commercial and Template Test Plan

Date: 2026-05-23
Scope: Commercial onboarding, pricing intervals, template source-of-truth, and master visibility before staging.

## Environment Setup

- Ensure MarveoOS API routes are reachable from marveo-website proxy routes.
- Ensure commercial store has at least one ACTIVE/PUBLIC template compatible with NEW_WEBSITE.
- Use sandbox payment references for paid verification where required.

## Commercial Pricing and Billing

1. Pricing fetch from backend
- Open marketing pricing page.
- Confirm plans load from backend route via proxy.
- Confirm fallback warning appears only when backend is unavailable.

2. Monthly and annual pricing
- Toggle monthly and annual.
- Confirm amount changes per interval based on backend plan pricing.

3. Nigeria NGN pricing
- Simulate NG region or pass country=NG.
- Confirm NGN currency and expected NG pricing values.

4. International pricing
- Simulate non-NG region (for example US).
- Confirm non-NGN currency and matching regional price.

5. Trial start flow
- Start trial from pricing.
- Confirm onboarding start succeeds and redirects to setup with session.

6. Paid sandbox verification
- Start paid flow with sandbox-compatible payment reference.
- Confirm payment verify succeeds and subscription becomes active.

## Template Source of Truth

7. Active/public template appears on website
- In Master templates, set template status ACTIVE and visibility PUBLIC.
- Confirm template appears on website templates page.

8. Inactive template does not appear
- Change same template to DRAFT or ARCHIVED.
- Confirm template disappears from website public templates list.

9. Selected template passes to pricing and onboarding
- Select template on website templates page.
- Confirm redirect goes to pricing with selectedTemplateId query.
- Start onboarding and confirm selectedTemplateId is stored in onboarding session.

10. New Website setup shows template options
- Open setup with onboarding session.
- Select NEW_WEBSITE flow.
- Confirm templates are loaded from backend public templates API (or fallback only when unavailable).

11. Existing Website flow does not force template
- Select EXISTING_WEBSITE flow.
- Confirm template selection is not shown by default.

12. Master template toggle affects frontend/setup visibility
- Toggle template status/visibility in Master templates.
- Confirm visibility changes propagate to website templates and NEW_WEBSITE setup options.

## Operational Readiness and Scaffolds

13. Master placeholder/read-only labeling
- Visit connectors, billing, system-settings pages.
- Confirm each scaffold area is labeled clearly as read-only or coming soon.
- Confirm no dead clickable controls are presented in scaffold sections.

## Regression Checks

14. Commercial onboarding regression
- Confirm trial and paid onboarding still route to setup correctly.
- Confirm recovery and upgrade path still works from pricing.

15. Connector flow regression
- Confirm existing connector verification flow remains unchanged.
- Confirm WordPress connector-related status screens still render correctly.

## Sign-off Criteria

Ready for staging when all checks above pass and no blocking regressions appear in:
- onboarding start
- payment verify
- setup entitlement gate
- template public filtering
- master template metadata persistence
