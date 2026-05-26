# Marveo Finance Ops Model

## 1) Ledger model
Marveo uses a unified operational ledger entry model for both income and expenses.

Core fields:
- id
- type (`income` | `expense`)
- category
- subcategory
- amount
- currency
- description
- reference
- source
- sourceId
- workspaceId (optional)
- clientId (optional)
- status
- createdBy
- createdAt
- transactionDate

Expense-specific operational fields:
- vendor
- paymentMethod
- receipt (optional)
- notes (optional)
- incurredDate

Income statuses:
- pending
- paid
- failed
- refunded

Expense statuses:
- pending
- approved
- paid
- cancelled

## 2) Income automation model
`recordIncomeEvent()` and `recordIncomeAutomationEvent()` write platform revenue events into the ledger.

Current wired automation:
- Subscription upgrade request -> pending income event
- Payment verify success -> paid income event
- Payment verify failure -> failed income event

Automation rules:
- Deduplication is enforced by source + sourceId (upsert behavior)
- Events are linked with source/reference/sourceId
- Manual entries and adjustments are supported
- Failed payments remain in ledger but are excluded from paid revenue metrics

## 3) Expense categories
Operational expense categories:
- Cloud Hosting
- Infrastructure
- Software Subscriptions
- Domains
- Marketing & Ads
- Staff Salaries
- Contractors
- Refunds
- Operations
- Office/Admin
- Customer Support
- Development Costs
- Payment Gateway Charges
- Taxes & Compliance

## 4) Revenue categories
Income categories:
- Subscriptions
- Workspace Setup
- Deployment Services
- Template Sales
- AI Add-ons
- Website Support
- Domain & Hosting
- Custom Development
- Consulting
- Training
- Partner Revenue

## 5) Finance permissions
Finance routes and APIs are restricted to:
- SUPER_ADMIN
- ADMIN
- BILLING_MANAGER

Excluded roles:
- CUSTOMER_SUPPORT
- TECHNICAL_SUPPORT
- DEPLOYMENT_MANAGER
- Client roles

## 6) Operational finance philosophy
Marveo finance ops is designed for operational visibility and investor readiness, not full statutory accounting.

Focus:
- Practical revenue/expense tracking
- Unified ledger visibility
- Category-level insights
- Fast export for operational review
- Future-ready metrics foundation (MRR/ARR/burn)

## 7) Future accounting limitations
Not implemented intentionally:
- Full double-entry accounting
- Payroll engine
- Tax filing engine
- General ledger reconciliation engine
- Advanced forecasting
- Full ERP accounting workflows

This layer is a clean operational finance foundation and can integrate with accounting systems later.
