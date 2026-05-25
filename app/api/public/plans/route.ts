import { NextRequest, NextResponse } from 'next/server';
import { getPublicPlans } from '@/lib/commercialOnboarding';
import { enforceRateLimit } from '@/lib/security/requestGuards';

export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req, 'public:plans:get');
  if (limited) return limited;

  const country = req.nextUrl.searchParams.get('country') || 'US';
  const payload = await getPublicPlans(country);
  return NextResponse.json(payload);
}
