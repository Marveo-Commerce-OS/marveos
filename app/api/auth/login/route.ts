import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const WP_API_URL = process.env.NEXT_PUBLIC_WP_API_URL || 'https://central.prag.global/wp-json';

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();

  const wpRes = await fetch(`${WP_API_URL}/jwt-auth/v1/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (!wpRes.ok) return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });

  const data = await wpRes.json();

  const userRes = await fetch(`${WP_API_URL}/wp/v2/users/me?context=edit`, {
    headers: { Authorization: `Bearer ${data.token}` },
  });

  if (!userRes.ok) {
    return NextResponse.json({ error: 'Failed to verify user permissions.' }, { status: 403 });
  }

  const userData = await userRes.json();
  const allowed = userData?.roles?.some((r: string) => ['administrator', 'shop_manager'].includes(r.toLowerCase()));
  
  if (!allowed) {
    return NextResponse.json({ error: `Access denied. Admin or Shop Manager role required.` }, { status: 403 });
  }

  const cookieStore = await cookies();
  const opts = { httpOnly: true, secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 7 };
  cookieStore.set('admin_token', data.token, opts);
  cookieStore.set('admin_user', JSON.stringify({
    user_display_name: data.user_display_name,
    user_email: data.user_email,
    isAdmin: allowed,
  }), opts);

  return NextResponse.json({ success: true, redirect: '/portal' });
}
