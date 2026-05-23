import { readAdminStore, updateAdminStore, appendAuditLog, type ManagedUserState, type NativePlatformSession } from './adminStore';
import { randomUUID } from 'crypto';

export interface MarveoSession {
  id: string;
  userId: string;
  token: string;
  source: 'NATIVE' | 'WORDPRESS_BRIDGE';
  createdAt: string;
  expiresAt: string;
}

const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

// Create a new session for a user
export async function createSession(userId: string): Promise<MarveoSession> {
  const now = new Date();
  const id = randomUUID();
  const token = randomUUID();
  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS).toISOString();

  const newSession: MarveoSession = {
    id,
    userId,
    token,
    source: 'NATIVE',
    createdAt,
    expiresAt,
  };

  await updateAdminStore((current) => {
    return {
      ...current,
      nativeAuth: {
        ...current.nativeAuth,
        sessions: {
          ...current.nativeAuth.sessions,
          [id]: newSession,
        },
      },
    };
  });

  return newSession;
}

function isSessionExpired(session: NativePlatformSession): boolean {
  return new Date(session.expiresAt) < new Date();
}

// Validate a session token
export async function validateSessionToken(token: string): Promise<MarveoSession | null> {
  const store = await readAdminStore();
  const sessions = store.nativeAuth.sessions ?? {};
  const values = Object.values(sessions);
  const found = values.find((session) => session.token === token);
  if (!found) return null;

  if (isSessionExpired(found)) return null;

  return {
    id: found.id,
    userId: found.userId,
    token: found.token,
    source: found.source,
    createdAt: found.createdAt,
    expiresAt: found.expiresAt,
  };
}

// Get user state for given userId
export async function getUserState(userId: string): Promise<ManagedUserState | null> {
  if (!userId) return null;
  const store = await readAdminStore();
  const state = store.users[userId];
  return state || null;
}

// Authenticate user by username/password (native version)
// Currently a placeholder: real password hashing and user database needed
export async function authenticateUser(username: string, password: string): Promise<string | null> {
  // TODO: Implement real password checks
  // For now, this only validates that a matching active platform user exists.
  void password;
  const store = await readAdminStore();
  const match = Object.entries(store.nativeAuth.identities).find(([, identity]) => {
    if (identity.status !== 'ACTIVE') return false;
    return identity.email.toLowerCase() === username.toLowerCase();
  });
  if (!match) return null;

  const [userId] = match;

  // Issue session token
  const session = await createSession(userId);
  return session.token;
}

// Logout session token
export async function logoutSession(token: string): Promise<boolean> {
  let removed = false;
  await updateAdminStore((current) => {
    const sessions = { ...current.nativeAuth.sessions };
    const sessionId = Object.keys(sessions).find((key) => sessions[key]?.token === token);
    if (sessionId) {
      delete sessions[sessionId];
      removed = true;
    }
    return {
      ...current,
      nativeAuth: {
        ...current.nativeAuth,
        sessions,
      },
    };
  });
  return removed;
}

// Clean expired sessions
export async function cleanExpiredSessions(): Promise<number> {
  let removedCount = 0;
  await updateAdminStore((current) => {
    const sessions = { ...current.nativeAuth.sessions };
    for (const [id, session] of Object.entries(sessions)) {
      if (isSessionExpired(session)) {
        delete sessions[id];
        removedCount++;
      }
    }
    return {
      ...current,
      nativeAuth: {
        ...current.nativeAuth,
        sessions,
      },
    };
  });
  return removedCount;
}

// Middleware-like session verification for API routes
export async function requireValidSession(token: string): Promise<{ ok: boolean; userState?: ManagedUserState; error?: string }> {
  if (!token) return { ok: false, error: 'Missing token' };

  const session = await validateSessionToken(token);
  if (!session) return { ok: false, error: 'Invalid or expired session' };

  const userState = await getUserState(session.userId);
  if (!userState || !userState.active) return { ok: false, error: 'Inactive user' };

  return { ok: true, userState };
}

// Audit log helper
export async function auditAction(actorEmail: string, action: string, target: string, details?: string) {
  await appendAuditLog({ actorEmail, action, target, details });
}
