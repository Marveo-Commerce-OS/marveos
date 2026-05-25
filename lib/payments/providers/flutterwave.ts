import type { ProviderVerificationInput, ProviderVerificationResult } from '@/lib/payments/types';

function getFlutterwaveSecretKey(): string {
  return String(process.env.FLUTTERWAVE_SECRET_KEY || '').trim();
}

export async function verifyFlutterwavePayment(input: ProviderVerificationInput): Promise<ProviderVerificationResult> {
  const secretKey = getFlutterwaveSecretKey();
  if (!secretKey) {
    return { ok: false, status: 'FAILED', reason: 'FLUTTERWAVE_SECRET_KEY is not configured' };
  }

  const response = await fetch(
    `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(input.reference)}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    },
  ).catch(() => null);

  if (!response) {
    return { ok: false, status: 'FAILED', reason: 'Flutterwave verification request failed' };
  }

  const body = (await response.json().catch(() => null)) as {
    status?: string;
    data?: {
      status?: string;
      amount?: number;
      currency?: string;
      customer?: { email?: string };
      meta?: Record<string, unknown>;
    };
    message?: string;
  } | null;

  if (!response.ok || !body || body.status !== 'success' || !body.data) {
    return {
      ok: false,
      status: 'FAILED',
      reason: body?.message || `Flutterwave verification failed with status ${response.status}`,
      raw: body,
    };
  }

  const amount = typeof body.data.amount === 'number' ? body.data.amount : undefined;
  const currency = body.data.currency ? String(body.data.currency).toUpperCase() : undefined;
  const customerEmail = body.data.customer?.email ? String(body.data.customer.email).toLowerCase() : undefined;
  const metadata = body.data.meta
    ? Object.fromEntries(Object.entries(body.data.meta).map(([k, v]) => [k, String(v)]))
    : {};

  const successful = body.data.status === 'successful';
  return {
    ok: successful,
    status: body.data.status || 'unknown',
    amount,
    currency,
    customerEmail,
    metadata,
    raw: body,
    reason: successful ? undefined : 'Flutterwave status is not successful',
  };
}
