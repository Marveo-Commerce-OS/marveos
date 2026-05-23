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

        await updateAdminStore((current) => ({
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
          },
        }));

        cookieStore.set('marveo_native_session', nativeSessionToken, opts);
        cookieStore.set('admin_user', JSON.stringify({
          id: nativeIdentityId,
          user_display_name: nativeBootstrap.name,
          user_email: nativeBootstrap.email,
          isAdmin: true,
          roles: ['SUPER_ADMIN'],
          portals: ['b2c', 'b2b'],
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

      await updateAdminStore((current) => ({
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
        },
      }));

      cookieStore.set('admin_token', `demo-token-${Date.now()}`, opts);
      cookieStore.set('marveo_native_session', nativeSessionToken, opts);
      cookieStore.set('admin_user', JSON.stringify({
        id: 1,
        user_display_name: 'Demo Admin',
        user_email: 'demo@marveo.local',
        isAdmin: true,
        roles: ['administrator'],
        portals: ['b2c'],
      }), opts);

      return NextResponse.json({ success: true, redirect: '/master' });
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
      return NextResponse.json({ error: 'Unable to connect to WordPress. Please try again.' }, { status: 503 });
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
    const userState = store.users[String(userData.id)];

    // Role normalization layer:
    // - Marvéo-native masterRole (if assigned) is the platform source of truth.
    // - WordPress roles are treated as compatibility inputs only.
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
    if (requestedSurface === 'portal' && internalAccess) {
      return NextResponse.json({ error: 'Internal team accounts must sign in via /master-login.' }, { status: 403 });
    }
    if (requestedSurface === 'master' && !internalAccess) {
      return NextResponse.json({ error: 'Client accounts must sign in via /login.' }, { status: 403 });
    }
    if (userState && !userState.active) {
      return NextResponse.json({ error: 'Your account has been suspended.' }, { status: 403 });
    }

    const cookieStore = await cookies();
    const opts = { httpOnly: true, secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 7 };

    const nativeIdentityId = userData?.id ? `wp_${String(userData.id)}` : `bridge_${Date.now()}`;
    const nativeSessionId = randomUUID();
    const nativeSessionToken = randomUUID();
    const nowIso = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();

    await updateAdminStore((current) => ({
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
      },
    }));

    cookieStore.set('admin_token', data.token, opts);
    cookieStore.set('marveo_native_session', nativeSessionToken, opts);
    cookieStore.set('admin_user', JSON.stringify({
      id: userData.id,
      user_display_name: data.user_display_name,
      user_email: data.user_email,
      isAdmin: internalAccess,
      roles: Array.isArray(userData.roles) ? userData.roles : [],
      portals: userState?.portals ?? ['b2c'],
    }), opts);

    return NextResponse.json({ success: true, redirect: requestedSurface === 'master' ? '/master' : '/portal' });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred. Please try again.' }, { status: 500 });
  }
}
