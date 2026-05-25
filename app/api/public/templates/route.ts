import { NextRequest, NextResponse } from 'next/server';
import { getPublicTemplates } from '@/lib/commercialOnboarding';
import { enforceRateLimit } from '@/lib/security/requestGuards';

export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req, 'public:templates:get');
  if (limited) return limited;

  const status = req.nextUrl.searchParams.get('status') || undefined;
  const visibility = req.nextUrl.searchParams.get('visibility') || undefined;
  const websiteType = req.nextUrl.searchParams.get('websiteType') || undefined;
  const country = req.nextUrl.searchParams.get('country') || undefined;
  const planId = req.nextUrl.searchParams.get('planId') || undefined;

  const payload = await getPublicTemplates({
    status,
    visibility,
    websiteType,
    country,
    planId,
  });

  return NextResponse.json(payload);
}
