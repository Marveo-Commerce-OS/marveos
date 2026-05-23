import { NextRequest, NextResponse } from 'next/server';
import { getPublicPlans } from '@/lib/commercialOnboarding';

export async function GET(req: NextRequest) {
  const country = req.nextUrl.searchParams.get('country') || 'US';
  const payload = await getPublicPlans(country);
  return NextResponse.json(payload);
}
