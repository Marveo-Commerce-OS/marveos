# MVP Setup Smoke Test

Route: /setup/mvp

## Purpose
Quick regression check for onboarding step transitions and critical UI state.

## Preconditions
- Dev server running
- MVP onboarding enabled

## Test Steps
1. Open /setup/mvp
2. Plan step: click Continue
3. Profile step:
   - Enter Business name
   - Enter Contact email
   - Enter Primary domain
   - Confirm Continue becomes enabled
   - Click Continue
4. Website type step:
   - Select New Website
   - Confirm Continue becomes enabled
   - Click Continue
5. Details step:
   - Enter Website domain
   - Enter Contact email
   - Select a template
   - Click Review
6. Review step:
   - Confirm summary displays selected website type and business name
   - Confirm Start installation button is visible
7. Click Back from Review and verify Details step returns

## Expected Results
- No client-side crashes or red error overlays
- Each step renders expected controls and helper text
- Continue/Review/Start actions reflect required validation states
- Step rail remains visible and updates with navigation

## Notes
- This is a lightweight smoke check, not a full contract/API test.
- Deployment API behavior should be validated separately in endpoint tests.
