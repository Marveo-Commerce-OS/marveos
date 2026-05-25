export type PaymentProvider = 'PAYSTACK' | 'FLUTTERWAVE' | 'STRIPE' | 'PAYPAL' | 'CUSTOM';

export type PaymentVerificationMode = 'live' | 'sandbox';

export interface ProviderVerificationInput {
  reference: string;
  mode: PaymentVerificationMode;
}

export interface ProviderVerificationResult {
  ok: boolean;
  status: string;
  amount?: number;
  currency?: string;
  customerEmail?: string;
  metadata?: Record<string, string>;
  raw?: unknown;
  reason?: string;
}

export interface VerifyPaymentInput {
  provider: PaymentProvider;
  reference: string;
  expectedAmount?: number;
  expectedCurrency?: string;
  expectedCustomerEmail?: string;
  expectedMetadata?: Record<string, string>;
}

export interface VerifyPaymentResult {
  ok: boolean;
  reason?: string;
  verifiedStatus?: string;
  verifiedAmount?: number;
  verifiedCurrency?: string;
  verifiedCustomerEmail?: string;
  metadata?: Record<string, string>;
  raw?: unknown;
}
