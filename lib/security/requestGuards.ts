import { NextRequest, NextResponse } from 'next/server';

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 30;

type RateEntry = {
  count: number;
  windowStart: number;
};

const inMemoryRateLimitStore = new Map<string, RateEntry>();

function getClientAddress(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for') || '';
  const first = forwarded.split(',')[0]?.trim();
  if (first) return first;
  return 'unknown';
}

function cleanOldRateEntries(now: number) {
  for (const [key, value] of inMemoryRateLimitStore.entries()) {
    if (now - value.windowStart > RATE_LIMIT_WINDOW_MS * 2) {
      inMemoryRateLimitStore.delete(key);
    }
  }
}

export function enforceRateLimit(req: NextRequest, routeKey: string): NextResponse | null {
  const now = Date.now();
  cleanOldRateEntries(now);

  const key = `${routeKey}:${getClientAddress(req)}`;
  const existing = inMemoryRateLimitStore.get(key);
  if (!existing || now - existing.windowStart > RATE_LIMIT_WINDOW_MS) {
    inMemoryRateLimitStore.set(key, { count: 1, windowStart: now });
    return null;
  }

  const nextCount = existing.count + 1;
  inMemoryRateLimitStore.set(key, { ...existing, count: nextCount });

  if (nextCount > RATE_LIMIT_MAX_REQUESTS) {
    return NextResponse.json(
      { error: 'Too many requests. Please retry shortly.' },
      { status: 429, headers: { 'Retry-After': '60' } },
    );
  }

  return null;
}

export function asTrimmedString(value: unknown): string {
  return String(value ?? '').trim();
}

export function asOptionalTrimmedString(value: unknown): string | undefined {
  const normalized = asTrimmedString(value);
  return normalized || undefined;
}

export function parseBillingInterval(value: unknown): 'MONTHLY' | 'ANNUAL' | null {
  const normalized = asTrimmedString(value).toUpperCase();
  if (normalized === 'MONTHLY' || normalized === 'ANNUAL') return normalized;
  return null;
}

export function parsePaymentProvider(value: unknown): 'PAYSTACK' | 'FLUTTERWAVE' | 'CUSTOM' | 'STRIPE' | 'PAYPAL' | null {
  const normalized = asTrimmedString(value).toUpperCase();
  if (normalized === 'PAYSTACK' || normalized === 'FLUTTERWAVE' || normalized === 'CUSTOM' || normalized === 'STRIPE' || normalized === 'PAYPAL') {
    return normalized;
  }
  return null;
}

export function parseEmail(value: unknown): string | null {
  const normalized = asTrimmedString(value).toLowerCase();
  if (!normalized) return null;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(normalized) ? normalized : null;
}
