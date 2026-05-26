export type FinanceLedgerType = 'income' | 'expense';

export type IncomeStatus = 'pending' | 'paid' | 'failed' | 'refunded';
export type ExpenseStatus = 'pending' | 'approved' | 'paid' | 'cancelled';
export type FinanceLedgerStatus = IncomeStatus | ExpenseStatus;

export type IncomeCategoryKey =
  | 'subscriptions'
  | 'workspace_setup'
  | 'deployment_services'
  | 'template_sales'
  | 'ai_addons'
  | 'website_support'
  | 'domain_hosting'
  | 'custom_development'
  | 'consulting'
  | 'training'
  | 'partner_revenue'
  | 'loan_funding';

export type ExpenseCategoryKey =
  | 'cloud_hosting'
  | 'infrastructure'
  | 'software_subscriptions'
  | 'domains'
  | 'marketing_ads'
  | 'staff_salaries'
  | 'contractors'
  | 'refunds'
  | 'operations'
  | 'office_admin'
  | 'customer_support'
  | 'development_costs'
  | 'payment_gateway_charges'
  | 'taxes_compliance'
  | 'loan_repayments';

export type FinanceCategoryKey = IncomeCategoryKey | ExpenseCategoryKey;

export type IncomeSourceKey =
  | 'subscription_paid'
  | 'workspace_setup_paid'
  | 'deployment_fee_paid'
  | 'ai_addon_activated'
  | 'template_purchase'
  | 'support_retainer'
  | 'invoice_paid'
  | 'manual_adjustment'
  | 'loan_funding';

export interface FinanceLedgerEntry {
  id: string;
  type: FinanceLedgerType;
  category: FinanceCategoryKey;
  subcategory: string;
  amount: number;
  currency: string;
  description: string;
  reference: string;
  source: string;
  sourceId: string;
  workspaceId?: string;
  clientId?: string;
  status: FinanceLedgerStatus;
  createdBy: string;
  createdAt: string;
  transactionDate: string;
  vendor?: string;
  paymentMethod?: string;
  receipt?: string;
  notes?: string;
  incurredDate?: string;
}

export interface RecordIncomeEventInput {
  category: IncomeCategoryKey;
  subcategory?: string;
  amount: number;
  currency: string;
  description: string;
  reference: string;
  source: IncomeSourceKey | string;
  sourceId: string;
  workspaceId?: string;
  clientId?: string;
  status: IncomeStatus;
  createdBy: string;
  transactionDate?: string;
}

export interface RecordExpenseInput {
  vendor: string;
  category: ExpenseCategoryKey;
  subcategory?: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  receipt?: string;
  notes?: string;
  description?: string;
  reference?: string;
  source?: string;
  sourceId?: string;
  workspaceId?: string;
  clientId?: string;
  status?: ExpenseStatus;
  incurredDate: string;
  createdBy: string;
}

export interface LedgerFilterInput {
  type?: FinanceLedgerType;
  category?: string;
  status?: string;
  workspaceId?: string;
  clientId?: string;
  month?: string;
  search?: string;
  limit?: number;
}
