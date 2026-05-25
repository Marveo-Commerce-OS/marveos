import { createHmac, timingSafeEqual } from 'node:crypto';
import { getSupportSessionById } from './createSupportSession';

function getSupportSessionSecret(): string {
  return process.env.MARVEO_SUPPORT_SESSION_SECRET || 'marveo_support_session_dev_secret';
}

function decodeSupportToken(token: string): {
  sessionId: string;
  workspaceId?: string;
  supportUserId?: string;
  clientEmail?: string;
  exp: number;
} | null {
  const [encodedPayload, encodedSig] = String(token || '').split('.');
  if (!encodedPayload || !encodedSig) return null;

  const expectedSig = createHmac('sha256', getSupportSessionSecret()).update(encodedPayload).digest('base64url');
  const provided = Buffer.from(encodedSig);
  const expected = Buffer.from(expectedSig);
  if (provided.length !== expected.length) return null;
  if (!timingSafeEqual(provided, expected)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as {
      purpose?: string;
      sessionId?: string;
      workspaceId?: string;
      supportUserId?: string;
      clientEmail?: string;
      exp?: number;
    };

    if (parsed.purpose !== 'support_access_session') return null;
    if (!parsed.sessionId || !parsed.exp) return null;

    return {
      sessionId: parsed.sessionId,
      workspaceId: parsed.workspaceId,
      supportUserId: parsed.supportUserId,
      clientEmail: parsed.clientEmail,
      exp: parsed.exp,
    };
  } catch {
    return null;
  }
}

export function validateSupportSessionToken(input: {
  token: string;
  workspaceId?: string;
  supportUserId?: string;
}) {
  const decoded = decodeSupportToken(input.token);
  if (!decoded) {
    return { ok: false as const, reason: 'Invalid support session token' };
  }

  if (decoded.exp <= Math.floor(Date.now() / 1000)) {
    return { ok: false as const, reason: 'Support session token expired' };
  }

  const session = getSupportSessionById(decoded.sessionId);
  if (!session) {
    return { ok: false as const, reason: 'Support session not found' };
  }

  if (session.revokedAt) {
    return { ok: false as const, reason: 'Support session revoked' };
  }

  if (new Date(session.expiresAt).getTime() < Date.now()) {
    return { ok: false as const, reason: 'Support session expired' };
  }

  if (input.workspaceId && session.workspaceId !== input.workspaceId) {
    return { ok: false as const, reason: 'Support session workspace mismatch' };
  }

  if (input.supportUserId && session.supportUserId !== input.supportUserId) {
    return { ok: false as const, reason: 'Support session support user mismatch' };
  }

  return { ok: true as const, session };
}
