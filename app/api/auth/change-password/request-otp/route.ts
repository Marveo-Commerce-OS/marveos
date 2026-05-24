import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { appendAuditLog, readAdminStore, updateAdminStore } from '@/lib/adminStore';
import { sendPlatformEmailNotification } from '@/lib/emailNotifications';

function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.authSource !== 'native') {
    return NextResponse.json({ error: 'OTP verification is only supported for native accounts.' }, { status: 400 });
  }

  const body = await req.json().catch(() => null) as { surface?: unknown } | null;
  const surface = body?.surface === 'master' ? 'master' : 'portal';
  const userId = session.user?.id != null ? String(session.user.id) : '';
  if (!userId) return NextResponse.json({ error: 'Invalid session user.' }, { status: 400 });

  const store = await readAdminStore();
  const identity = store.nativeAuth.identities[userId];
  if (!identity?.email) return NextResponse.json({ error: 'No email is configured for this account.' }, { status: 400 });

  const code = generateOtpCode();
  const requestedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const appBaseUrl = String(store.platformSettings.email.appBaseUrl || `${req.nextUrl.protocol}//${req.nextUrl.host}`).trim();
  const loginUrl = new URL(surface === 'master' ? '/master-login' : '/login', appBaseUrl).toString();
  const changePasswordUrl = new URL('/password/change', appBaseUrl).toString();

  await updateAdminStore((current) => ({
    ...current,
    nativeAuth: {
      ...current.nativeAuth,
      passwordChangeOtps: {
        ...current.nativeAuth.passwordChangeOtps,
        [userId]: {
          code,
          requestedAt,
          expiresAt,
        },
      },
    },
  }));

  await appendAuditLog({
    actorEmail: String(session.user?.user_email ?? 'unknown'),
    action: 'auth.password.otp.requested',
    target: `user:${userId}`,
    details: `surface=${surface}`,
  });

  await sendPlatformEmailNotification({
    templateKey: 'PASSWORD_RESET_REQUESTED',
    to: identity.email,
    variables: {
      userName: identity.name || identity.email,
      otpCode: code,
      appBaseUrl,
      loginUrl,
      changePasswordUrl,
    },
  });

  return NextResponse.json({ ok: true, expiresAt });
}