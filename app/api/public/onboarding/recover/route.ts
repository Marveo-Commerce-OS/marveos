import { NextRequest, NextResponse } from 'next/server';
import { recoverOnboardingByEmail } from '@/lib/onboarding/sessionRecovery';
import { enforceRateLimit, parseEmail } from '@/lib/security/requestGuards';

function badRequest(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, 'public:onboarding:recover');
  if (limited) return limited;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return badRequest('Invalid JSON body.');
  }

  const email = parseEmail((body as { email?: unknown }).email) || '';
  if (!email) {
    return badRequest('email is required');
  }

  const result = await recoverOnboardingByEmail(email);
  return NextResponse.json({ ok: true, ...result });
}
