import { cookies } from 'next/headers';
import { readAdminStore, type ManagedUserState } from './adminStore';
import { getConfig } from '@/src/config/client';

interface AuthUser {
  id?: string | number;
  ID?: string | number;
  user_email?: string;
  email?: string;
  user_display_name?: string;
  roles?: string[];
  requirePasswordChange?: boolean;
  [key: string]: unknown;
}

interface AuthSession {
  token: string;
  user: AuthUser | null;
  authSource: 'native' | 'wordpress_bridge';
}

export const INTERNAL_PLATFORM_ROLES = ['administrator', 'shop_manager'] as const;
export const CLIENT_PLATFORM_ROLES = ['customer', 'subscriber'] as const;

export const MARVEO_INTERNAL_ROLES = [
  'SUPER_ADMIN',
  'ADMIN',
  'CUSTOMER_SUPPORT',
  'TECHNICAL_SUPPORT',
  'DEPLOYMENT_MANAGER',
  'BILLING_MANAGER',
] as const;

export const MARVEO_CLIENT_ROLES = [
  'CLIENT_OWNER',
  'CLIENT_STAFF',
] as const;

export const MARVEO_CONNECTOR_COMPATIBILITY_ROLES = [
  'CONNECTED_WORDPRESS_ADMIN',
  'CONNECTED_WOOCOMMERCE_MANAGER',
] as const;

export type MarveoRole =
  | (typeof MARVEO_INTERNAL_ROLES)[number]
  | (typeof MARVEO_CLIENT_ROLES)[number]
  | (typeof MARVEO_CONNECTOR_COMPATIBILITY_ROLES)[number];

const MARVEO_ROLE_SET = new Set<string>([
  ...MARVEO_INTERNAL_ROLES,
  ...MARVEO_CLIENT_ROLES,
  ...MARVEO_CONNECTOR_COMPATIBILITY_ROLES,
]);

const WP_ROLE_TO_MARVEO_ROLE: Record<string, MarveoRole[]> = {
  administrator: [
    'SUPER_ADMIN',
    'ADMIN',
    'BILLING_MANAGER',
    'CONNECTED_WORDPRESS_ADMIN',
  ],
  shop_manager: [
    'ADMIN',
    'BILLING_MANAGER',
    'CONNECTED_WOOCOMMERCE_MANAGER',
  ],
  editor: ['CLIENT_STAFF'],
  author: ['CLIENT_STAFF'],
  contributor: ['CLIENT_STAFF'],
  subscriber: ['CLIENT_OWNER'],
  customer: ['CLIENT_OWNER'],
};

function getWpApiUrl(): string {
  const config = getConfig();
  return config.wordpressApiUrl || 'https://localhost/wp-json';
}

export function normalizeRoles(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((role) => String(role).toLowerCase());
}

export function normalizeMarveoRoles(value: unknown): MarveoRole[] {
  if (!Array.isArray(value)) return [];

  const resolved = new Set<MarveoRole>();
  for (const role of value) {
    const raw = String(role || '').trim();
    if (!raw) continue;

    const upper = raw.toUpperCase();
    if (upper === 'SUPPORT_OFFICER') {
      resolved.add('CUSTOMER_SUPPORT');
      continue;
    }
    if (MARVEO_ROLE_SET.has(upper)) {
      resolved.add(upper as MarveoRole);
      continue;
    }

    const lower = raw.toLowerCase();
    const mapped = WP_ROLE_TO_MARVEO_ROLE[lower] || [];
    for (const next of mapped) {
      resolved.add(next);
    }
  }

  return Array.from(resolved);
}

export function hasInternalMasterAccess(roles: MarveoRole[]): boolean {
  return roles.some((role) => MARVEO_INTERNAL_ROLES.includes(role as (typeof MARVEO_INTERNAL_ROLES)[number]));
}

export function hasClientMasterAccess(roles: MarveoRole[]): boolean {
  return roles.some((role) => MARVEO_CLIENT_ROLES.includes(role as (typeof MARVEO_CLIENT_ROLES)[number]));
}

