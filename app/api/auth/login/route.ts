import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { readAdminStore, updateAdminStore, type NativePlatformSession } from '@/lib/adminStore';
import {
  hasClientMasterAccess,
  hasInternalMasterAccess,
  normalizeMarveoRoles,
  normalizeRoles,
} from '@/lib/auth';
import { getConfig } from '@/src/config/client';
import { randomUUID } from 'node:crypto';
import { getPasswordEntry, upsertPasswordEntries, verifyPasswordEntry } from '@/lib/nativePasswords';
import { sendPlatformDirectEmail } from '@/lib/emailNotifications';

type LoginAttemptState = {
  count: number;
  firstFailedAt: number;
  lockedUntilMs: number;
};

type LoginOtpChallenge = {
  id: string;
  identifier: string;
  surface: 'master' | 'portal';
  email: string;
  displayName: string;
  otpCode: string;
  expiresAtMs: number;
};

const LOGIN_ATTEMPT_LEDGER = new Map<string, LoginAttemptState>();
const LOGIN_OTP_CHALLENGES = new Map<string, LoginOtpChallenge>();
const LOGIN_OTP_LAST_SENT = new Map<string, number>();
const OTP_RESEND_MIN_INTERVAL_MS = 45 * 1000;

function normalizeClientIp(raw: string): string {
  return raw.split(',')[0]?.trim() || 'unknown';
}

function buildAttemptKey(identifier: string, clientIp: string): string {
  return `${identifier.toLowerCase()}::${clientIp}`;
}

function getAttemptState(key: string): LoginAttemptState | null {
  const state = LOGIN_ATTEMPT_LEDGER.get(key);
  if (!state) return null;
  const now = Date.now();
  if (state.lockedUntilMs > 0 && state.lockedUntilMs <= now) {
    LOGIN_ATTEMPT_LEDGER.delete(key);
    return null;
  }
  return state;
}

function registerFailedAttempt(key: string, maxFailedAttempts: number, windowMinutes: number, lockoutMinutes: number) {
  const now = Date.now();
  const windowMs = windowMinutes * 60 * 1000;
  const lockoutMs = lockoutMinutes * 60 * 1000;
  const existing = getAttemptState(key);

  if (!existing) {
    LOGIN_ATTEMPT_LEDGER.set(key, {
      count: 1,
      firstFailedAt: now,
      lockedUntilMs: 0,
    });
    return;
  }

  const withinWindow = now - existing.firstFailedAt <= windowMs;
  const nextCount = withinWindow ? existing.count + 1 : 1;
  const firstFailedAt = withinWindow ? existing.firstFailedAt : now;
  const lockedUntilMs = nextCount >= maxFailedAttempts ? now + lockoutMs : 0;

  LOGIN_ATTEMPT_LEDGER.set(key, {
    count: nextCount,
    firstFailedAt,
    lockedUntilMs,
  });
}

function clearAttemptState(key: string) {
  LOGIN_ATTEMPT_LEDGER.delete(key);
}

function generateOtpCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function maskEmail(email: string): string {
  const trimmed = email.trim();
  const atIndex = trimmed.indexOf('@');
  if (atIndex <= 1) return '***';
  const local = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex + 1);
  if (!domain) return `${local[0]}***`;
  return `${local[0]}***@${domain}`;
}

