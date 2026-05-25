import assert from 'node:assert/strict';
import { verifyPaymentWithProvider } from '@/lib/payments';

type AsyncOrSync = Promise<void> | void;

type TrustFlowCase = {
  id: number;
  name: string;
  run: () => AsyncOrSync;
  skipped?: string;
};

async function withMockedFetch<T>(
  mockImpl: typeof fetch,
  run: () => Promise<T>,
): Promise<T> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mockImpl;
  try {
    return await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function withEnv<T>(
  updates: Record<string, string | undefined>,
  run: () => Promise<T>,
): Promise<T> {
  const original: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(updates)) {
    original[key] = process.env[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return await run();
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

export const PAYMENT_VERIFICATION_CASES: TrustFlowCase[] = [
  {
    id: 1,
    name: 'payment verification fail-closed behavior',
    run: async () => {
      const result = await withEnv(
        {
          PAYMENT_VERIFICATION_MODE: 'live',
          PAYSTACK_SECRET_KEY: 'test_secret',
        },
        async () => withMockedFetch(
          (async () => ({
            ok: true,
            status: 200,
            json: async () => ({
              status: true,
              data: {
                status: 'failed',
                amount: 5000,
                currency: 'NGN',
                customer: { email: 'client@example.com' },
                metadata: {
                  organizationId: 'org_1',
                  onboardingSessionId: 'onboard_1',
                },
              },
            }),
          })) as unknown as typeof fetch,
          async () => verifyPaymentWithProvider({
            provider: 'PAYSTACK',
            reference: 'ref_fail_closed',
            expectedAmount: 50,
            expectedCurrency: 'NGN',
            expectedCustomerEmail: 'client@example.com',
            expectedMetadata: {
              organizationId: 'org_1',
              onboardingSessionId: 'onboard_1',
            },
          }),
        ),
      );

      assert.equal(result.ok, false);
      assert.equal(result.verifiedStatus, 'failed');
    },
  },
  {
    id: 2,
    name: 'payment amount mismatch',
    run: async () => {
      const result = await withEnv(
        {
          PAYMENT_VERIFICATION_MODE: 'live',
          PAYSTACK_SECRET_KEY: 'test_secret',
        },
        async () => withMockedFetch(
          (async () => ({
            ok: true,
            status: 200,
            json: async () => ({
              status: true,
              data: {
                status: 'success',
                amount: 10000,
                currency: 'NGN',
                customer: { email: 'client@example.com' },
                metadata: {
                  organizationId: 'org_1',
                },
              },
            }),
          })) as unknown as typeof fetch,
          async () => verifyPaymentWithProvider({
            provider: 'PAYSTACK',
            reference: 'ref_amount_mismatch',
            expectedAmount: 50,
            expectedCurrency: 'NGN',
            expectedCustomerEmail: 'client@example.com',
            expectedMetadata: { organizationId: 'org_1' },
          }),
        ),
      );

      assert.equal(result.ok, false);
      assert.match(String(result.reason || ''), /amount mismatch/i);
    },
  },
  {
    id: 3,
    name: 'payment currency mismatch',
    run: async () => {
      const result = await withEnv(
        {
          PAYMENT_VERIFICATION_MODE: 'live',
          PAYSTACK_SECRET_KEY: 'test_secret',
        },
        async () => withMockedFetch(
          (async () => ({
            ok: true,
            status: 200,
            json: async () => ({
              status: true,
              data: {
                status: 'success',
                amount: 5000,
                currency: 'USD',
                customer: { email: 'client@example.com' },
                metadata: {
                  organizationId: 'org_1',
                },
              },
            }),
          })) as unknown as typeof fetch,
          async () => verifyPaymentWithProvider({
            provider: 'PAYSTACK',
            reference: 'ref_currency_mismatch',
            expectedAmount: 50,
            expectedCurrency: 'NGN',
            expectedCustomerEmail: 'client@example.com',
            expectedMetadata: { organizationId: 'org_1' },
          }),
        ),
      );

      assert.equal(result.ok, false);
      assert.match(String(result.reason || ''), /currency mismatch/i);
    },
  },
  {
    id: 4,
    name: 'missing provider environment variables',
    run: async () => {
      const result = await withEnv(
        {
          PAYMENT_VERIFICATION_MODE: 'live',
          PAYSTACK_SECRET_KEY: undefined,
        },
        async () => verifyPaymentWithProvider({
          provider: 'PAYSTACK',
          reference: 'ref_missing_env',
          expectedAmount: 50,
          expectedCurrency: 'NGN',
          expectedCustomerEmail: 'client@example.com',
        }),
      );

      assert.equal(result.ok, false);
      assert.match(String(result.reason || ''), /not configured/i);
    },
  },
  {
    id: 5,
    name: 'metadata/workspace/session mismatch',
    run: async () => {
      const result = await withEnv(
        {
          PAYMENT_VERIFICATION_MODE: 'live',
          PAYSTACK_SECRET_KEY: 'test_secret',
        },
        async () => withMockedFetch(
          (async () => ({
            ok: true,
            status: 200,
            json: async () => ({
              status: true,
              data: {
                status: 'success',
                amount: 5000,
                currency: 'NGN',
                customer: { email: 'client@example.com' },
                metadata: {
                  organizationId: 'org_1',
                  onboardingSessionId: 'unexpected_session',
                  selectedPlanId: 'starter',
                },
              },
            }),
          })) as unknown as typeof fetch,
          async () => verifyPaymentWithProvider({
            provider: 'PAYSTACK',
            reference: 'ref_metadata_mismatch',
            expectedAmount: 50,
            expectedCurrency: 'NGN',
            expectedCustomerEmail: 'client@example.com',
            expectedMetadata: {
              organizationId: 'org_1',
              onboardingSessionId: 'expected_session',
              selectedPlanId: 'starter',
            },
          }),
        ),
      );

      assert.equal(result.ok, false);
      assert.match(String(result.reason || ''), /metadata mismatch/i);
    },
  },
  {
    id: 6,
    name: 'no paid activation happens without provider confirmation',
    run: () => {
      // This case requires an integration harness around updateAdminStore/readAdminStore
      // and public payment route orchestration. It is intentionally scaffolded only.
      assert.equal(true, true);
    },
    skipped: 'Integration-only in current setup: no isolated store harness in tests without adding new tooling.',
  },
];

export async function runPaymentVerificationTrustFlowCases() {
  for (const testCase of PAYMENT_VERIFICATION_CASES) {
    if (!testCase.skipped) {
      await testCase.run();
    }
  }
}
