import type { ExpenseCategoryKey, IncomeCategoryKey } from '@/lib/finance/types';

export type FinanceCategoryDefinition<T extends string> = {
  key: T;
  label: string;
  reportGroup: string;
};

export const INCOME_CATEGORIES: FinanceCategoryDefinition<IncomeCategoryKey>[] = [
  { key: 'subscriptions', label: 'Subscriptions', reportGroup: 'Recurring Revenue' },
  { key: 'workspace_setup', label: 'Workspace Setup', reportGroup: 'Setup Revenue' },
  { key: 'deployment_services', label: 'Deployment Services', reportGroup: 'Services Revenue' },
  { key: 'template_sales', label: 'Template Sales', reportGroup: 'Digital Products' },
  { key: 'ai_addons', label: 'AI Add-ons', reportGroup: 'Add-on Revenue' },
  { key: 'website_support', label: 'Website Support', reportGroup: 'Support Revenue' },
  { key: 'domain_hosting', label: 'Domain & Hosting', reportGroup: 'Infrastructure Revenue' },
  { key: 'custom_development', label: 'Custom Development', reportGroup: 'Services Revenue' },
  { key: 'consulting', label: 'Consulting', reportGroup: 'Services Revenue' },
  { key: 'training', label: 'Training', reportGroup: 'Services Revenue' },
  { key: 'partner_revenue', label: 'Partner Revenue', reportGroup: 'Partner Revenue' },
  { key: 'loan_funding', label: 'Loan Funding', reportGroup: 'Financing Inflows (Non-Revenue)' },
];

export const EXPENSE_CATEGORIES: FinanceCategoryDefinition<ExpenseCategoryKey>[] = [
  { key: 'cloud_hosting', label: 'Cloud Hosting', reportGroup: 'Infrastructure Costs' },
  { key: 'infrastructure', label: 'Infrastructure', reportGroup: 'Infrastructure Costs' },
  { key: 'software_subscriptions', label: 'Software Subscriptions', reportGroup: 'Operations Costs' },
  { key: 'domains', label: 'Domains', reportGroup: 'Infrastructure Costs' },
  { key: 'marketing_ads', label: 'Marketing & Ads', reportGroup: 'Growth Costs' },
  { key: 'staff_salaries', label: 'Staff Salaries', reportGroup: 'People Costs' },
  { key: 'contractors', label: 'Contractors', reportGroup: 'People Costs' },
  { key: 'refunds', label: 'Refunds', reportGroup: 'Revenue Adjustments' },
  { key: 'operations', label: 'Operations', reportGroup: 'Operations Costs' },
  { key: 'office_admin', label: 'Office/Admin', reportGroup: 'Operations Costs' },
  { key: 'customer_support', label: 'Customer Support', reportGroup: 'People Costs' },
  { key: 'development_costs', label: 'Development Costs', reportGroup: 'Product Costs' },
  { key: 'payment_gateway_charges', label: 'Payment Gateway Charges', reportGroup: 'Transaction Costs' },
  { key: 'taxes_compliance', label: 'Taxes & Compliance', reportGroup: 'Compliance Costs' },
  { key: 'loan_repayments', label: 'Loan Repayments', reportGroup: 'Financing Outflows (Non-Operational)' },
];

export const INCOME_CATEGORY_LABEL_MAP = Object.fromEntries(
  INCOME_CATEGORIES.map((entry) => [entry.key, entry.label]),
) as Record<IncomeCategoryKey, string>;

export const EXPENSE_CATEGORY_LABEL_MAP = Object.fromEntries(
  EXPENSE_CATEGORIES.map((entry) => [entry.key, entry.label]),
) as Record<ExpenseCategoryKey, string>;

export function isIncomeCategoryKey(value: string): value is IncomeCategoryKey {
  return INCOME_CATEGORIES.some((entry) => entry.key === value);
}

export function isExpenseCategoryKey(value: string): value is ExpenseCategoryKey {
  return EXPENSE_CATEGORIES.some((entry) => entry.key === value);
}

export function incomeCategoryLabel(value: string): string {
  return INCOME_CATEGORY_LABEL_MAP[value as IncomeCategoryKey] || value;
}

export function expenseCategoryLabel(value: string): string {
  return EXPENSE_CATEGORY_LABEL_MAP[value as ExpenseCategoryKey] || value;
}