export async function resolveManagedUserState(userId: unknown): Promise<ManagedUserState | null> {
  const rawId = String(userId ?? '').trim();
  if (!rawId) return null;
  const store = await readAdminStore();
  if (store.users[rawId]) return store.users[rawId] ?? null;

  const numericId = Number(rawId);
  if (Number.isFinite(numericId) && numericId > 0) {
    return store.users[String(numericId)] ?? null;
  }

  return null;
}

export async function resolveSessionMarveoRoles(sessionUser: unknown): Promise<{
  rawRoles: string[];
  rawPrimaryRole: string | null;
  masterRole: MarveoRole | null;
  marveoRoles: MarveoRole[];
  userState: ManagedUserState | null;
}> {
  const userObj = sessionUser && typeof sessionUser === 'object' ? (sessionUser as Record<string, unknown>) : null;
  const rawRoles = Array.isArray(userObj?.roles) ? userObj.roles.map((role) => String(role)) : [];
  const rawPrimaryRole = rawRoles[0] ? String(rawRoles[0]) : null;
  const userId = userObj?.id ?? userObj?.ID;
  const userState = await resolveManagedUserState(userId);
  const masterRole = userState?.masterRole
    ? (normalizeMarveoRoles([userState.masterRole])[0] ?? null)
    : null;

  const merged = [...rawRoles, ...(masterRole ? [masterRole] : [])];
  const marveoRoles = normalizeMarveoRoles(merged);

  return {
    rawRoles,
    rawPrimaryRole,
    masterRole,
    marveoRoles,
    userState,
  };
}

export function hasInternalPlatformAccess(roles: string[]): boolean {
  return hasInternalMasterAccess(normalizeMarveoRoles(roles));
}

export function hasClientWorkspaceAccess(roles: string[]): boolean {
  return hasClientMasterAccess(normalizeMarveoRoles(roles));
}

