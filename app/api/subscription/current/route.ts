import { NextRequest, NextResponse } from 'next/server';
import { getSession, hasInternalPlatformAccess, normalizeRoles } from '@/lib/auth';
import { resolveCurrentEntitlement } from '@/lib/commercialOnboarding';

const MARKETING_PRICING_URL = process.env.NEXT_PUBLIC_MARKETING_PRICING_URL || 'https://getmarveo.com/pricing';

export async function GET(req: NextRequest) {
  const onboardingSessionId = req.nextUrl.searchParams.get('session') || undefined;

  const session = await getSession();
  if (session) {
    const roles = normalizeRoles(session.user?.roles);
    if (hasInternalPlatformAccess(roles)) {
      return NextResponse.json({
        entitled: true,
        bypass: true,
        reason: 'INTERNAL_BYPASS',
      });
    }
  }

  const email = session?.user?.user_email ? String(session.user.user_email).trim().toLowerCase() : undefined;
  const entitlement = await resolveCurrentEntitlement({ onboardingSessionId, email });

  if (entitlement.entitled) {
    return NextResponse.json({
      entitled: true,
      reason: entitlement.reason,
      subscription: entitlement.subscription || null,
    });
  }

  if (entitlement.reason === 'TRIAL_EXPIRED') {
    return NextResponse.json(
      {
        entitled: false,
        reason: 'TRIAL_EXPIRED',
        subscription: entitlement.subscription || null,
        lockBehavior: {
          allowLoginView: true,
          blockPublishing: true,
          blockLaunch: true,
          blockNewWorkspace: true,
        },
      },
      { status: 402 },
    );
  }

  return NextResponse.json(
    {
      entitled: false,
      reason: entitlement.reason,
      redirectTo: MARKETING_PRICING_URL,
    },
    { status: 403 },
  );
}
