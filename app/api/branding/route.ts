import { NextResponse } from 'next/server';
import { readAdminStore } from '@/lib/adminStore';
import { getConfig } from '@/src/config/client';

function isFaviconLikeAsset(url: string) {
  return /fav(?:icon)?/i.test(url);
}

export async function GET() {
  const store = await readAdminStore();
  const config = getConfig();
  const branding = store.platformSettings.branding;
  const defaultLogoUrl = branding.logoUrl || config.clientLogo || '';
  const dashboardLogoUrl = branding.dashboardLogoUrl || defaultLogoUrl;
  const portalLoginLogoUrl = branding.portalLoginLogoUrl && !isFaviconLikeAsset(branding.portalLoginLogoUrl)
    ? branding.portalLoginLogoUrl
    : (defaultLogoUrl && !isFaviconLikeAsset(defaultLogoUrl)
        ? defaultLogoUrl
        : dashboardLogoUrl);

  return NextResponse.json({
    brandName: branding.brandName || config.clientName || 'Marveo',
    brandByline: branding.brandByline || config.brandByline || '',
    primaryColor: branding.primaryColor || config.clientPrimaryColor,
    secondaryColor: branding.secondaryColor || config.clientSecondaryColor,
    logoUrl: defaultLogoUrl,
    dashboardLogoUrl,
    portalLoginLogoUrl,
    faviconUrl: branding.faviconUrl || '',
  });
}