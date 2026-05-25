import { verifyFlutterwavePayment } from '@/lib/payments/providers/flutterwave';
import { verifyPaystackPayment } from '@/lib/payments/providers/paystack';
import { verifyPaypalPayment } from '@/lib/payments/providers/paypal';
import { verifyStripePayment } from '@/lib/payments/providers/stripe';
import type {
  PaymentVerificationMode,
  ProviderVerificationResult,
  VerifyPaymentInput,
  VerifyPaymentResult,
} from '@/lib/payments/types';

function resolveVerificationMode(): PaymentVerificationMode {
  const configured = String(process.env.PAYMENT_VERIFICATION_MODE || process.env.MARVEO_PAYMENT_VERIFICATION_MODE || '').trim().toLowerCase();
  if (configured === 'live') return 'live';
  if (configured === 'sandbox' || configured === 'provider_api') return 'sandbox';
  return process.env.NODE_ENV === 'production' ? 'live' : 'sandbox';
}

function ensureModeAllowed(mode: PaymentVerificationMode): VerifyPaymentResult | null {
  if (process.env.NODE_ENV === 'production' && mode !== 'live') {
    return { ok: false, reason: 'PAYMENT_VERIFICATION_MODE must be live in production' };
  }
  return null;
}

function numericEquals(a?: number, b?: number): boolean {
  if (typeof a !== 'number' || typeof b !== 'number') return false;
  return Math.abs(a - b) <= 0.01;
}

function metadataMatches(expected: Record<string, string> | undefined, actual: Record<string, string> | undefined): boolean {
  if (!expected || Object.keys(expected).length === 0) return true;
  if (!actual) return false;
  return Object.entries(expected).every(([key, value]) => {
    const actualValue = actual[key];
    return typeof actualValue === 'string' && actualValue === value;
  });
}

async function verifyWithProvider(input: VerifyPaymentInput, mode: PaymentVerificationMode): Promise<ProviderVerificationResult> {
  if (input.provider === 'PAYSTACK') return verifyPaystackPayment({ reference: input.reference, mode });
  if (input.provider === 'FLUTTERWAVE') return verifyFlutterwavePayment({ reference: input.reference, mode });
  if (input.provider === 'STRIPE') return verifyStripePayment({ reference: input.reference, mode });
  if (input.provider === 'PAYPAL') return verifyPaypalPayment({ reference: input.reference, mode });
  return { ok: false, status: 'FAILED', reason: `Provider ${input.provider} is not supported for verification` };
}

export async function verifyPaymentWithProvider(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
  const reference = String(input.reference || '').trim();
  if (!reference) {
    return { ok: false, reason: 'payment reference is required' };
  }

  const mode = resolveVerificationMode();
  const modeError = ensureModeAllowed(mode);
  if (modeError) return modeError;

  const verification = await verifyWithProvider(input, mode);
  if (!verification.ok) {
    return {
      ok: false,
      reason: verification.reason || 'provider verification failed',
      verifiedStatus: verification.status,
      raw: verification.raw,
    };
  }

  if (typeof input.expectedAmount === 'number' && !numericEquals(input.expectedAmount, verification.amount)) {
    return {
      ok: false,
      reason: `amount mismatch: expected ${input.expectedAmount}, got ${verification.amount ?? 'unknown'}`,
      verifiedStatus: verification.status,
      verifiedAmount: verification.amount,
      verifiedCurrency: verification.currency,
      verifiedCustomerEmail: verification.customerEmail,
      metadata: verification.metadata,
      raw: verification.raw,
    };
  }

  if (input.expectedCurrency && String(input.expectedCurrency).toUpperCase() !== String(verification.currency || '').toUpperCase()) {
    return {
      ok: false,
      reason: `currency mismatch: expected ${String(input.expectedCurrency).toUpperCase()}, got ${verification.currency || 'unknown'}`,
      verifiedStatus: verification.status,
      verifiedAmount: verification.amount,
      verifiedCurrency: verification.currency,
      verifiedCustomerEmail: verification.customerEmail,
      metadata: verification.metadata,
      raw: verification.raw,
    };
  }

  if (input.expectedCustomerEmail) {
    const expectedEmail = String(input.expectedCustomerEmail).toLowerCase();
    const actualEmail = String(verification.customerEmail || '').toLowerCase();
    if (!actualEmail || expectedEmail !== actualEmail) {
      return {
        ok: false,
        reason: 'customer/email mismatch',
        verifiedStatus: verification.status,
        verifiedAmount: verification.amount,
        verifiedCurrency: verification.currency,
        verifiedCustomerEmail: verification.customerEmail,
        metadata: verification.metadata,
        raw: verification.raw,
      };
    }
  }

  if (!metadataMatches(input.expectedMetadata, verification.metadata)) {
    return {
      ok: false,
      reason: 'metadata mismatch',
      verifiedStatus: verification.status,
      verifiedAmount: verification.amount,
      verifiedCurrency: verification.currency,
      verifiedCustomerEmail: verification.customerEmail,
      metadata: verification.metadata,
      raw: verification.raw,
    };
  }

  return {
    ok: true,
    verifiedStatus: verification.status,
    verifiedAmount: verification.amount,
    verifiedCurrency: verification.currency,
    verifiedCustomerEmail: verification.customerEmail,
    metadata: verification.metadata,
    raw: verification.raw,
  };
}
