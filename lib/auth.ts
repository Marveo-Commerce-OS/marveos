import { cookies } from 'next/headers';
import { readAdminStore } from './adminStore';
import { getConfig } from '@/src/config/client';

export const INTERNAL_PLATFORM_ROLES = ['administrator', 'shop_manager'] as const;
export const CLIENT_PLATFORM_ROLES = ['customer', 'subscriber'] as const;

function getWpApiUrl(): string {
  const config = getConfig();
  return config.wordpressApiUrl || 'https://localhost/wp-json';
}

export function normalizeRoles(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((role) => String(role).toLowerCase());
}

export function hasInternalPlatformAccess(roles: string[]): boolean {
  return roles.some((role) => INTERNAL_PLATFORM_ROLES.includes(role as (typeof INTERNAL_PLATFORM_ROLES)[number]));
}

export function hasClientWorkspaceAccess(roles: string[]): boolean {
  return roles.some((role) => CLIENT_PLATFORM_ROLES.includes(role as (typeof CLIENT_PLATFORM_ROLES)[number]));
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

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_token')?.value;
  const userInfo = cookieStore.get('admin_user')?.value;
  if (!token) return null;
  return { token, user: userInfo ? JSON.parse(userInfo) : null };
}

export async function isAdmin(token: string): Promise<boolean> {
  const cookieUser = await getCookieUserInfo();
  if (cookieUser && typeof cookieUser.isAdmin === 'boolean') {
    const allowedByRole = cookieUser.isAdmin;
    if (!allowedByRole) return false;

    const userId = Number(cookieUser.id);
    if (Number.isFinite(userId) && userId > 0) {
      const store = await readAdminStore();
      const state = store.users[String(userId)];
      if (!state) return true;
      return state.active;
    }

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
    const roles = normalizeRoles(data?.roles);
    const allowedByRole = hasInternalPlatformAccess(roles);
    if (!allowedByRole) return false;

    const store = await readAdminStore();
    const state = store.users[String(data.id)];
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

export async function isSuperAdmin(token: string): Promise<boolean> {
  const cookieUser = await getCookieUserInfo();
  if (cookieUser && Array.isArray(cookieUser.roles)) {
    return normalizeRoles(cookieUser.roles).includes('administrator');
  }

  const user = await getCurrentWpUser(token);
  return user?.roles?.some((role) => role.toLowerCase() === 'administrator') ?? false;
}