async function issueLoginOtpChallenge(params: {
  identifier: string;
  surface: 'master' | 'portal';
  email: string;
  displayName: string;
  ttlMinutes: number;
}) {
  const lastSentAt = LOGIN_OTP_LAST_SENT.get(params.identifier);
  if (lastSentAt && Date.now() - lastSentAt < OTP_RESEND_MIN_INTERVAL_MS) {
    return {
      ok: false as const,
      reason: 'rate-limited' as const,
      retryAfterSeconds: Math.ceil((OTP_RESEND_MIN_INTERVAL_MS - (Date.now() - lastSentAt)) / 1000),
    };
  }

  const challengeId = randomUUID();
  const otpCode = generateOtpCode();
  const expiresAtMs = Date.now() + params.ttlMinutes * 60 * 1000;

  LOGIN_OTP_CHALLENGES.set(challengeId, {
    id: challengeId,
    identifier: params.identifier,
    surface: params.surface,
    email: params.email.trim().toLowerCase(),
    displayName: params.displayName,
    otpCode,
    expiresAtMs,
  });

  const expiryText = new Date(expiresAtMs).toLocaleTimeString();
  const subject = 'Your Marveo login verification code';
  const html = `<p>Hello ${params.displayName || 'there'},</p><p>Your login verification code is:</p><p style="font-size:24px;font-weight:700;letter-spacing:2px;">${otpCode}</p><p>This code expires at ${expiryText}.</p><p>If you did not try to log in, ignore this email.</p>`;
  const text = `Hello ${params.displayName || 'there'}, your Marveo login verification code is ${otpCode}. It expires at ${expiryText}. If this was not you, ignore this email.`;

  const sent = await sendPlatformDirectEmail({
    to: params.email,
    subject,
    html,
    text,
  });

  if (!sent.ok) {
    LOGIN_OTP_CHALLENGES.delete(challengeId);
    return { ok: false as const, reason: 'delivery-failed' as const };
  }

  LOGIN_OTP_LAST_SENT.set(params.identifier, Date.now());

  return {
    ok: true as const,
    challengeId,
    deliveryHint: maskEmail(params.email),
  };
}

function verifyLoginOtpChallenge(params: {
  challengeId: string;
  identifier: string;
  surface: 'master' | 'portal';
  otpCode: string;
}) {
  const challenge = LOGIN_OTP_CHALLENGES.get(params.challengeId);
  if (!challenge) return { ok: false as const, reason: 'not-found' as const };
  if (challenge.expiresAtMs <= Date.now()) {
    LOGIN_OTP_CHALLENGES.delete(params.challengeId);
    return { ok: false as const, reason: 'expired' as const };
  }
  if (challenge.surface !== params.surface || challenge.identifier !== params.identifier) {
    return { ok: false as const, reason: 'invalid-context' as const };
  }
  if (challenge.otpCode !== params.otpCode.trim()) {
    return { ok: false as const, reason: 'invalid-code' as const };
  }

  LOGIN_OTP_CHALLENGES.delete(params.challengeId);
  return { ok: true as const };
}

const getWpApiUrl = () => {
  const config = getConfig();
  return config.wordpressApiUrl || 'https://localhost/wp-json';
};

const isDemoAuthEnabled = () =>
  process.env.NODE_ENV !== 'production' &&
  (process.env.MARVEO_DEMO_MODE === 'true' || process.env.NEXT_PUBLIC_MARVEO_DEMO_MODE === 'true');

const getDemoCredentials = () => ({
  username: process.env.MARVEO_DEMO_USERNAME || 'demo-admin',
  password: process.env.MARVEO_DEMO_PASSWORD || 'demo-pass-2026',
});

const getNativeSuperadminCredentials = () => ({
  email: (process.env.MARVEO_SUPERADMIN_EMAIL || '').trim().toLowerCase(),
  password: process.env.MARVEO_SUPERADMIN_PASSWORD || '',
  name: (process.env.MARVEO_SUPERADMIN_NAME || 'Platform Owner').trim(),
});

function hasConfiguredMasterPassword(store: Awaited<ReturnType<typeof readAdminStore>>) {
  return Object.entries(store.nativeAuth.identities).some(([identityId, identity]) => {
    const state = store.users[identityId];
    const marveoRoles = normalizeMarveoRoles([
      ...identity.roles,
      ...(state?.masterRole ? [state.masterRole] : []),
    ]);
    return hasInternalMasterAccess(marveoRoles) && Boolean(getPasswordEntry(store.nativeAuth.permissions[identityId]));
  });
}

function resolveForcedPasswordChangeRedirect(surface: 'master' | 'portal', nextPath?: string) {
  const base = `/password/change?surface=${surface}&firstLogin=1`;
  if (!nextPath) return base;
  return `${base}&next=${encodeURIComponent(nextPath)}`;
}

function resolvePortalPostLoginRedirect(params: {
  assignedWorkspaceId?: string;
  welcomeName?: string;
  includeWelcome?: boolean;
}) {
  const search = new URLSearchParams();
  if (params.assignedWorkspaceId) {
    search.set('workspaceId', params.assignedWorkspaceId);
  }
  if (params.includeWelcome) {
    search.set('welcome', '1');
    if (params.welcomeName) {
      search.set('name', params.welcomeName);
    }
  }
  const query = search.toString();
  return `/portal${query ? `?${query}` : ''}`;
}

