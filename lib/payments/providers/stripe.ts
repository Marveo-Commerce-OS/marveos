import type { ProviderVerificationInput, ProviderVerificationResult } from '@/lib/payments/types';

function getStripeSecretKey(): string {
  return String(process.env.STRIPE_SECRET_KEY || '').trim();
}

function normalizeMetadata(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, String(v)]));
}

export async function verifyStripePayment(input: ProviderVerificationInput): Promise<ProviderVerificationResult> {
  const secretKey = getStripeSecretKey();
  if (!secretKey) {
    return { ok: false, status: 'FAILED', reason: 'STRIPE_SECRET_KEY is not configured' };
  }

  const isCheckoutSession = input.reference.startsWith('cs_');
  const endpoint = isCheckoutSession
    ? `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(input.reference)}`
    : `https://api.stripe.com/v1/payment_intents/${encodeURIComponent(input.reference)}`;

  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  }).catch(() => null);

  if (!response) {
    return { ok: false, status: 'FAILED', reason: 'Stripe verification request failed' };
  }

  const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok || !body) {
    const message = typeof body?.error === 'object' && body.error && 'message' in body.error
      ? String((body.error as Record<string, unknown>).message || '')
      : `Stripe verification failed with status ${response.status}`;
    return { ok: false, status: 'FAILED', reason: message, raw: body };
  }

  if (isCheckoutSession) {
    const amountTotal = typeof body.amount_total === 'number' ? Number((body.amount_total / 100).toFixed(2)) : undefined;
    const currency = body.currency ? String(body.currency).toUpperCase() : undefined;
    const customerEmail = body.customer_details && typeof body.customer_details === 'object'
      ? String((body.customer_details as Record<string, unknown>).email || '').toLowerCase() || undefined
      : undefined;
    const status = String(body.payment_status || 'unknown');

    return {
      ok: status === 'paid',
      status,
      amount: amountTotal,
      currency,
      customerEmail,
      metadata: normalizeMetadata(body.metadata),
      raw: body,
      reason: status === 'paid' ? undefined : 'Stripe checkout session payment_status is not paid',
    };
  }

  const amountReceived = typeof body.amount_received === 'number' ? Number((body.amount_received / 100).toFixed(2)) : undefined;
  const currency = body.currency ? String(body.currency).toUpperCase() : undefined;
  const status = String(body.status || 'unknown');
  const customerEmail = body.receipt_email ? String(body.receipt_email).toLowerCase() : undefined;

  return {
    ok: status === 'succeeded',
    status,
    amount: amountReceived,
    currency,
    customerEmail,
    metadata: normalizeMetadata(body.metadata),
    raw: body,
    reason: status === 'succeeded' ? undefined : 'Stripe payment intent status is not succeeded',
  };
}