async function getCookieUserInfo(): Promise<Record<string, unknown> | null> {
  try {
    const cookieStore = await cookies();
    const userInfoStr = cookieStore.get('admin_user')?.value;
    if (!userInfoStr) return null;
    const parsed = JSON.parse(userInfoStr);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

async function resolveNativeSessionByToken(token: string) {
  if (!token) return null;
  const store = await readAdminStore();
  const nativeSession = Object.values(store.nativeAuth.sessions).find((session) => session.token === token);
  if (!nativeSession) return null;
  if (new Date(nativeSession.expiresAt) < new Date()) return null;
  const identity = store.nativeAuth.identities[nativeSession.userId] ?? null;
  const userState = store.users[nativeSession.userId] ?? null;
  return { nativeSession, identity, userState };
}

export async function login(username: string, password: string) {
  const WP_API_URL = getWpApiUrl();
  const res = await fetch(`${WP_API_URL}/jwt-auth/v1/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) return null;
  return await res.json();
}

export async function getSession(): Promise<AuthSession | null> {
  const cookieStore = await cookies();
  const nativeToken = cookieStore.get('marveo_native_session')?.value;
  if (nativeToken) {
    const resolved = await resolveNativeSessionByToken(nativeToken);
    if (resolved?.identity) {
      return {
        token: nativeToken,
        authSource: 'native',
        user: {
          id: resolved.identity.id,
          user_email: resolved.identity.email,
          user_display_name: resolved.identity.name,
          roles: resolved.identity.roles,
          source: resolved.identity.source,
          requirePasswordChange: Boolean(resolved.userState?.invitePending),
        },
      };
    }
  }

  const token = cookieStore.get('admin_token')?.value;
  const userInfo = cookieStore.get('admin_user')?.value;
  if (!token) return null;
  return {
    token,
    authSource: 'wordpress_bridge',
    user: userInfo ? (JSON.parse(userInfo) as AuthUser) : null,
  };
}

export async function isAdmin(token: string): Promise<boolean> {
  const native = await resolveNativeSessionByToken(token);
  if (native?.identity) {
    if (native.identity.status !== 'ACTIVE') return false;
    const mergedRoles = [...native.identity.roles, ...(native.userState?.masterRole ? [native.userState.masterRole] : [])];
    return hasInternalMasterAccess(normalizeMarveoRoles(mergedRoles));
  }

  const cookieUser = await getCookieUserInfo();
  if (cookieUser) {
    const userId = Number(cookieUser.id);
    const store = await readAdminStore();
    const state = Number.isFinite(userId) && userId > 0 ? store.users[String(userId)] : undefined;

    const mergedRoles = [
      ...(Array.isArray(cookieUser.roles) ? cookieUser.roles : []),
      ...(state?.masterRole ? [state.masterRole] : []),
    ];

    const marveoRoles = normalizeMarveoRoles(mergedRoles);
    const allowedByRole = hasInternalMasterAccess(marveoRoles);
    if (!allowedByRole) return false;

    if (state) return state.active;
    return true;
  }

  try {
    const WP_API_URL = getWpApiUrl();
    const res = await fetch(`${WP_API_URL}/wp/v2/users/me?context=edit`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return false;
    const data = await res.json();
    const store = await readAdminStore();
    const state = store.users[String(data.id)];
    const marveoRoles = normalizeMarveoRoles([
      ...(Array.isArray(data?.roles) ? data.roles : []),
      ...(state?.masterRole ? [state.masterRole] : []),
    ]);

    const allowedByRole = hasInternalMasterAccess(marveoRoles);
    if (!allowedByRole) return false;

    if (!state) return true;
    return state.active;
  } catch {
    return false;
  }
}

export async function getCurrentWpUser(token: string): Promise<{ id: number; email: string; roles: string[] } | null> {
  const WP_API_URL = getWpApiUrl();
  try {
    const res = await fetch(`${WP_API_URL}/wp/v2/users/me?context=edit`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      id: data.id,
      email: data.email ?? '',
      roles: Array.isArray(data.roles) ? data.roles : [],
    };
  } catch {
    return null;
  }
}

export async function getCurrentPlatformUser(token: string): Promise<{ id: string; email: string; roles: string[]; source: 'native' | 'wordpress_bridge' } | null> {
  const native = await resolveNativeSessionByToken(token);
  if (native?.identity) {
    return {
      id: native.identity.id,
      email: native.identity.email,
      roles: native.identity.roles,
      source: 'native',
    };
  }

  const wp = await getCurrentWpUser(token);
  if (!wp) return null;
  return {
    id: String(wp.id),
    email: wp.email,
    roles: wp.roles,
    source: 'wordpress_bridge',
  };
}

export async function isSuperAdmin(token: string): Promise<boolean> {
  const native = await resolveNativeSessionByToken(token);
  if (native?.identity) {
    if (native.identity.status !== 'ACTIVE') return false;
    const mergedRoles = [...native.identity.roles, ...(native.userState?.masterRole ? [native.userState.masterRole] : [])];
    return normalizeMarveoRoles(mergedRoles).includes('SUPER_ADMIN');
  }

  const cookieUser = await getCookieUserInfo();
  if (cookieUser) {
    const userId = Number(cookieUser.id);
    const store = await readAdminStore();
    const state = Number.isFinite(userId) && userId > 0 ? store.users[String(userId)] : undefined;
    const marveoRoles = normalizeMarveoRoles([
      ...(Array.isArray(cookieUser.roles) ? cookieUser.roles : []),
      ...(state?.masterRole ? [state.masterRole] : []),
    ]);
    return marveoRoles.includes('SUPER_ADMIN');
  }

  const user = await getCurrentWpUser(token);
  if (!user) return false;

  const store = await readAdminStore();
  const state = store.users[String(user.id)];
  const marveoRoles = normalizeMarveoRoles([
    ...(user.roles || []),
    ...(state?.masterRole ? [state.masterRole] : []),
  ]);

  return marveoRoles.includes('SUPER_ADMIN');
}
