import type { ProviderVerificationInput, ProviderVerificationResult } from '@/lib/payments/types';

function getPaystackSecretKey(): string {
  return String(process.env.PAYSTACK_SECRET_KEY || '').trim();
}

export async function verifyPaystackPayment(input: ProviderVerificationInput): Promise<ProviderVerificationResult> {
  const secretKey = getPaystackSecretKey();
  if (!secretKey) {
    return { ok: false, status: 'FAILED', reason: 'PAYSTACK_SECRET_KEY is not configured' };
  }

  const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(input.reference)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  }).catch(() => null);

  if (!response) {
    return { ok: false, status: 'FAILED', reason: 'Paystack verification request failed' };
  }

  const body = (await response.json().catch(() => null)) as {
    status?: boolean;
    data?: {
      status?: string;
      amount?: number;
      currency?: string;
      customer?: { email?: string };
      metadata?: Record<string, unknown>;
    };
    message?: string;
  } | null;

  if (!response.ok || !body || !body.status || !body.data) {
    return {
      ok: false,
      status: 'FAILED',
      reason: body?.message || `Paystack verification failed with status ${response.status}`,
      raw: body,
    };
  }

  const amount = typeof body.data.amount === 'number' ? Number((body.data.amount / 100).toFixed(2)) : undefined;
  const currency = body.data.currency ? String(body.data.currency).toUpperCase() : undefined;
  const customerEmail = body.data.customer?.email ? String(body.data.customer.email).toLowerCase() : undefined;
  const metadata = body.data.metadata
    ? Object.fromEntries(Object.entries(body.data.metadata).map(([k, v]) => [k, String(v)]))
    : {};

  const successful = body.data.status === 'success';
  return {
    ok: successful,
    status: body.data.status || 'unknown',
    amount,
    currency,
    customerEmail,
    metadata,
    raw: body,
    reason: successful ? undefined : 'Paystack status is not successful',
  };
}
