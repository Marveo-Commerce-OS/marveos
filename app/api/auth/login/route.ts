import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { readAdminStore } from '@/lib/adminStore';
import { getConfig } from '@/src/config/client';

const getWpApiUrl = () => {
  const config = getConfig();
  return config.wordpressApiUrl || 'https://localhost/wp-json';
};

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
    const { username, password } = await req.json();
    const WP_API_URL = getWpApiUrl();
    
    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
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
    const allowed = userData?.roles?.some((r: string) => ['administrator', 'shop_manager'].includes(r.toLowerCase()));
    
    if (!allowed) {
      return NextResponse.json({ error: 'Your account does not have access to this operations portal.' }, { status: 403 });
    }

    const store = await readAdminStore();
    const userState = store.users[String(userData.id)];
    if (userState && !userState.active) {
      return NextResponse.json({ error: 'Your account has been suspended.' }, { status: 403 });
    }

    const cookieStore = await cookies();
    const opts = { httpOnly: true, secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 7 };
    cookieStore.set('admin_token', data.token, opts);
    cookieStore.set('admin_user', JSON.stringify({
      id: userData.id,
      user_display_name: data.user_display_name,
      user_email: data.user_email,
      isAdmin: allowed,
      roles: Array.isArray(userData.roles) ? userData.roles : [],
      portals: userState?.portals ?? ['b2c'],
    }), opts);

    return NextResponse.json({ success: true, redirect: '/portal' });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred. Please try again.' }, { status: 500 });
  }
}
