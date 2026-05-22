import { NextResponse } from 'next/server';
import { getSession, isSuperAdmin } from '@/lib/auth';
import { readAdminStore } from '@/lib/adminStore';

async function ensureAdminSession() {
  const session = await getSession();
  if (!session) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const superAdmin = await isSuperAdmin(session.token);
  if (!superAdmin) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { session };
}

export async function GET() {
  const auth = await ensureAdminSession();
  if ('error' in auth) {
    return auth.error;
  }

  const store = await readAdminStore();
  return NextResponse.json({
    lookups: store.cloud.lookups,
    sourceTypes: [
      { key: 'wordpress', label: 'WordPress (plugin-driven)' },
      { key: 'nextjs', label: 'Next.js frontend' },
    ],
  });
}
