import { NextResponse } from 'next/server';
import { readAdminStore } from '@/lib/adminStore';
import { getConfig } from '@/src/config/client';

function isFaviconLikeAsset(url: string) {
  return /fav(?:icon)?/i.test(url);
}

function normalizeBaseUrl(value: string): string {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : `https://${trimmed}`);
    return parsed.origin;
  } catch {
    return '';
  }
}

function absolutizeUrl(value: string, baseUrl: string): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (!baseUrl) return raw;
  try {
    return new URL(raw, `${baseUrl.replace(/\/$/, '')}/`).toString();
  } catch {
    return raw;
  }
}

function pickPrimaryLogoUrl(candidates: string[]): string {
  return candidates
    .map((item) => String(item || '').trim())
    .find((item) => item && !isFaviconLikeAsset(item)) || '';
}

export async function GET(req: Request) {
  const store = await readAdminStore();
  const config = getConfig();
  const branding = store.platformSettings.branding;
  const requestOrigin = (() => {
    try {
      return new URL(req.url).origin;
    } catch {
      return '';
    }
  })();
  const configuredBase = normalizeBaseUrl(store.platformSettings.email.appBaseUrl || config.frontendUrl || requestOrigin);

  const defaultLogoUrlRaw = pickPrimaryLogoUrl([
    branding.logoUrl,
    branding.dashboardLogoUrl,
    branding.portalLoginLogoUrl,
    config.clientLogo || '',
  ]);
  const dashboardLogoUrlRaw = pickPrimaryLogoUrl([
    branding.dashboardLogoUrl,
    defaultLogoUrlRaw,
    branding.logoUrl,
    branding.portalLoginLogoUrl,
    config.clientLogo || '',
  ]);
  const portalLoginLogoUrlRaw = pickPrimaryLogoUrl([
    branding.portalLoginLogoUrl,
    defaultLogoUrlRaw,
    dashboardLogoUrlRaw,
    branding.logoUrl,
    config.clientLogo || '',
  ]);

  const defaultLogoUrl = absolutizeUrl(defaultLogoUrlRaw, configuredBase);
  const dashboardLogoUrl = absolutizeUrl(dashboardLogoUrlRaw || defaultLogoUrlRaw, configuredBase);
  const portalLoginLogoUrl = absolutizeUrl(portalLoginLogoUrlRaw || dashboardLogoUrlRaw || defaultLogoUrlRaw, configuredBase);

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