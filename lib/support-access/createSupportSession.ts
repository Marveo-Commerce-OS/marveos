import { createHmac, randomUUID } from 'node:crypto';

export interface SupportSessionRecord {
  id: string;
  workspaceId: string;
  supportUserId: string;
  clientUserId?: string;
  clientEmail: string;
  reason: string;
  issuedAt: string;
  expiresAt: string;
  revokedAt?: string;
}

const supportSessionStore = new Map<string, SupportSessionRecord>();

function getSupportSessionSecret(): string {
  return process.env.MARVEO_SUPPORT_SESSION_SECRET || 'marveo_support_session_dev_secret';
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function signPayload(encodedPayload: string): string {
  return createHmac('sha256', getSupportSessionSecret()).update(encodedPayload).digest('base64url');
}

export function createSupportSession(input: {
  workspaceId: string;
  supportUserId: string;
  clientUserId?: string;
  clientEmail: string;
  reason: string;
  ttlMs?: number;
}): { token: string; session: SupportSessionRecord } {
  const id = randomUUID();
  const issuedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + (input.ttlMs ?? 10 * 60 * 1000)).toISOString();

  const session: SupportSessionRecord = {
    id,
    workspaceId: input.workspaceId,
    supportUserId: input.supportUserId,
    clientUserId: input.clientUserId,
    clientEmail: input.clientEmail.toLowerCase(),
    reason: input.reason,
    issuedAt,
    expiresAt,
  };
  supportSessionStore.set(id, session);

  const payload = {
    purpose: 'support_access_session',
    sessionId: id,
    workspaceId: session.workspaceId,
    supportUserId: session.supportUserId,
    clientEmail: session.clientEmail,
    exp: Math.floor(new Date(session.expiresAt).getTime() / 1000),
  };

  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = signPayload(encodedPayload);
  const token = `${encodedPayload}.${signature}`;

  return { token, session };
}

export const issueSupportSession = createSupportSession;

export function getSupportSessionById(sessionId: string): SupportSessionRecord | null {
  return supportSessionStore.get(sessionId) || null;
}

export function revokeSupportSessionById(sessionId: string): SupportSessionRecord | null {
  const current = supportSessionStore.get(sessionId);
  if (!current) return null;
  const revoked: SupportSessionRecord = {
    ...current,
    revokedAt: new Date().toISOString(),
  };
  supportSessionStore.set(sessionId, revoked);
  return revoked;
}

export function getSupportSessionStoreSnapshot(): Map<string, SupportSessionRecord> {
  return supportSessionStore;
}

export function clearSupportSessionStore(): number {
  const count = supportSessionStore.size;
  supportSessionStore.clear();
  return count;
}
