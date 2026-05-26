export const FINANCE_CURRENCY_OPTIONS = ['USD', 'GBP', 'EUR', 'NGN'] as const;

export const FINANCE_PAYMENT_METHOD_OPTIONS = [
  'bank_transfer',
  'card',
  'cash',
  'wallet',
  'paystack',
  'stripe',
  'flutterwave',
  'paypal',
  'other',
] as const;

export function formatFinanceOptionLabel(value: string): string {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
