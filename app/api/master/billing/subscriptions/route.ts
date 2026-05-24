import { NextRequest, NextResponse } from 'next/server';
import { getSession, getCurrentPlatformUser, isAdmin, isSuperAdmin } from '@/lib/auth';
import { appendAuditLog, readAdminStore, updateAdminStore, type CommercialSubscriptionStatus } from '@/lib/adminStore';
import { sendPlatformEmailNotification } from '@/lib/emailNotifications';

type SubscriptionRow = {
  id: string;
  ownerEmail: string;
  ownerName: string | null;
  organizationId: string;
  organizationName: string;
  planId: string;
  billingInterval: string;
  country: string;
  currency: string;
  amount: number;
  status: CommercialSubscriptionStatus;
  trialEndDate: string | null;
  paymentMode: string;
  paymentReference: string | null;
  paymentProvider: string | null;
  updatedAt: string;
};

async function ensureAdminSession() {
  const session = await getSession();
  if (!session) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const allowed = await isAdmin(session.token);
  if (!allowed) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { session };
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function mapSubscriptionRows(store: Awaited<ReturnType<typeof readAdminStore>>): SubscriptionRow[] {
  const commercial = store.cloud.commercial;

  return Object.values(commercial.subscriptions)
    .map((sub) => {
      const identity = commercial.identities[sub.identityId];
      const org = commercial.organizations[sub.organizationId];

      return {
        id: sub.id,
        ownerEmail: identity?.email || 'unknown',
        ownerName: identity?.name || null,
        organizationId: sub.organizationId,
        organizationName: org?.name || sub.organizationId,
        planId: sub.planId,
        billingInterval: sub.billingInterval,
        country: sub.country,
        currency: sub.currency,
        amount: sub.amount,
        status: sub.status,
        trialEndDate: sub.trialEndDate || null,
        paymentMode: sub.paymentMode,
        paymentReference: sub.paymentReference || null,
        paymentProvider: sub.paymentProvider || null,
        updatedAt: sub.updatedAt,
      };
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function GET() {
  const auth = await ensureAdminSession();
  if ('error' in auth) return auth.error;

  const store = await readAdminStore();
  return NextResponse.json({
    safeBillingActionsEnabled: true,
    subscriptions: mapSubscriptionRows(store),
  });
}

export async function PATCH(req: NextRequest) {
  const auth = await ensureAdminSession();
  if ('error' in auth) return auth.error;

  const canMutate = await isSuperAdmin(auth.session.token);
  if (!canMutate) {
    return NextResponse.json({ error: 'Only super admins can mutate billing records.' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return badRequest('Invalid JSON body');

  const subscriptionId = String((body as { subscriptionId?: unknown }).subscriptionId || '').trim();
  const action = String((body as { action?: unknown }).action || '').trim().toUpperCase();
  if (!subscriptionId) return badRequest('subscriptionId is required');

  const allowedActions = new Set(['MARK_TRIAL_EXPIRED', 'SUSPEND', 'REACTIVATE']);
  if (!allowedActions.has(action)) {
    return badRequest('action must be MARK_TRIAL_EXPIRED, SUSPEND, or REACTIVATE');
  }

  let nextStatus: CommercialSubscriptionStatus | null = null;

  await updateAdminStore((current) => {
    const existing = current.cloud.commercial.subscriptions[subscriptionId];
    if (!existing) return current;

    if (action === 'MARK_TRIAL_EXPIRED') {
      nextStatus = existing.status === 'TRIAL' ? 'EXPIRED' : existing.status;
    }

    if (action === 'SUSPEND') {
      nextStatus = existing.status === 'SUSPENDED' ? 'SUSPENDED' : 'SUSPENDED';
    }

    if (action === 'REACTIVATE') {
      nextStatus = existing.status === 'ACTIVE' ? 'ACTIVE' : 'ACTIVE';
    }

    const resolvedStatus = nextStatus || existing.status;

    current.cloud.commercial.subscriptions[subscriptionId] = {
      ...existing,
      status: resolvedStatus,
      updatedAt: new Date().toISOString(),
    };

    return { ...current };
  });

  const actor = await getCurrentPlatformUser(auth.session.token);
  await appendAuditLog({
    actorEmail: actor?.email ?? String(auth.session.user?.user_email ?? 'unknown'),
    action: 'billing.subscription.status_changed',
    target: `subscription:${subscriptionId}`,
    details: `action=${action};status=${nextStatus || 'unchanged'}`,
  });

  const refreshed = await readAdminStore();
  const targetSub = refreshed.cloud.commercial.subscriptions[subscriptionId];
  const targetIdentity = targetSub ? refreshed.cloud.commercial.identities[targetSub.identityId] : null;
  if (targetSub && targetIdentity?.email) {
    const templateKey = action === 'SUSPEND'
      ? 'BILLING_SUSPENDED'
      : action === 'REACTIVATE'
        ? 'BILLING_REACTIVATED'
        : 'BILLING_NOTICE';

    await sendPlatformEmailNotification({
      templateKey,
      to: targetIdentity.email,
      variables: {
        clientName: targetIdentity.name || targetIdentity.email,
        subscriptionId,
        status: targetSub.status,
        billingEmail: refreshed.platformSettings.email.billingEmail || '',
      },
    });
  }

  return NextResponse.json({
    ok: true,
    subscriptionId,
    subscriptions: mapSubscriptionRows(refreshed),
    safeBillingActionsEnabled: true,
  });
}