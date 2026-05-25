import { NextRequest, NextResponse } from 'next/server';
import { recoverOnboardingSession } from '@/lib/commercialOnboarding';
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

  return NextResponse.json(result);
}
