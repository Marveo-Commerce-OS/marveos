import { NextRequest, NextResponse } from 'next/server';
import { getSession, isSuperAdmin } from '@/lib/auth';
import { getSiteSettings, saveSiteSettings } from '@/lib/api';
import type { SiteSettings } from '@/lib/types';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const settings = await getSiteSettings();
  return NextResponse.json(settings ?? {});
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const settings: SiteSettings = await req.json();
  const superAdmin = await isSuperAdmin(session.token);

  if (!superAdmin) {
    const current = await getSiteSettings();
    settings.site_under_construction = current?.site_under_construction ?? false;
    settings.under_construction_title = current?.under_construction_title ?? 'We are coming back soon';
    settings.under_construction_message = current?.under_construction_message ?? 'We are currently making improvements to serve you better. Please check back shortly.';
  }

  const ok = await saveSiteSettings(settings, session.token);
  return NextResponse.json({ success: ok }, { status: ok ? 200 : 500 });
}
