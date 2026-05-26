import { NextResponse } from 'next/server';
import { readAdminStore } from '@/lib/adminStore';
import { requireMasterAccess } from '@/lib/permissions/access';
import { hasSupportQueueAccess } from '@/lib/tickets/service';

function normalizeEmail(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function supportsTicketNotifications(roles: string[]): boolean {
  const normalized = roles.map((role) => String(role).trim().toUpperCase());
  return normalized.includes('CUSTOMER_SUPPORT')
    || normalized.includes('TECHNICAL_SUPPORT')
    || normalized.includes('ADMIN')
    || normalized.includes('SUPER_ADMIN');
}

export async function GET() {
  const access = await requireMasterAccess();
  if ('error' in access) return access.error;

  const allowed = await hasSupportQueueAccess(access.roles);
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const store = await readAdminStore();

  const supportEmail = normalizeEmail(store.platformSettings.email.supportEmail);
  const fromEmail = normalizeEmail(store.platformSettings.email.fromEmail);
  const replyToEmail = normalizeEmail(store.platformSettings.email.replyToEmail);
  const failureAlertRecipients = Array.isArray(store.platformSettings.email.failureAlertRecipients)
    ? store.platformSettings.email.failureAlertRecipients.map((item) => normalizeEmail(item))
    : [];

  const internalNotificationRecipients = Object.values(store.nativeAuth.identities)
    .filter((identity) => identity.userType === 'INTERNAL_USER' && identity.status === 'ACTIVE')
    .filter((identity) => {
      const userState = store.users[identity.id];
      if (userState?.active === false || userState?.status === 'DISABLED') return false;

      const roleSet = new Set<string>([
        ...identity.roles,
        ...(userState?.masterRole ? [userState.masterRole] : []),
      ]);

      return supportsTicketNotifications(Array.from(roleSet));
    })
    .map((identity) => normalizeEmail(identity.email));

  const fallbackRecipients = Array.from(new Set([
    fromEmail,
    replyToEmail,
    ...failureAlertRecipients,
    ...internalNotificationRecipients,
  ])).filter((email) => isValidEmail(email));

  const supportRecipients = Array.from(new Set([
    supportEmail,
    ...fallbackRecipients,
  ])).filter((email) => isValidEmail(email));

  return NextResponse.json({
    ok: true,
    supportEmailConfigured: Boolean(isValidEmail(supportEmail)),
    supportEmail: isValidEmail(supportEmail) ? supportEmail : '',
    fallbackRecipients,
    supportRecipients,
    canNotifySupport: supportRecipients.length > 0,
  });
}
