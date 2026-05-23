import { NextRequest, NextResponse } from 'next/server';
import { recoverOnboardingSession } from '@/lib/commercialOnboarding';

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('sessionId') || undefined;
  const email = req.nextUrl.searchParams.get('email') || undefined;

  if (!sessionId && !email) {
    return NextResponse.json({ ok: false, error: 'sessionId or email is required' }, { status: 400 });
  }

  const appBaseUrl = process.env.MARVEO_APP_BASE_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  const result = await recoverOnboardingSession({ sessionId, email, appBaseUrl });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.reason }, { status: 404 });
  }

  return NextResponse.json(result);
}
