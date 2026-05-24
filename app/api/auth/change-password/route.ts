import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { appendAuditLog, readAdminStore, updateAdminStore } from '@/lib/adminStore';
import { sendPlatformEmailNotification } from '@/lib/emailNotifications';
import { getPasswordEntry, upsertPasswordEntries, verifyPasswordEntry } from '@/lib/nativePasswords';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (session.authSource !== 'native') {
    return NextResponse.json({ error: 'Password changes are only supported for native accounts.' }, { status: 400 });
  }

  const body = await req.json().catch(() => null) as { currentPassword?: unknown; newPassword?: unknown; otpCode?: unknown } | null;
  const currentPassword = typeof body?.currentPassword === 'string' ? body.currentPassword : '';
  const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : '';
  const otpCode = typeof body?.otpCode === 'string' ? body.otpCode.trim() : '';
  if (!currentPassword || !newPassword || !otpCode) return NextResponse.json({ error: 'currentPassword, newPassword, and otpCode are required.' }, { status: 400 });
  if (newPassword.length < 8) return NextResponse.json({ error: 'New password must be at least 8 characters.' }, { status: 400 });

  const userId = session.user?.id != null ? String(session.user.id) : '';
  if (!userId) return NextResponse.json({ error: 'Invalid session user.' }, { status: 400 });

  const store = await readAdminStore();
  const entry = getPasswordEntry(store.nativeAuth.permissions[userId]);
  if (!entry || !verifyPasswordEntry(currentPassword, entry)) {
    return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 401 });
  }
  const otpEntry = store.nativeAuth.passwordChangeOtps[userId];
  if (!otpEntry || otpEntry.code !== otpCode) {
    return NextResponse.json({ error: 'Verification code is invalid.' }, { status: 401 });
  }
  if (new Date(otpEntry.expiresAt) < new Date()) {
    return NextResponse.json({ error: 'Verification code has expired. Request a new code.' }, { status: 401 });
  }

  const identity = store.nativeAuth.identities[userId];

  await updateAdminStore((current) => ({
    ...current,
    users: {
      ...current.users,
      [userId]: {
        ...(current.users[userId] ?? { active: true, portals: [] }),
        active: true,
        status: 'ACTIVE',
        invitePending: false,
      },
    },
    nativeAuth: {
      ...current.nativeAuth,
      permissions: {
        ...current.nativeAuth.permissions,
        [userId]: upsertPasswordEntries(current.nativeAuth.permissions[userId], newPassword),
      },
      passwordChangeOtps: Object.fromEntries(
        Object.entries(current.nativeAuth.passwordChangeOtps).filter(([key]) => key !== userId),
      ),
      identities: current.nativeAuth.identities[userId] ? {
        ...current.nativeAuth.identities,
        [userId]: {
          ...current.nativeAuth.identities[userId],
          status: 'ACTIVE',
          updatedAt: new Date().toISOString(),
        },
      } : current.nativeAuth.identities,
    },
  }));

  await appendAuditLog({
    actorEmail: String(session.user?.user_email ?? 'unknown'),
    action: 'auth.password.changed',
    target: `user:${userId}`,
    details: 'native_password_updated',
  });

  if (identity?.email) {
    await sendPlatformEmailNotification({
      templateKey: 'PASSWORD_CHANGED',
      to: identity.email,
      variables: {
        userName: identity.name || identity.email,
      },
    });
  }

  return NextResponse.json({ ok: true });
}

