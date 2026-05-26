import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { updateAdminStore } from '@/lib/adminStore';

export async function POST() {
  const cookieStore = await cookies();
  const nativeToken = cookieStore.get('marveo_native_session')?.value;

  if (nativeToken) {
    await updateAdminStore((current) => ({
      ...current,
      nativeAuth: {
        ...current.nativeAuth,
        sessions: Object.fromEntries(
          Object.entries(current.nativeAuth.sessions).filter(([, session]) => session.token !== nativeToken),
        ),
      },
    })).catch(() => null);
  }

  cookieStore.delete('admin_token');
  cookieStore.delete('admin_user');
  cookieStore.delete('marveo_native_session');
  return NextResponse.json({ success: true });
}
