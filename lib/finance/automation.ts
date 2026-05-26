import { recordIncomeEvent as recordLedgerIncomeEvent } from '@/lib/finance/ledger';
import type { FinanceLedgerEntry } from '@/lib/finance/types';
import type { IncomeCategoryKey, IncomeStatus, RecordIncomeEventInput } from '@/lib/finance/types';

const SOURCE_CATEGORY_MAP: Record<string, IncomeCategoryKey> = {
  subscription_paid: 'subscriptions',
  workspace_setup_paid: 'workspace_setup',
  deployment_fee_paid: 'deployment_services',
  ai_addon_activated: 'ai_addons',
  template_purchase: 'template_sales',
  support_retainer: 'website_support',
  invoice_paid: 'subscriptions',
  manual_adjustment: 'consulting',
};

export async function recordIncomeAutomationEvent(input: {
  source: string;
  sourceId: string;
  amount: number;
  currency: string;
  reference: string;
  description: string;
  status: IncomeStatus;
  createdBy: string;
  workspaceId?: string;
  clientId?: string;
  category?: IncomeCategoryKey;
  subcategory?: string;
  transactionDate?: string;
}): Promise<FinanceLedgerEntry> {
  const source = String(input.source || '').trim();
  const category = input.category || SOURCE_CATEGORY_MAP[source] || 'subscriptions';

  const payload: RecordIncomeEventInput = {
    category,
    subcategory: input.subcategory,
    amount: input.amount,
    currency: input.currency,
    description: input.description,
    reference: input.reference,
    source,
    sourceId: input.sourceId,
    workspaceId: input.workspaceId,
    clientId: input.clientId,
    status: input.status,
    createdBy: input.createdBy,
    transactionDate: input.transactionDate,
  };

  return recordLedgerIncomeEvent(payload);
}

export async function recordIncomeEvent(input: {
  source: string;
  sourceId: string;
  amount: number;
  currency: string;
  reference: string;
  description: string;
  status: IncomeStatus;
  createdBy: string;
  workspaceId?: string;
  clientId?: string;
  category?: IncomeCategoryKey;
  subcategory?: string;
  transactionDate?: string;
}): Promise<FinanceLedgerEntry> {
  return recordIncomeAutomationEvent(input);
}
