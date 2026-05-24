import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { readAdminStore, updateAdminStore, type NativeRole } from '@/lib/adminStore';
import {
  hasClientMasterAccess,
  hasInternalMasterAccess,
  normalizeMarveoRoles,
  normalizeRoles,
} from '@/lib/auth';
import { getConfig } from '@/src/config/client';
import { randomUUID } from 'node:crypto';
import { getPasswordEntry, upsertPasswordEntries, verifyPasswordEntry } from '@/lib/nativePasswords';

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

function resolveForcedPasswordChangeRedirect(surface: 'master' | 'portal') {
  return `/password/change?surface=${surface}&firstLogin=1`;
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

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const username = payload?.username;
    const password = payload?.password;
    const requestedSurface = payload?.loginSurface === 'master' ? 'master' : 'portal';
    const WP_API_URL = getWpApiUrl();

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

    const nativeBootstrap = getNativeSuperadminCredentials();
    if (requestedSurface === 'master' && nativeBootstrap.email && nativeBootstrap.password) {
      const normalizedUsername = String(username).trim().toLowerCase();
      if (normalizedUsername === nativeBootstrap.email && password === nativeBootstrap.password) {
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
            sessions: {
              ...current.nativeAuth.sessions,
              [nativeSessionId]: {
                id: nativeSessionId,
                userId: nativeIdentityId,
                token: nativeSessionToken,
                source: 'NATIVE',
                createdAt: nowIso,
                expiresAt,
              },
            },
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
          sessions: {
            ...current.nativeAuth.sessions,
            [nativeSessionId]: {
              id: nativeSessionId,
              userId: nativeIdentityId,
              token: nativeSessionToken,
              source: 'NATIVE',
              createdAt: nowIso,
              expiresAt,
            },
          },
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
        return NextResponse.json({ error: 'This account does not have internal access.' }, { status: 403 });
      }
      if (userState && !userState.active && !userState.invitePending) {
        return NextResponse.json({ error: 'Your account has been suspended.' }, { status: 403 });
      }

      const passwordEntry = getPasswordEntry(nativeStore.nativeAuth.permissions[identityId]);
      if (!passwordEntry || !verifyPasswordEntry(password, passwordEntry)) {
        return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
      }

      const requiresPasswordChange = Boolean(userState?.invitePending);
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
          sessions: {
            ...current.nativeAuth.sessions,
            [nativeSessionId]: {
              id: nativeSessionId,
              userId: identityId,
              token: nativeSessionToken,
              source: identity.source,
              createdAt: nowIso,
              expiresAt,
            },
          },
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
            sessions: {
              ...current.nativeAuth.sessions,
              [nativeSessionId]: {
                id: nativeSessionId,
                userId: identityId,
                token: nativeSessionToken,
                source: identity.source,
                createdAt: nowIso,
                expiresAt,
              },
            },
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

        return NextResponse.json({
          success: true,
          redirect: requiresPasswordChange ? resolveForcedPasswordChangeRedirect('portal') : '/portal',
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
    const nativeRoles = marveoRoles.filter((role): role is NativeRole => !role.startsWith('CONNECTED_'));

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
        sessions: {
          ...current.nativeAuth.sessions,
          [nativeSessionId]: {
            id: nativeSessionId,
            userId: nativeIdentityId,
            token: nativeSessionToken,
            source: 'WORDPRESS_BRIDGE',
            createdAt: nowIso,
            expiresAt,
          },
        },
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

    return NextResponse.json({ success: true, redirect: '/portal' });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred. Please try again.' }, { status: 500 });
  }
}
