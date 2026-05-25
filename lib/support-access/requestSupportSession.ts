import { createHash, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';

interface SupportOtpChallenge {
  id: string;
  workspaceId: string;
  supportUserId: string;
  clientUserId?: string;
  clientEmail: string;
  reason: string;
  otpHash: string;
  attemptCount: number;
  maxAttempts: number;
  requestedAt: string;
  expiresAt: string;
  verifiedAt?: string;
}

const supportOtpStore = new Map<string, SupportOtpChallenge>();

function getOtpSecret(): string {
  return process.env.MARVEO_SUPPORT_OTP_SECRET || 'marveo_support_otp_dev_secret';
}

function hashOtp(challengeId: string, otp: string): string {
  return createHash('sha256').update(`${getOtpSecret()}:${challengeId}:${otp}`).digest('hex');
}

function generateOtp(): string {
  return String(randomInt(100000, 1000000));
}

export function createSupportOtpChallenge(input: {
  workspaceId: string;
  supportUserId: string;
  clientUserId?: string;
  clientEmail: string;
  reason: string;
  ttlMs?: number;
  maxAttempts?: number;
}): { challengeId: string; otpCode: string; expiresAt: string } {
  const challengeId = randomUUID();
  const otpCode = generateOtp();
  const requestedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + (input.ttlMs ?? 10 * 60 * 1000)).toISOString();

  const challenge: SupportOtpChallenge = {
    id: challengeId,
    workspaceId: input.workspaceId,
    supportUserId: input.supportUserId,
    clientUserId: input.clientUserId,
    clientEmail: input.clientEmail.toLowerCase(),
    reason: input.reason,
    otpHash: hashOtp(challengeId, otpCode),
    attemptCount: 0,
    maxAttempts: input.maxAttempts ?? 5,
    requestedAt,
    expiresAt,
  };

  supportOtpStore.set(challengeId, challenge);

  return { challengeId, otpCode, expiresAt };
}

export function getSupportOtpChallenge(challengeId: string): SupportOtpChallenge | null {
  return supportOtpStore.get(challengeId) || null;
}

export function markSupportOtpAttempt(challengeId: string): SupportOtpChallenge | null {
  const current = supportOtpStore.get(challengeId);
  if (!current) return null;
  const next = { ...current, attemptCount: current.attemptCount + 1 };
  supportOtpStore.set(challengeId, next);
  return next;
}

export function verifySupportOtpHash(challengeId: string, otpCode: string): boolean {
  const current = supportOtpStore.get(challengeId);
  if (!current) return false;
  const incomingHash = hashOtp(challengeId, otpCode);
  const left = Buffer.from(incomingHash, 'utf8');
  const right = Buffer.from(current.otpHash, 'utf8');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function markSupportOtpVerified(challengeId: string): SupportOtpChallenge | null {
  const current = supportOtpStore.get(challengeId);
  if (!current) return null;
  const next = { ...current, verifiedAt: new Date().toISOString() };
  supportOtpStore.set(challengeId, next);
  return next;
}

export function deleteSupportOtpChallenge(challengeId: string) {
  supportOtpStore.delete(challengeId);
}
