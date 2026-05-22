# Multi-Tenant Model

This document defines how Marvéo separates its internal organization from client organizations, subscriptions, and workspaces.

## Core Principle

- Marvéo internal users are operators, not customers.
- Client workspaces belong to client organizations and client subscriptions.
- Quota enforcement must be evaluated against client ownership, not the internal master account.

## Tenants and Ownership

### 1. Internal Marvéo Organization

The internal Marvéo organization is the operator control plane.

- Used for master administration.
- Used for support, audit, and internal orchestration.
- Must not be treated as the customer tenant for onboarding quota.
- Can initiate onboarding flows, but those flows should create or simulate client ownership context.

### 2. Client Organization

A client organization represents the customer account boundary.

- Stores the business identity for a customer.
- Owns one or more workspaces in the client context.
- Is the unit used for workspace quota checks in MVP.
- May map to a business email, business name, or other stable onboarding profile data.

### 3. Client Subscription

A client subscription represents the commercial plan boundary.

- Owns the workspace quota limit.
- Determines whether the client can create 1, 3, or unlimited workspaces.
- Should be evaluated per client subscription, not against the master admin account.

### 4. Workspace Ownership

A workspace belongs to a client organization and client subscription.

Recommended workspace ownership fields:

- `clientOrganizationId`
- `clientOrganizationName`
- `clientSubscriptionId`
- `clientSubscriptionPlan`
- `workspaceOwnership`

Workspace ownership should never be implied from the internal Marvéo operator account alone.

## Quota Ownership

Quota must be checked against the client context.

- Count only workspaces that share the same client organization or client subscription.
- Do not count all workspaces globally when a client is onboarding.
- Do not let a master/demo admin session consume client quota as if it were the customer tenant.

## MVP Onboarding Behavior

During `/setup/mvp` onboarding:

- The app should create or simulate a client organization context.
- Internal demo sessions should get isolated synthetic client ownership so repeated demos do not exhaust quota.
- Real client onboarding should derive a stable client organization/subscription context from the submitted business profile.
- The resulting workspace should be stored under that client ownership context.

## Demo and Internal Bypass

For MVP-safe operation:

- Internal demo/admin onboarding may bypass global quota by creating an isolated client tenant context.
- This keeps master/operator activity from consuming customer quota.
- The workspace still behaves like a client-owned workspace in the onboarding flow.

## Current MVP Limitation

- The client organization and subscription are simulated in the app store rather than backed by a full billing service.
- This is sufficient for safe onboarding, quota isolation, and operator/client separation.
- A future billing layer can replace the simulated subscription context without changing the ownership model.

## Retest Checklist

1. Open `/setup/mvp` as an internal admin/demo user.
2. Start a new onboarding flow.
3. Confirm the workspace creation no longer fails with the global master quota error.
4. Confirm the created workspace carries client ownership context.
5. Confirm quota checks apply only when workspaces share the same client organization/subscription.
6. Confirm master/admin accounts do not consume the customer quota pool globally.
