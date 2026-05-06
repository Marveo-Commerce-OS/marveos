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

  const incomingSettings: Partial<SiteSettings> = await req.json();
  const superAdmin = await isSuperAdmin(session.token);

  // Always merge with current settings to ensure we don't lose data
  const current = await getSiteSettings();
  const mergedSettings: SiteSettings = {
    ...current || {},
    ...incomingSettings,
  } as SiteSettings;

  // If not super admin, prevent changing under construction settings
  if (!superAdmin) {
    mergedSettings.site_under_construction = current?.site_under_construction ?? false;
    mergedSettings.under_construction_title = current?.under_construction_title ?? 'We are coming back soon';
    mergedSettings.under_construction_message = current?.under_construction_message ?? 'We are currently making improvements to serve you better. Please check back shortly.';
  }

  const ok = await saveSiteSettings(mergedSettings, session.token);
  return NextResponse.json({ success: ok }, { status: ok ? 200 : 500 });
}
