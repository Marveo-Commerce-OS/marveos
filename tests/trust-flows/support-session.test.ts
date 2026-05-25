import assert from 'node:assert/strict';
import {
  createSupportOtpChallenge,
  markSupportOtpAttempt,
  verifySupportOtpHash,
} from '../../lib/support-access/requestSupportSession';
import { verifySupportOtpAndCreateSession } from '../../lib/support-access/verifySupportOTP';
import { createSupportSession } from '../../lib/support-access/createSupportSession';
import { validateSupportSessionToken } from '../../lib/support-access/validateSupportSession';

type AsyncOrSync = Promise<void> | void;

type TrustFlowCase = {
  id: number;
  name: string;
  run: () => AsyncOrSync;
};

async function withFrozenNow<T>(timestamp: number, run: () => Promise<T> | T): Promise<T> {
  const originalNow = Date.now;
  Date.now = () => timestamp;
  try {
    return await run();
  } finally {
    Date.now = originalNow;
  }
}

export const SUPPORT_SESSION_CASES: TrustFlowCase[] = [
  {
    id: 6,
    name: 'support OTP expiry',
    run: async () => {
      const issuedAt = Date.now();
      const challenge = createSupportOtpChallenge({
        workspaceId: 'ws_expire',
        supportUserId: 'support_1',
        clientEmail: 'client@example.com',
        reason: 'expiry-case',
        ttlMs: 10,
      });

      const result = await withFrozenNow(issuedAt + 20, async () => verifySupportOtpAndCreateSession({
        challengeId: challenge.challengeId,
        otpCode: challenge.otpCode,
      }));

      assert.equal(result.ok, false);
      assert.match(String('reason' in result ? result.reason : ''), /expired/i);
    },
  },
  {
    id: 7,
    name: 'invalid support OTP',
    run: async () => {
      const challenge = createSupportOtpChallenge({
        workspaceId: 'ws_invalid',
        supportUserId: 'support_1',
        clientEmail: 'client@example.com',
        reason: 'invalid-otp-case',
      });

      const result = await verifySupportOtpAndCreateSession({
        challengeId: challenge.challengeId,
        otpCode: '000000',
      });

      assert.equal(result.ok, false);
      assert.match(String('reason' in result ? result.reason : ''), /invalid/i);
    },
  },
  {
    id: 8,
    name: 'support OTP attempt limit',
    run: async () => {
      const challenge = createSupportOtpChallenge({
        workspaceId: 'ws_attempt_limit',
        supportUserId: 'support_1',
        clientEmail: 'client@example.com',
        reason: 'attempt-limit-case',
        maxAttempts: 2,
      });

      assert.equal(verifySupportOtpHash(challenge.challengeId, '111111'), false);
      markSupportOtpAttempt(challenge.challengeId);
      assert.equal(verifySupportOtpHash(challenge.challengeId, '222222'), false);
      const attempted = markSupportOtpAttempt(challenge.challengeId);
      assert.equal((attempted?.attemptCount || 0) >= 2, true);

      const result = await verifySupportOtpAndCreateSession({
        challengeId: challenge.challengeId,
        otpCode: challenge.otpCode,
      });

      assert.equal(result.ok, false);
      assert.match(String('reason' in result ? result.reason : ''), /attempts exceeded/i);
    },
  },
  {
    id: 9,
    name: 'invalid support session token',
    run: () => {
      const result = validateSupportSessionToken({
        token: 'invalid.token',
        workspaceId: 'ws_invalid_token',
        supportUserId: 'support_1',
      });

      assert.equal(result.ok, false);
      assert.match(String('reason' in result ? result.reason : ''), /invalid/i);
    },
  },
  {
    id: 10,
    name: 'expired support session token',
    run: async () => {
      const { token } = createSupportSession({
        workspaceId: 'ws_expired_session',
        supportUserId: 'support_1',
        clientEmail: 'client@example.com',
        reason: 'expired-session-case',
        ttlMs: 5,
      });

      const result = await withFrozenNow(Date.now() + 30, async () => validateSupportSessionToken({
        token,
        workspaceId: 'ws_expired_session',
        supportUserId: 'support_1',
      }));

      assert.equal(result.ok, false);
      assert.match(String('reason' in result ? result.reason : ''), /expired/i);
    },
  },
];

export async function runSupportSessionTrustFlowCases() {
  for (const testCase of SUPPORT_SESSION_CASES) {
    await testCase.run();
  }
}
