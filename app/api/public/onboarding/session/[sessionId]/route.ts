import { NextRequest, NextResponse } from 'next/server';
import { recoverOnboardingSession } from '@/lib/commercialOnboarding';

export async function GET(req: NextRequest, context: { params: Promise<{ sessionId: string }> }) {
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
