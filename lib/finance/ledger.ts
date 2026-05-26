import { readAdminStore, updateAdminStore } from '@/lib/adminStore';
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  isExpenseCategoryKey,
  isIncomeCategoryKey,
} from '@/lib/finance/categories';
import type {
  ExpenseStatus,
  FinanceLedgerEntry,
  FinanceLedgerStatus,
  IncomeStatus,
  LedgerFilterInput,
  RecordExpenseInput,
  RecordIncomeEventInput,
} from '@/lib/finance/types';

const FINANCE_ALLOWED_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'BILLING_MANAGER']);

function nowIso(): string {
  return new Date().toISOString();
}

function toId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeAmount(value: number): number {
  const rounded = Number(Number(value || 0).toFixed(2));
  return Number.isFinite(rounded) ? Math.max(0, rounded) : 0;
}

function normalizeCurrency(value: string): string {
  const normalized = String(value || 'USD').trim().toUpperCase();
  return normalized || 'USD';
}

function isAllowedIncomeStatus(value: string): value is IncomeStatus {
  return ['pending', 'paid', 'failed', 'refunded'].includes(value);
}

function isAllowedExpenseStatus(value: string): value is ExpenseStatus {
  return ['pending', 'approved', 'paid', 'cancelled'].includes(value);
}

function statusForType(type: 'income' | 'expense', value: string): FinanceLedgerStatus {
  if (type === 'income') {
    return isAllowedIncomeStatus(value) ? value : 'pending';
  }
  return isAllowedExpenseStatus(value) ? value : 'pending';
}

function includesSearch(entry: FinanceLedgerEntry, search: string): boolean {
  const haystack = [
    entry.description,
    entry.reference,
    entry.source,
    entry.sourceId,
    entry.category,
    entry.subcategory,
    entry.workspaceId,
    entry.clientId,
    entry.vendor,
    entry.notes,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(search.toLowerCase());
}

export function hasFinanceAccessFromRoles(roles: string[]): boolean {
  return roles.some((role) => FINANCE_ALLOWED_ROLES.has(String(role).trim().toUpperCase()));
}

export async function listLedgerEntries(filters?: LedgerFilterInput): Promise<FinanceLedgerEntry[]> {
  const store = await readAdminStore();
  const entries = Object.values(store.cloud.finance?.ledger || {}) as FinanceLedgerEntry[];

  let rows = [...entries].sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));

  if (filters?.type) rows = rows.filter((entry) => entry.type === filters.type);
  if (filters?.category) rows = rows.filter((entry) => entry.category === filters.category);
  if (filters?.status) rows = rows.filter((entry) => entry.status === filters.status);
  if (filters?.workspaceId) rows = rows.filter((entry) => entry.workspaceId === filters.workspaceId);
  if (filters?.clientId) rows = rows.filter((entry) => entry.clientId === filters.clientId);
  if (filters?.month) rows = rows.filter((entry) => entry.transactionDate.slice(0, 7) === filters.month);
  const search = filters?.search ? String(filters.search).trim() : '';
  if (search) rows = rows.filter((entry) => includesSearch(entry, search));

  const limit = Number(filters?.limit || 0);
  if (Number.isFinite(limit) && limit > 0) {
    rows = rows.slice(0, limit);
  }

  return rows;
}

