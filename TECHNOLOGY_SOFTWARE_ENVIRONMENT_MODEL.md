# Technology & Software Environment Model

## Purpose

This environment provides a client workspace experience for Technology & Software businesses without turning the client OS into Marvéo Master.

It is intended for:

- SaaS companies
- Digital agencies
- IT support companies
- Software development companies
- Automation consultants

## Boundary Rules

- This is a client workspace, not a platform-owner console.
- It must not expose master/admin controls inside the client OS.
- It must not hardcode Marvéo-specific business behavior into the client experience.
- It must not become the default experience for all users.
- It must not change the Makeup Artist flow.
- It must not auto-create a workspace during onboarding.
- It must not deploy a website automatically.

## Taxonomy

The onboarding taxonomy now separates:

- Business type
- Sector
- Profession

For Technology & Software, the sector is `technology-software`, with these professions:

- `saas-software-platform`
- `digital-agency`
- `it-support-company`
- `software-development-company`
- `automation-consultant`

## Profession Config Model

Each profession config now defines:

- Enabled modules
- Dashboard widgets
- Sidebar navigation
- Onboarding questions
- Default workflows
- KPI cards
- Terminology
- Quick actions

The shared profession schema includes quick actions so the dashboard and provisioning flow can remain config-driven.

## Dashboard Behavior

The dashboard summary now resolves the profession config and emits:

- `dashboardWidgets`
- `quickActions`
- `dashboardSignals`

The dashboard page renders widgets from that profession config instead of a fixed list. This keeps the Makeup Artist experience intact while allowing Technology & Software professions to show their own operational cards.

Dashboard signal examples include counts and labels for:

- Open tickets
- Live chat queue
- Website enquiries
- Active clients
- Active subscriptions
- Monthly revenue
- Support response time
- Onboarding requests
- Active projects
- Pending milestones
- Pending invoices
- Consultation requests
- Workflow opportunities

## Website Defaults

When a new website is selected, the setup flow now applies profession-aware page defaults.

Examples:

- SaaS: Home, Features, Pricing, Contact
- Digital Agency: Home, Services, Case Studies, Contact
- IT Support: Home, Services, Support Plans, Contact
- Software Development: Home, Services, Process, Contact
- Automation Consultant: Home, Services, Automation Workflows, Contact

If no exact profession is selected, the sector fallback still gives a technology-oriented default page set.

## Template Eligibility

Public templates are now ranked using onboarding context:

1. Exact profession match
2. Sector match
3. Business type match
4. Generic fallback

This ranking is used when fetching public templates for the setup flow.

Template metadata now includes optional profession tags so Technology & Software templates can be surfaced first without removing other valid templates.

## Current Template Catalog

The default store now includes five Technology & Software template entries:

- SaaS Platform
- Agency Growth
- IT Support Center
- Dev Studio
- Automation Consultant

These are support-driven public templates, so they can surface without pretending a workspace has already been provisioned.

## Safety Notes

- The dashboard summary API still returns a safe fallback payload when no workspace exists.
- Template filtering remains public-only and plan-aware.
- The new environment does not alter the master console model or the Makeup Artist onboarding path.

## Limitations

- The Technology & Software template entries are metadata-driven and support-assisted.
- Workspace provisioning is still deferred until the user completes onboarding.
- Website deployment remains a separate operational step.
