'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { MarveoProvider } from '@/components/MarveoProvider';
import { MarveoRenderer } from '@/components/MarveoRenderer';
import { getConfig } from '@/src/config/client';

type PublicBranding = {
  brandName: string;
  brandByline: string;
  primaryColor: string;
  logoUrl: string;
  dashboardLogoUrl: string;
};

export default function RuntimePortalPage() {
  const config = getConfig();
  const [branding, setBranding] = useState<PublicBranding>({
    brandName: config.clientName || config.appName,
    brandByline: config.brandByline,
    primaryColor: config.clientPrimaryColor,
    logoUrl: config.clientLogo || '',
    dashboardLogoUrl: config.clientLogo || '',
  });

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const res = await fetch('/api/branding', { cache: 'no-store' });
        const body = (await res.json().catch(() => null)) as Partial<PublicBranding> | null;
        if (!res.ok || !body || cancelled) return;

        setBranding((prev) => ({
          brandName: body.brandName || prev.brandName,
          brandByline: body.brandByline || prev.brandByline,
          primaryColor: body.primaryColor || prev.primaryColor,
          logoUrl: body.logoUrl || prev.logoUrl,
          dashboardLogoUrl: body.dashboardLogoUrl || prev.dashboardLogoUrl,
        }));
      } catch {
        // use config fallback
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 md:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-4">
            {branding.logoUrl || branding.dashboardLogoUrl ? (
              <div className="relative h-10 w-36">
                <Image
                  src={branding.logoUrl || branding.dashboardLogoUrl}
                  alt={branding.brandName}
                  fill
                  className="object-contain object-left"
                  priority
                  unoptimized
                />
              </div>
            ) : null}
            <p className="text-xs font-semibold uppercase tracking-[0.25em]" style={{ color: branding.primaryColor }}>
              {branding.brandName} Runtime
            </p>
          </div>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Dynamic Component Rendering</h1>
          <p className="mt-2 text-slate-600">
            This view renders runtime-driven pages from connector APIs without hardcoded page layouts.
          </p>
          <p className="mt-1 text-sm text-slate-500">{branding.brandByline}</p>
        </header>

        <MarveoProvider>
          <MarveoRenderer slug="home" />
        </MarveoProvider>
      </div>
    </div>
  );
}