const isPortalWordPressBridgeEnabled = () => process.env.MARVEO_ENABLE_PORTAL_WORDPRESS_BRIDGE === 'true';

const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeoutMs = 10000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

function upsertSessionForIdentity(
  sessions: Record<string, NativePlatformSession>,
  identityId: string,
  session: NativePlatformSession,
  enforceSingleSession: boolean,
): Record<string, NativePlatformSession> {
  const base = enforceSingleSession
    ? Object.fromEntries(Object.entries(sessions).filter(([, existing]) => existing.userId !== identityId))
    : sessions;

  return {
    ...base,
    [session.id]: session,
  };
}

export async function POST(req: NextRequest) {
  let loginSucceeded = false;
  let trackFailures = false;
  let suppressFailureTracking = false;
  let loginAttemptKey = '';
  let loginProtection = {
    enabled: true,
    maxFailedAttempts: 5,
    windowMinutes: 10,
    lockoutMinutes: 15,
    requireOtpChallenge: true,
    otpCodeTtlMinutes: 10,
  };

  try {
    const payload = await req.json();
    const username = payload?.username;
    const password = payload?.password;
    const requestedSurface = payload?.loginSurface === 'master' ? 'master' : 'portal';
    const otpChallengeId = String(payload?.otpChallengeId || '').trim();
    const otpCode = String(payload?.otpCode || '').trim();
    const WP_API_URL = getWpApiUrl();
    let otpVerified = false;

    const persistNativeSession = async (mutate: Parameters<typeof updateAdminStore>[0]) => {
      try {
        await updateAdminStore(mutate);
        return true;
      } catch (error) {
        console.error('Native auth persistence failed; falling back to cookie-backed auth:', error);
        return false;
      }
    };

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
    }

    const loginIdentifier = String(username).trim().toLowerCase();
    const clientIp = normalizeClientIp(req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown');
    loginAttemptKey = buildAttemptKey(loginIdentifier, clientIp);
    trackFailures = true;

    const securityStore = await readAdminStore();
    loginProtection = {
      ...loginProtection,
      ...(securityStore.platformSettings.loginProtection ?? {}),
    };

    if (loginProtection.enabled) {
      const attemptState = getAttemptState(loginAttemptKey);
      if (attemptState?.lockedUntilMs && attemptState.lockedUntilMs > Date.now()) {
        const retryAfterSeconds = Math.max(1, Math.ceil((attemptState.lockedUntilMs - Date.now()) / 1000));
        return NextResponse.json(
          {
            error: `Too many failed login attempts. Try again in ${retryAfterSeconds} seconds.`,
            retryAfterSeconds,
          },
          { status: 429 },
        );
      }
    }

    if (loginProtection.enabled && loginProtection.requireOtpChallenge && otpChallengeId) {
      if (!otpCode) {
        return NextResponse.json({ error: 'OTP code is required.' }, { status: 400 });
      }
      const otpCheck = verifyLoginOtpChallenge({
        challengeId: otpChallengeId,
        identifier: loginIdentifier,
        surface: requestedSurface,
        otpCode,
      });
      if (!otpCheck.ok) {
        return NextResponse.json({ error: 'Invalid or expired verification code.' }, { status: 401 });
      }
      otpVerified = true;
    }

    const nativeBootstrap = getNativeSuperadminCredentials();
    if (requestedSurface === 'master' && nativeBootstrap.email && nativeBootstrap.password) {
      const normalizedUsername = String(username).trim().toLowerCase();
      if (normalizedUsername === nativeBootstrap.email && password === nativeBootstrap.password) {
        if (loginProtection.enabled && loginProtection.requireOtpChallenge && !otpVerified) {
          const challenge = await issueLoginOtpChallenge({
            identifier: loginIdentifier,
            surface: requestedSurface,
            email: nativeBootstrap.email,
            displayName: nativeBootstrap.name,
            ttlMinutes: loginProtection.otpCodeTtlMinutes,
          });
          if (!challenge.ok) {
            return NextResponse.json({ error: 'Could not send verification code. Please try again.' }, { status: 503 });
          }
          suppressFailureTracking = true;
          return NextResponse.json({
            otpRequired: true,
            otpChallengeId: challenge.challengeId,
            otpDeliveryHint: challenge.deliveryHint,
            message: 'Verification code sent. Enter it to continue.',
          });
        }

        const cookieStore = await cookies();
        const opts = { httpOnly: true, secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 7 };
        const nativeSessionToken = randomUUID();
        const nativeIdentityId = 'native_owner_superadmin';
        const nativeSessionId = `session_${Date.now()}`;
        const nowIso = new Date().toISOString();
        const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();

        const persistedNative = await persistNativeSession((current) => ({
          ...current,
          users: {
            ...current.users,
            [nativeIdentityId]: {
              active: true,
              portals: ['b2c', 'b2b'],
              masterRole: 'SUPER_ADMIN',
              rawAuthRole: 'native_superadmin',
              status: 'ACTIVE',
              invitePending: false,
            },
          },
          nativeAuth: {
            ...current.nativeAuth,
            identities: {
              ...current.nativeAuth.identities,
              [nativeIdentityId]: {
                id: nativeIdentityId,
                email: nativeBootstrap.email,
                name: nativeBootstrap.name,
                userType: 'INTERNAL_USER',
                status: 'ACTIVE',
                roles: ['SUPER_ADMIN'],
                source: 'NATIVE',
                createdAt: current.nativeAuth.identities[nativeIdentityId]?.createdAt ?? nowIso,
                updatedAt: nowIso,
              },
            },
            sessions: upsertSessionForIdentity(
              current.nativeAuth.sessions,
              nativeIdentityId,
              {
                id: nativeSessionId,
                userId: nativeIdentityId,
                token: nativeSessionToken,
                source: 'NATIVE',
                createdAt: nowIso,
                expiresAt,
              },
              current.platformSettings.sessionSecurity.enforceSingleSession,
            ),
            permissions: {
              ...current.nativeAuth.permissions,
              [nativeIdentityId]: upsertPasswordEntries(current.nativeAuth.permissions[nativeIdentityId], password),
            },
          },
        }));

        cookieStore.set('admin_token', `native-superadmin-${Date.now()}`, opts);
        if (persistedNative) {
          cookieStore.set('marveo_native_session', nativeSessionToken, opts);
        }
        cookieStore.set('admin_user', JSON.stringify({
          id: nativeIdentityId,
          user_display_name: nativeBootstrap.name,
          user_email: nativeBootstrap.email,
          isAdmin: true,
          roles: ['SUPER_ADMIN'],
          portals: ['b2c', 'b2b'],
          requirePasswordChange: false,
        }), opts);

        loginSucceeded = true;
        clearAttemptState(loginAttemptKey);
        return NextResponse.json({ success: true, redirect: '/master' });
      }
    }

    if (isDemoAuthEnabled()) {
      const demo = getDemoCredentials();
      if (username !== demo.username || password !== demo.password) {
        return NextResponse.json({ error: 'Invalid demo credentials' }, { status: 401 });
      }
      if (requestedSurface !== 'master') {
        return NextResponse.json({ error: 'Internal team access is only available on /master-login.' }, { status: 403 });
      }

      if (loginProtection.enabled && loginProtection.requireOtpChallenge && !otpVerified) {
        const challenge = await issueLoginOtpChallenge({
          identifier: loginIdentifier,
          surface: requestedSurface,
          email: 'demo@marveo.local',
          displayName: 'Demo Admin',
          ttlMinutes: loginProtection.otpCodeTtlMinutes,
        });
        if (!challenge.ok) {
          return NextResponse.json({ error: 'Could not send verification code. Please try again.' }, { status: 503 });
        }
        suppressFailureTracking = true;
        return NextResponse.json({
          otpRequired: true,
          otpChallengeId: challenge.challengeId,
          otpDeliveryHint: challenge.deliveryHint,
          message: 'Verification code sent. Enter it to continue.',
        });
      }

      const cookieStore = await cookies();
      const opts = { httpOnly: true, secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 7 };
      const nativeSessionToken = randomUUID();
      const nativeIdentityId = 'native_demo_admin';
      const nativeSessionId = `session_${Date.now()}`;
      const nowIso = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();

      const persistedNative = await persistNativeSession((current) => ({
        ...current,
        nativeAuth: {
          ...current.nativeAuth,
          identities: {
            ...current.nativeAuth.identities,
            [nativeIdentityId]: {
              id: nativeIdentityId,
              email: 'demo@marveo.local',
              name: 'Demo Admin',
              userType: 'INTERNAL_USER',
              status: 'ACTIVE',
              roles: ['SUPER_ADMIN'],
              source: 'NATIVE',
              createdAt: current.nativeAuth.identities[nativeIdentityId]?.createdAt ?? nowIso,
              updatedAt: nowIso,
            },
          },
          sessions: upsertSessionForIdentity(
            current.nativeAuth.sessions,
            nativeIdentityId,
            {
              id: nativeSessionId,
              userId: nativeIdentityId,
              token: nativeSessionToken,
              source: 'NATIVE',
              createdAt: nowIso,
              expiresAt,
            },
            current.platformSettings.sessionSecurity.enforceSingleSession,
          ),
          permissions: {
            ...current.nativeAuth.permissions,
            [nativeIdentityId]: upsertPasswordEntries(current.nativeAuth.permissions[nativeIdentityId], password),
          },
        },
      }));

      cookieStore.set('admin_token', `demo-token-${Date.now()}`, opts);
      if (persistedNative) {
        cookieStore.set('marveo_native_session', nativeSessionToken, opts);
      }
      cookieStore.set('admin_user', JSON.stringify({
        id: 1,
        user_display_name: 'Demo Admin',
        user_email: 'demo@marveo.local',
        isAdmin: true,
        roles: ['administrator'],
        portals: ['b2c'],
        requirePasswordChange: false,
      }), opts);

      loginSucceeded = true;
      clearAttemptState(loginAttemptKey);
      return NextResponse.json({ success: true, redirect: '/master' });
    }

    if (requestedSurface === 'master') {
      const normalized = String(username).trim().toLowerCase();
      const nativeStore = await readAdminStore();
      if (!(nativeBootstrap.email && nativeBootstrap.password) && !hasConfiguredMasterPassword(nativeStore)) {
        return NextResponse.json(
          {
            error: 'Master access is not configured yet. Set MARVEO_SUPERADMIN_EMAIL and MARVEO_SUPERADMIN_PASSWORD, or create an internal user with a password.',
          },
          { status: 503 },
        );
      }

      const entry = Object.entries(nativeStore.nativeAuth.identities).find(([, identity]) =>
        identity.email.toLowerCase() === normalized,
      );
      if (!entry) {
        return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
      }

      const [identityId, identity] = entry;
      const userState = nativeStore.users[identityId];
      const marveoRoles = normalizeMarveoRoles([
        ...identity.roles,
        ...(userState?.masterRole ? [userState.masterRole] : []),
      ]);
      const internalAccess = hasInternalMasterAccess(marveoRoles);
      if (!internalAccess) {
        return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
      }
      if (userState && !userState.active && !userState.invitePending) {
        return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
      }

      const passwordEntry = getPasswordEntry(nativeStore.nativeAuth.permissions[identityId]);
      if (!passwordEntry || !verifyPasswordEntry(password, passwordEntry)) {
        return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
      }

      const requiresPasswordChange = Boolean(userState?.invitePending);

      if (loginProtection.enabled && loginProtection.requireOtpChallenge && !otpVerified) {
        const challenge = await issueLoginOtpChallenge({
          identifier: loginIdentifier,
          surface: requestedSurface,
          email: identity.email,
          displayName: identity.name,
          ttlMinutes: loginProtection.otpCodeTtlMinutes,
        });
        if (!challenge.ok) {
          return NextResponse.json({ error: 'Could not send verification code. Please try again.' }, { status: 503 });
        }
        suppressFailureTracking = true;
        return NextResponse.json({
          otpRequired: true,
          otpChallengeId: challenge.challengeId,
          otpDeliveryHint: challenge.deliveryHint,
          message: 'Verification code sent. Enter it to continue.',
        });
      }

      const cookieStore = await cookies();
      const opts = { httpOnly: true, secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 7 };
      const nativeSessionId = randomUUID();
      const nativeSessionToken = randomUUID();
      const nowIso = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();

      const persistedNative = await persistNativeSession((current) => ({
        ...current,
        users: {
          ...current.users,
          [identityId]: {
            ...(current.users[identityId] ?? { active: true, portals: [] }),
            active: true,
            status: current.users[identityId]?.invitePending ? 'INVITED' : 'ACTIVE',
            invitePending: current.users[identityId]?.invitePending ?? false,
          },
        },
        nativeAuth: {
          ...current.nativeAuth,
          identities: {
            ...current.nativeAuth.identities,
            [identityId]: {
              ...current.nativeAuth.identities[identityId],
              status: current.users[identityId]?.invitePending ? 'INVITED' : 'ACTIVE',
              updatedAt: nowIso,
            },
          },
          sessions: upsertSessionForIdentity(
            current.nativeAuth.sessions,
            identityId,
            {
              id: nativeSessionId,
              userId: identityId,
              token: nativeSessionToken,
              source: identity.source,
              createdAt: nowIso,
              expiresAt,
            },
            current.platformSettings.sessionSecurity.enforceSingleSession,
          ),
        },
      }));

      cookieStore.set('admin_token', `native-master-${Date.now()}`, opts);
      if (persistedNative) {
        cookieStore.set('marveo_native_session', nativeSessionToken, opts);
      }
      cookieStore.set('admin_user', JSON.stringify({
        id: identity.id,
        user_display_name: identity.name,
        user_email: identity.email,
        isAdmin: true,
        roles: marveoRoles,
        portals: userState?.portals ?? ['b2c'],
        requirePasswordChange: requiresPasswordChange,
      }), opts);

      loginSucceeded = true;
      clearAttemptState(loginAttemptKey);
      return NextResponse.json({
        success: true,
        redirect: requiresPasswordChange ? resolveForcedPasswordChangeRedirect('master') : '/master',
      });
    }

    // Native-first portal auth: validate against imported/native identities first.
    const normalizedPortalLogin = String(username).trim().toLowerCase();
    const nativeStore = await readAdminStore();
    const portalIdentityEntry = Object.entries(nativeStore.nativeAuth.identities).find(([, identity]) => {
      return ['ACTIVE', 'INVITED'].includes(identity.status) && identity.email.toLowerCase() === normalizedPortalLogin;
    });

    if (portalIdentityEntry) {
      const [identityId, identity] = portalIdentityEntry;
      const userState = nativeStore.users[identityId];
      const marveoRoles = normalizeMarveoRoles([
        ...identity.roles,
        ...(userState?.masterRole ? [userState.masterRole] : []),
      ]);
      const internalAccess = hasInternalMasterAccess(marveoRoles);
      const clientAccess = hasClientMasterAccess(marveoRoles);

      if (internalAccess) {
        return NextResponse.json({ error: 'Internal team accounts must sign in via /master-login.' }, { status: 403 });
      }
      if (!clientAccess) {
        return NextResponse.json({ error: 'Your account does not have portal access.' }, { status: 403 });
      }
      if (userState && !userState.active && !userState.invitePending) {
        return NextResponse.json({ error: 'Your account has been suspended.' }, { status: 403 });
      }

      const passwordEntry = getPasswordEntry(nativeStore.nativeAuth.permissions[identityId]);
      if (passwordEntry && verifyPasswordEntry(password, passwordEntry)) {
        const requiresPasswordChange = Boolean(userState?.invitePending);
        const portalPostLoginRedirect = resolvePortalPostLoginRedirect({
          assignedWorkspaceId: userState?.assignedWorkspaceId,
          includeWelcome: false,
        });
        const portalPostFirstLoginRedirect = resolvePortalPostLoginRedirect({
          assignedWorkspaceId: userState?.assignedWorkspaceId,
          includeWelcome: true,
          welcomeName: identity.name,
        });

        if (loginProtection.enabled && loginProtection.requireOtpChallenge && !otpVerified) {
          const challenge = await issueLoginOtpChallenge({
            identifier: loginIdentifier,
            surface: requestedSurface,
            email: identity.email,
            displayName: identity.name,
            ttlMinutes: loginProtection.otpCodeTtlMinutes,
          });
          if (!challenge.ok) {
            return NextResponse.json({ error: 'Could not send verification code. Please try again.' }, { status: 503 });
          }
          suppressFailureTracking = true;
          return NextResponse.json({
            otpRequired: true,
            otpChallengeId: challenge.challengeId,
            otpDeliveryHint: challenge.deliveryHint,
            message: 'Verification code sent. Enter it to continue.',
          });
        }

        const cookieStore = await cookies();
        const opts = { httpOnly: true, secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 7 };
        const nativeSessionId = randomUUID();
        const nativeSessionToken = randomUUID();
        const nowIso = new Date().toISOString();
        const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();

        const persistedNative = await persistNativeSession((current) => ({
          ...current,
          users: {
            ...current.users,
            [identityId]: {
              ...(current.users[identityId] ?? { active: true, portals: [] }),
              active: true,
              status: current.users[identityId]?.invitePending ? 'INVITED' : 'ACTIVE',
              invitePending: current.users[identityId]?.invitePending ?? false,
            },
          },
          nativeAuth: {
            ...current.nativeAuth,
            identities: {
              ...current.nativeAuth.identities,
              [identityId]: {
                ...current.nativeAuth.identities[identityId],
                status: current.users[identityId]?.invitePending ? 'INVITED' : 'ACTIVE',
                updatedAt: nowIso,
              },
            },
            sessions: upsertSessionForIdentity(
              current.nativeAuth.sessions,
              identityId,
              {
                id: nativeSessionId,
                userId: identityId,
                token: nativeSessionToken,
                source: identity.source,
                createdAt: nowIso,
                expiresAt,
              },
              current.platformSettings.sessionSecurity.enforceSingleSession,
            ),
          },
        }));

        cookieStore.set('admin_token', `native-portal-${Date.now()}`, opts);
        if (persistedNative) {
          cookieStore.set('marveo_native_session', nativeSessionToken, opts);
        }
        cookieStore.set('admin_user', JSON.stringify({
          id: identity.id,
          user_display_name: identity.name,
          user_email: identity.email,
          isAdmin: false,
          roles: marveoRoles,
          portals: userState?.portals ?? ['b2c'],
          requirePasswordChange: requiresPasswordChange,
        }), opts);

        loginSucceeded = true;
        clearAttemptState(loginAttemptKey);
        return NextResponse.json({
          success: true,
          redirect: requiresPasswordChange
            ? resolveForcedPasswordChangeRedirect('portal', portalPostFirstLoginRedirect)
            : portalPostLoginRedirect,
        });
      }

      if (!isPortalWordPressBridgeEnabled()) {
        return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
      }
    } else if (!isPortalWordPressBridgeEnabled()) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
    }

    let wpRes;
    try {
      wpRes = await fetchWithTimeout(`${WP_API_URL}/jwt-auth/v1/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
    } catch (error) {
      console.error('WordPress API error:', error);
      return NextResponse.json({ error: 'Authentication service is currently unavailable. Please try again.' }, { status: 503 });
    }

    if (!wpRes.ok) {
      const errData = await wpRes.json().catch(() => ({}));
      return NextResponse.json({ error: errData.message || 'Invalid username or password' }, { status: 401 });
    }

    const data = await wpRes.json();

    let userRes;
    try {
      userRes = await fetchWithTimeout(`${WP_API_URL}/wp/v2/users/me?context=edit`, {
        headers: { Authorization: `Bearer ${data.token}` },
      });
    } catch (error) {
      console.error('User verification error:', error);
      return NextResponse.json({ error: 'Failed to verify user. Please try again.' }, { status: 503 });
    }

    if (!userRes.ok) {
      return NextResponse.json({ error: 'Failed to verify user permissions.' }, { status: 403 });
    }

    const userData = await userRes.json();
    const roles = normalizeRoles(userData?.roles);

    const store = await readAdminStore();
    const nativeIdentityId = userData?.id ? `wp_${String(userData.id)}` : `bridge_${Date.now()}`;
    const userState = store.users[nativeIdentityId] ?? store.users[String(userData.id)];

    const marveoRoles = normalizeMarveoRoles([
      ...roles,
      ...(userState?.masterRole ? [userState.masterRole] : []),
    ]);
    const nativeRoles = marveoRoles.filter((role) => !role.startsWith('CONNECTED_'));

    const internalAccess = hasInternalMasterAccess(marveoRoles);
    const clientAccess = hasClientMasterAccess(marveoRoles);

    if (!internalAccess && !clientAccess) {
      return NextResponse.json({ error: 'Your account does not have access to Marveo platform surfaces.' }, { status: 403 });
    }
    if (internalAccess) {
      return NextResponse.json({ error: 'Internal team accounts must sign in via /master-login.' }, { status: 403 });
    }
    if (userState && !userState.active) {
      return NextResponse.json({ error: 'Your account has been suspended.' }, { status: 403 });
    }

    if (loginProtection.enabled && loginProtection.requireOtpChallenge && !otpVerified) {
      const challenge = await issueLoginOtpChallenge({
        identifier: loginIdentifier,
        surface: requestedSurface,
        email: String(data.user_email || '').trim(),
        displayName: String(data.user_display_name || username || 'User'),
        ttlMinutes: loginProtection.otpCodeTtlMinutes,
      });
      if (!challenge.ok) {
        return NextResponse.json({ error: 'Could not send verification code. Please try again.' }, { status: 503 });
      }
      suppressFailureTracking = true;
      return NextResponse.json({
        otpRequired: true,
        otpChallengeId: challenge.challengeId,
        otpDeliveryHint: challenge.deliveryHint,
        message: 'Verification code sent. Enter it to continue.',
      });
    }

    const cookieStore = await cookies();
    const opts = { httpOnly: true, secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 7 };

    const nativeSessionId = randomUUID();
    const nativeSessionToken = randomUUID();
    const nowIso = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();

    const persistedNative = await persistNativeSession((current) => ({
      ...current,
      nativeAuth: {
        ...current.nativeAuth,
        identities: {
          ...current.nativeAuth.identities,
          [nativeIdentityId]: {
            id: nativeIdentityId,
            email: data.user_email || `${username}@unknown.local`,
            name: data.user_display_name || username,
            userType: internalAccess ? 'INTERNAL_USER' : 'CLIENT_USER',
            status: 'ACTIVE',
            roles: nativeRoles,
            source: 'WORDPRESS_BRIDGE',
            wordpressUserId: typeof userData?.id === 'number' ? userData.id : undefined,
            createdAt: current.nativeAuth.identities[nativeIdentityId]?.createdAt ?? nowIso,
            updatedAt: nowIso,
          },
        },
        sessions: upsertSessionForIdentity(
          current.nativeAuth.sessions,
          nativeIdentityId,
          {
            id: nativeSessionId,
            userId: nativeIdentityId,
            token: nativeSessionToken,
            source: 'WORDPRESS_BRIDGE',
            createdAt: nowIso,
            expiresAt,
          },
          current.platformSettings.sessionSecurity.enforceSingleSession,
        ),
        permissions: {
          ...current.nativeAuth.permissions,
          [nativeIdentityId]: upsertPasswordEntries(current.nativeAuth.permissions[nativeIdentityId], password),
        },
      },
    }));

    cookieStore.set('admin_token', data.token, opts);
    if (persistedNative) {
      cookieStore.set('marveo_native_session', nativeSessionToken, opts);
    }
    cookieStore.set('admin_user', JSON.stringify({
      id: userData.id,
      user_display_name: data.user_display_name,
      user_email: data.user_email,
      isAdmin: internalAccess,
      roles: Array.isArray(userData.roles) ? userData.roles : [],
      portals: userState?.portals ?? ['b2c'],
      requirePasswordChange: false,
    }), opts);

    loginSucceeded = true;
    clearAttemptState(loginAttemptKey);
    return NextResponse.json({ success: true, redirect: '/portal' });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred. Please try again.' }, { status: 500 });
  } finally {
    if (trackFailures && !suppressFailureTracking && loginAttemptKey && loginProtection.enabled && !loginSucceeded) {
      registerFailedAttempt(
        loginAttemptKey,
        loginProtection.maxFailedAttempts,
        loginProtection.windowMinutes,
        loginProtection.lockoutMinutes,
      );
    }
  }
}
