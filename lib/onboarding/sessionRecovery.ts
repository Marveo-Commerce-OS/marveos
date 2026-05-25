import { readAdminStore, type CommercialOnboardingSession, type CommercialSubscription } from '@/lib/adminStore';

export type OnboardingRecoveryStatus =
  | 'completedWorkspace'
  | 'incompleteOnboarding'
  | 'activeTrial'
  | 'pendingPayment'
  | 'recoverableSession'
  | 'noExistingSession';

export interface OnboardingRecoveryResult {
  status: OnboardingRecoveryStatus;
  message: string;
  allowedActions: string[];
  sessionId?: string;
  workspaceId?: string;
  redirectPath?: string;
}

function normalizeEmail(value: string): string {
  return String(value || '').trim().toLowerCase();
}

function safeRedirectPath(sessionId: string): string {
  return `/setup/mvp?session=${encodeURIComponent(sessionId)}`;
}

function findWorkspaceByEmail(store: Awaited<ReturnType<typeof readAdminStore>>, email: string) {
  return Object.values(store.cloud.workspaces).find((workspace) => {
    const profileEmail = String((workspace.businessProfile as Record<string, unknown> | undefined)?.contactEmail || '').trim().toLowerCase();
    return profileEmail === email;
  }) || null;
}

function getLatestSessionForIdentity(
  sessions: Record<string, CommercialOnboardingSession>,
  subscriptions: Record<string, CommercialSubscription>,
  identityId: string,
) {
  return Object.values(sessions)
    .filter((session) => {
      const sub = subscriptions[session.subscriptionId];
      return Boolean(sub && sub.identityId === identityId);
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] || null;
}

export async function recoverOnboardingByEmail(emailInput: string): Promise<OnboardingRecoveryResult> {
  const email = normalizeEmail(emailInput);
  if (!email) {
    return {
      status: 'noExistingSession',
      message: 'Email is required to recover onboarding.',
      allowedActions: ['startOver'],
    };
  }

  const store = await readAdminStore();
  const identity = Object.values(store.cloud.commercial.identities)
    .find((item) => item.email.toLowerCase() === email) || null;

  const workspace = findWorkspaceByEmail(store, email);
  if (workspace && (workspace.status === 'launched' || workspace.status === 'ready_for_launch')) {
    return {
      status: 'completedWorkspace',
      message: 'You already have a Marveo workspace. Please log in to continue.',
      allowedActions: ['login', 'resetPassword'],
      workspaceId: workspace.id,
      redirectPath: '/login',
    };
  }

  if (!identity) {
    return {
      status: 'noExistingSession',
      message: 'No existing onboarding session was found for this email.',
      allowedActions: ['startOver'],
    };
  }

  const latestSession = getLatestSessionForIdentity(
    store.cloud.commercial.onboardingSessions,
    store.cloud.commercial.subscriptions,
    identity.id,
  );

  const latestSubscription = Object.values(store.cloud.commercial.subscriptions)
    .filter((item) => item.identityId === identity.id)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] || null;

  if (!latestSubscription) {
    return {
      status: 'noExistingSession',
      message: 'No existing onboarding subscription was found for this email.',
      allowedActions: ['startOver'],
    };
  }

  const hasSession = Boolean(latestSession?.id);
  const sessionId = latestSession?.id;

  if (latestSubscription.status === 'ACTIVE' && latestSubscription.paymentMode === 'TRIAL') {
    return {
      status: 'activeTrial',
      message: 'You already have an active trial. Continue to your workspace.',
      allowedActions: ['continueWorkspace', 'login'],
      sessionId,
      workspaceId: workspace?.id,
      redirectPath: workspace?.id ? `/dashboard?workspaceId=${encodeURIComponent(workspace.id)}` : (sessionId ? safeRedirectPath(sessionId) : '/login'),
    };
  }

  if (latestSubscription.paymentMode === 'PAID' && latestSubscription.paymentVerificationStatus !== 'VERIFIED') {
    return {
      status: 'pendingPayment',
      message: 'You have a pending setup session. Continue payment or restart setup.',
      allowedActions: ['continuePayment', 'startOver'],
      sessionId,
      redirectPath: sessionId ? safeRedirectPath(sessionId) : '/pricing',
    };
  }

  if (hasSession) {
    return {
      status: latestSubscription.status === 'TRIAL' || latestSubscription.status === 'PAST_DUE'
        ? 'incompleteOnboarding'
        : 'recoverableSession',
      message: 'We found an unfinished setup. Continue where you stopped?',
      allowedActions: ['continueSetup', 'startOver'],
      sessionId,
      redirectPath: safeRedirectPath(sessionId || ''),
    };
  }

  return {
    status: 'recoverableSession',
    message: 'An account exists for this email. Verify email to recover setup safely.',
    allowedActions: ['verifyEmail', 'startOver'],
  };
}
