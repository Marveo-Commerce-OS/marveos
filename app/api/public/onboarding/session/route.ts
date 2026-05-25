import { NextRequest, NextResponse } from 'next/server';
import { recoverOnboardingSession } from '@/lib/commercialOnboarding';
import { enforceRateLimit, parseEmail } from '@/lib/security/requestGuards';

export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req, 'public:onboarding:session:get');
  if (limited) return limited;

  const sessionId = req.nextUrl.searchParams.get('sessionId') || undefined;
  const emailRaw = req.nextUrl.searchParams.get('email');
  const parsedEmail = emailRaw ? parseEmail(emailRaw) : null;
  const email = parsedEmail || undefined;

  if (!sessionId && !email) {
    return NextResponse.json({ ok: false, error: 'sessionId or email is required' }, { status: 400 });
  }

  if (emailRaw && !parsedEmail) {
    return NextResponse.json({ ok: false, error: 'email is invalid' }, { status: 400 });
  }

  const appBaseUrl = process.env.MARVEO_APP_BASE_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  const result = await recoverOnboardingSession({ sessionId, email, appBaseUrl });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.reason }, { status: 404 });
  }

  return NextResponse.json(result);
}