export async function recordIncomeEvent(input: RecordIncomeEventInput): Promise<FinanceLedgerEntry> {
  const transactionDate = input.transactionDate || nowIso();
  const status = statusForType('income', input.status);

  const nextEntry: FinanceLedgerEntry = {
    id: '',
    type: 'income',
    category: isIncomeCategoryKey(input.category) ? input.category : 'subscriptions',
    subcategory: String(input.subcategory || '').trim(),
    amount: normalizeAmount(input.amount),
    currency: normalizeCurrency(input.currency),
    description: String(input.description || '').trim(),
    reference: String(input.reference || '').trim(),
    source: String(input.source || '').trim() || 'manual_adjustment',
    sourceId: String(input.sourceId || '').trim(),
    workspaceId: input.workspaceId ? String(input.workspaceId).trim() : undefined,
    clientId: input.clientId ? String(input.clientId).trim() : undefined,
    status,
    createdBy: String(input.createdBy || '').trim() || 'system',
    createdAt: nowIso(),
    transactionDate,
  };

  await updateAdminStore((current) => {
    const ledger = current.cloud.finance?.ledger || {};

    const existing = Object.values(ledger).find((row) => {
      const entry = row as FinanceLedgerEntry;
      return entry.type === 'income' && entry.source === nextEntry.source && entry.sourceId === nextEntry.sourceId;
    }) as FinanceLedgerEntry | undefined;

    if (existing) {
      const next: FinanceLedgerEntry = {
        ...existing,
        category: nextEntry.category,
        subcategory: nextEntry.subcategory,
        amount: nextEntry.amount,
        currency: nextEntry.currency,
        description: nextEntry.description,
        reference: nextEntry.reference,
        workspaceId: nextEntry.workspaceId,
        clientId: nextEntry.clientId,
        status: nextEntry.status,
        transactionDate: nextEntry.transactionDate,
      };

      current.cloud.finance.ledger[existing.id] = next;
      return { ...current };
    }

    const sequence = Number(current.cloud.finance?.counters?.nextLedgerSequence || 1);
    const id = `led_${String(sequence).padStart(6, '0')}_${toId('income')}`;

    current.cloud.finance.ledger[id] = {
      ...nextEntry,
      id,
    };

    current.cloud.finance.counters.nextLedgerSequence = sequence + 1;
    return { ...current };
  });

  const refreshed = await readAdminStore();
  const rows = Object.values(refreshed.cloud.finance.ledger) as FinanceLedgerEntry[];
  return rows
    .filter((entry) => entry.type === 'income' && entry.source === nextEntry.source && entry.sourceId === nextEntry.sourceId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] as FinanceLedgerEntry;
}

export async function createExpenseEntry(input: RecordExpenseInput): Promise<FinanceLedgerEntry> {
  const transactionDate = input.incurredDate || nowIso();
  const status = statusForType('expense', input.status || 'pending');

  const entry: FinanceLedgerEntry = {
    id: '',
    type: 'expense',
    category: isExpenseCategoryKey(input.category) ? input.category : 'operations',
    subcategory: String(input.subcategory || '').trim(),
    amount: normalizeAmount(input.amount),
    currency: normalizeCurrency(input.currency),
    description: String(input.description || input.notes || input.vendor || 'Expense').trim(),
    reference: String(input.reference || '').trim(),
    source: String(input.source || 'manual_expense').trim(),
    sourceId: String(input.sourceId || toId('expense')).trim(),
    workspaceId: input.workspaceId ? String(input.workspaceId).trim() : undefined,
    clientId: input.clientId ? String(input.clientId).trim() : undefined,
    status,
    createdBy: String(input.createdBy || '').trim() || 'system',
    createdAt: nowIso(),
    transactionDate,
    vendor: String(input.vendor || '').trim(),
    paymentMethod: String(input.paymentMethod || '').trim(),
    receipt: input.receipt ? String(input.receipt).trim() : undefined,
    notes: input.notes ? String(input.notes).trim() : undefined,
    incurredDate: transactionDate,
  };

  await updateAdminStore((current) => {
    const sequence = Number(current.cloud.finance?.counters?.nextLedgerSequence || 1);
    const id = `led_${String(sequence).padStart(6, '0')}_${toId('expense')}`;

    current.cloud.finance.ledger[id] = {
      ...entry,
      id,
    };

    current.cloud.finance.counters.nextLedgerSequence = sequence + 1;
    return { ...current };
  });

  const refreshed = await readAdminStore();
  const rows = Object.values(refreshed.cloud.finance.ledger) as FinanceLedgerEntry[];
  return rows
    .filter((item) => item.type === 'expense' && item.sourceId === entry.sourceId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] as FinanceLedgerEntry;
}

export function defaultIncomeCategoryKeys(): string[] {
  return INCOME_CATEGORIES.map((entry) => entry.key);
}

export function defaultExpenseCategoryKeys(): string[] {
  return EXPENSE_CATEGORIES.map((entry) => entry.key);
}
