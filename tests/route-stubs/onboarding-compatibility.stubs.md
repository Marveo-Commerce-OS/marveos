# Onboarding Compatibility Route Stubs (Phase 2C)

These are manual/smoke stubs that validate compatibility behavior without introducing a full test framework.

## Preconditions

- Authenticated admin session cookie present
- Existing workspace id available as WORKSPACE_ID
- Local server running

## 1) Legacy numeric onboarding payload still works

Request:
```bash
curl -X PUT http://localhost:3000/api/cloud/workspaces/$WORKSPACE_ID/onboarding \
  -H 'Content-Type: application/json' \
  -d '{"step":2,"action":"start"}'
```

Expect:
- 200 response
- `workspace.currentStep` present
- no required MVP optional fields needed

## 2) New onboardingStepKey payload works

Request:
```bash
curl -X PUT http://localhost:3000/api/cloud/workspaces/$WORKSPACE_ID/onboarding \
  -H 'Content-Type: application/json' \
  -d '{"onboardingStepKey":"WORKSPACE_CREATED","action":"complete"}'
```

Expect:
- 200 response
- `compatibility.onboardingStepKey` present
- numeric fallback still present

## 3) Workspace creation accepts optional onboarding seed data

Request:
```bash
curl -X POST http://localhost:3000/api/cloud/workspaces \
  -H 'Content-Type: application/json' \
  -d '{
    "name":"Stub Workspace",
    "businessType":"Retail",
    "country":"US",
    "businessModel":"B2C",
    "contentSource":"wordpress",
    "contentBaseUrl":"https://example.com",
    "planId":"starter-monthly",
    "websiteType":"NEW_WEBSITE",
    "businessProfile":{"domain":"example.com"},
    "selectedTemplateId":"tpl-default",
    "supportRequired":true
  }'
```

Expect:
- 201 response
- workspace created
- optional fields persisted when provided

## 4) Invalid optional business data does not break legacy flow

Request:
```bash
curl -X PUT http://localhost:3000/api/cloud/workspaces/$WORKSPACE_ID/onboarding \
  -H 'Content-Type: application/json' \
  -d '{
    "step":3,
    "action":"complete",
    "websiteType":"NEW_WEBSITE",
    "collectedBusinessData":{"businessName":"Only name"}
  }'
```

Expect:
- 200 response
- transition still succeeds
- warnings and onboardingValidation details may appear

## 5) Launch guard preserves pass/block behavior

Request:
```bash
curl http://localhost:3000/api/cloud/workspaces/$WORKSPACE_ID/launch-guard
```

Expect:
- Existing `ready` and `missingRequirements` behavior unchanged
- `mvpSignals` included as additive metadata only
