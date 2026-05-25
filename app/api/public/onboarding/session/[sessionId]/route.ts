import { NextRequest, NextResponse } from 'next/server';
import { recoverOnboardingSession } from '@/lib/commercialOnboarding';
import { readAdminStore } from '@/lib/adminStore';
import { resolveWorkspaceEntitlement } from '@/lib/workspaceEntitlements';
import { enforceRateLimit } from '@/lib/security/requestGuards';

export async function GET(req: NextRequest, context: { params: Promise<{ sessionId: string }> }) {
  const limited = enforceRateLimit(req, 'public:onboarding:session:by-id');
  if (limited) return limited;

  const params = await context.params;
  const sessionId = params.sessionId ? String(params.sessionId).trim() : '';

  if (!sessionId) {
    return NextResponse.json({ ok: false, error: 'sessionId is required' }, { status: 400 });
  }

  const appBaseUrl = process.env.MARVEO_APP_BASE_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  const result = await recoverOnboardingSession({ sessionId, appBaseUrl });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.reason }, { status: 404 });
  }

  const store = await readAdminStore();
  const recoveredSessionId = typeof result.sessionId === 'string' ? result.sessionId : '';
  const activeSession = recoveredSessionId
    ? store.cloud.commercial.onboardingSessions[recoveredSessionId]
    : null;
  const activeSubscription = activeSession
    ? store.cloud.commercial.subscriptions[activeSession.subscriptionId]
    : null;

  const entitlement = activeSession && activeSubscription
    ? resolveWorkspaceEntitlement(store, {
        subscriptionPlanId: activeSubscription.planId,
        scope: {
          clientOrganizationId: activeSession.organizationId,
          clientSubscriptionId: activeSession.subscriptionId,
        },
      })
    : null;

  return NextResponse.json({
    ...result,
    workspaceEntitlement: entitlement?.ok
      ? {
          planId: entitlement.entitlement.planId,
          workspaceLimit: entitlement.entitlement.workspaceLimit,
          workspaceCount: entitlement.entitlement.workspaceCount,
          remainingWorkspaces: entitlement.entitlement.remainingWorkspaces,
          hasCapacity: entitlement.entitlement.hasCapacity,
        }
      : null,
  });
}
