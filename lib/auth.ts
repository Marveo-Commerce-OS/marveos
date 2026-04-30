import { cookies } from 'next/headers';

const WP_API_URL = process.env.NEXT_PUBLIC_WP_API_URL || 'https://central.prag.global/wp-json';

export async function login(username: string, password: string) {
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
  try {
    const cookieStore = await cookies();
    const userInfoStr = cookieStore.get('admin_user')?.value;
    if (userInfoStr) {
      const userInfo = JSON.parse(userInfoStr);
      if (typeof userInfo.isAdmin === 'boolean') {
        return userInfo.isAdmin;
      }
    }
  } catch {}

  try {
    const res = await fetch(`${WP_API_URL}/wp/v2/users/me?context=edit`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data?.roles?.some((r: string) => ['administrator', 'shop_manager'].includes(r.toLowerCase())) ?? false;
  } catch {
    return false;
  }
}
