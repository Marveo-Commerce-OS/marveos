import { NextResponse } from 'next/server';
import { getCurrentWpUser, getSession, isSuperAdmin } from '@/lib/auth';

const WP_API_URL = process.env.NEXT_PUBLIC_WP_API_URL || 'https://central.prag.global/wp-json';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ok = await isSuperAdmin(session.token);
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const settingsRes = await fetch(`${WP_API_URL}/wp/v2/settings`, {
      headers: { Authorization: `Bearer ${session.token}` },
      cache: 'no-store',
    });

    if (settingsRes.ok) {
      const settings = await settingsRes.json() as { admin_email?: string };
      const adminEmail = String(settings.admin_email ?? '').trim();
      if (adminEmail) {
        return NextResponse.json({ email: adminEmail });
      }
    }
  } catch {
    // Fall back to current WordPress user email below.
  }

  const currentUser = await getCurrentWpUser(session.token);
  const fallbackEmail = String(currentUser?.email ?? '').trim();
  if (!fallbackEmail) {
    return NextResponse.json({ error: 'Could not resolve a WordPress admin email.' }, { status: 404 });
  }

  return NextResponse.json({ email: fallbackEmail });
}
