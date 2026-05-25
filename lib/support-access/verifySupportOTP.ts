import {
  deleteSupportOtpChallenge,
  getSupportOtpChallenge,
  markSupportOtpAttempt,
  markSupportOtpVerified,
  verifySupportOtpHash,
} from './requestSupportSession';
import { issueSupportSession } from './createSupportSession';

export async function verifySupportOtpAndCreateSession(input: {
  challengeId: string;
  otpCode: string;
}) {
  const challenge = getSupportOtpChallenge(input.challengeId);
  if (!challenge) {
    return { ok: false as const, reason: 'Support OTP challenge not found' };
  }

  if (challenge.verifiedAt) {
    return { ok: false as const, reason: 'Support OTP challenge already used' };
  }

  if (new Date(challenge.expiresAt).getTime() < Date.now()) {
    deleteSupportOtpChallenge(challenge.id);
    return { ok: false as const, reason: 'Support OTP challenge expired' };
  }

  if (challenge.attemptCount >= challenge.maxAttempts) {
    deleteSupportOtpChallenge(challenge.id);
    return { ok: false as const, reason: 'Support OTP attempts exceeded' };
  }

  const otpValid = verifySupportOtpHash(challenge.id, input.otpCode.trim());
  if (!otpValid) {
    const next = markSupportOtpAttempt(challenge.id);
    if (next && next.attemptCount >= next.maxAttempts) {
      deleteSupportOtpChallenge(challenge.id);
      return { ok: false as const, reason: 'Support OTP attempts exceeded' };
    }

    return { ok: false as const, reason: 'Invalid support OTP code' };
  }

  const verified = markSupportOtpVerified(challenge.id);
  if (!verified) {
    return { ok: false as const, reason: 'Support OTP verification failed' };
  }

  const issued = issueSupportSession({
    workspaceId: verified.workspaceId,
    supportUserId: verified.supportUserId,
    clientUserId: verified.clientUserId,
    clientEmail: verified.clientEmail,
    reason: verified.reason,
  });

  deleteSupportOtpChallenge(challenge.id);

  return {
    ok: true as const,
    session: issued.session,
    token: issued.token,
  };
}
