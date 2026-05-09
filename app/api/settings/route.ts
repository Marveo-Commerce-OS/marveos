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

  // Super admins can save partial settings directly; the WP endpoint merges payload.
  if (superAdmin) {
    const ok = await saveSiteSettings(incomingSettings as SiteSettings, session.token);
    return NextResponse.json({ success: ok, data: incomingSettings }, { status: ok ? 200 : 500 });
  }

  // Non super-admins keep current under-construction values unchanged.
  const current = await getSiteSettings();
  const mergedSettings: SiteSettings = {
    ...(current || {}),
    ...incomingSettings,
    maintenance: {
      site_under_construction: current?.maintenance?.site_under_construction ?? false,
      under_construction_title: current?.maintenance?.under_construction_title ?? 'We are coming back soon',
      under_construction_message:
        current?.maintenance?.under_construction_message ??
        'We are currently making improvements to serve you better. Please check back shortly.',
      ...(incomingSettings.maintenance ?? {}),
    },
  } as SiteSettings;

  const ok = await saveSiteSettings(mergedSettings, session.token);
  return NextResponse.json({ success: ok, data: mergedSettings }, { status: ok ? 200 : 500 });
}
