import type { ProviderVerificationInput, ProviderVerificationResult } from '@/lib/payments/types';

function getPaypalClientId(): string {
  return String(process.env.PAYPAL_CLIENT_ID || '').trim();
}

function getPaypalClientSecret(): string {
  return String(process.env.PAYPAL_CLIENT_SECRET || '').trim();
}

function getPaypalBaseUrl(mode: 'live' | 'sandbox'): string {
  return mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
}

async function getPaypalAccessToken(mode: 'live' | 'sandbox'): Promise<string | null> {
  const clientId = getPaypalClientId();
  const clientSecret = getPaypalClientSecret();
  if (!clientId || !clientSecret) return null;

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const response = await fetch(`${getPaypalBaseUrl(mode)}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
  }).catch(() => null);

  if (!response) return null;
  const body = (await response.json().catch(() => null)) as { access_token?: string } | null;
  return body?.access_token || null;
}

export async function verifyPaypalPayment(input: ProviderVerificationInput): Promise<ProviderVerificationResult> {
  const clientId = getPaypalClientId();
  const clientSecret = getPaypalClientSecret();
  if (!clientId || !clientSecret) {
    return { ok: false, status: 'FAILED', reason: 'PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET is not configured' };
  }

  const accessToken = await getPaypalAccessToken(input.mode);
  if (!accessToken) {
    return { ok: false, status: 'FAILED', reason: 'PayPal access token request failed' };
  }

  const response = await fetch(
    `${getPaypalBaseUrl(input.mode)}/v2/checkout/orders/${encodeURIComponent(input.reference)}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    },
  ).catch(() => null);

  if (!response) {
    return { ok: false, status: 'FAILED', reason: 'PayPal verification request failed' };
  }

  const body = (await response.json().catch(() => null)) as {
    status?: string;
    payer?: { email_address?: string };
    purchase_units?: Array<{
      amount?: { value?: string; currency_code?: string };
      custom_id?: string;
      reference_id?: string;
      invoice_id?: string;
    }>;
    message?: string;
  } | null;

  if (!response.ok || !body) {
    return {
      ok: false,
      status: 'FAILED',
      reason: body?.message || `PayPal verification failed with status ${response.status}`,
      raw: body,
    };
  }

  const unit = body.purchase_units?.[0];
  const amount = unit?.amount?.value ? Number(unit.amount.value) : undefined;
  const currency = unit?.amount?.currency_code ? String(unit.amount.currency_code).toUpperCase() : undefined;
  const customerEmail = body.payer?.email_address ? String(body.payer.email_address).toLowerCase() : undefined;
  const metadata: Record<string, string> = {};
  if (unit?.custom_id) metadata.custom_id = unit.custom_id;
  if (unit?.reference_id) metadata.reference_id = unit.reference_id;
  if (unit?.invoice_id) metadata.invoice_id = unit.invoice_id;

  const status = String(body.status || 'unknown');
  const successful = status === 'COMPLETED';

  return {
    ok: successful,
    status,
    amount,
    currency,
    customerEmail,
    metadata,
    raw: body,
    reason: successful ? undefined : 'PayPal order status is not COMPLETED',
  };
}
