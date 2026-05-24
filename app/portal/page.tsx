'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { getConfig } from '@/src/config/client';

type HealthStatus = 'pass' | 'warn' | 'fail' | 'unknown';
type StackSegment = 'wordpress' | 'nextjs' | 'headless' | 'unknown';

interface HealthCheck {
  key: string;
  label: string;
  status: HealthStatus;
  detail: string;
}

interface WorkspaceHealth {
  workspaceId: string;
  workspaceName: string;
  websiteType: string;
  stackSegments: StackSegment[];
  generatedAt: string;
  checks: HealthCheck[];
}

type PublicBranding = {
  brandName: string;
  brandByline: string;
  primaryColor: string;
  logoUrl: string;
  dashboardLogoUrl: string;
};

const HEALTH_AUTO_REFRESH_MS = 60000;

function stackLabel(stack: StackSegment): string {
  if (stack === 'wordpress') return 'WordPress/WooCommerce';
  if (stack === 'nextjs') return 'Next.js';
  if (stack === 'headless') return 'Headless/Custom';
  return 'Unknown stack';
}

function statusStyle(status: HealthStatus): string {
  if (status === 'pass') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'warn') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (status === 'fail') return 'bg-rose-50 text-rose-700 border-rose-200';
  return 'bg-slate-50 text-slate-600 border-slate-200';
}

function statusLabel(status: HealthStatus): string {
  if (status === 'pass') return 'Healthy';
  if (status === 'warn') return 'Needs review';
  if (status === 'fail') return 'Attention needed';
  return 'Unknown';
}

export default function PortalPage() {
  const router = useRouter();
  const config = getConfig();
  const [branding, setBranding] = useState<PublicBranding>({
    brandName: config.clientName || config.appName,
    brandByline: config.brandByline,
    primaryColor: config.clientPrimaryColor,
    logoUrl: config.clientLogo || '',
    dashboardLogoUrl: config.clientLogo || '',
  });
  const [showComingSoon, setShowComingSoon] = useState(false);
  const [workspaceHealth, setWorkspaceHealth] = useState<WorkspaceHealth[]>([]);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState('');
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('');
  const [lastCheckedAt, setLastCheckedAt] = useState('');
  const workspaceSections = useMemo(
    () => [
      'Dashboard',
      'My Setup',
      'Launch Progress',
      'Website Setup',
      'Website Pages',
      'Products and Services',
      'Media',
      'Settings',
      'Support',
      'Grant Support Access',
    ],
    [],
  );

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
        // keep fallback branding from config
      }
    })();

    async function loadWebsiteHealth(silent = false) {
      if (!silent) {
        setHealthLoading(true);
      }

      setHealthError('');

      try {
        const response = await fetch('/api/portal/website-health', { method: 'GET' });
        const payload = (await response.json()) as {
          error?: string;
          generatedAt?: string;
          workspaces?: WorkspaceHealth[];
        };

        if (!response.ok) {
          throw new Error(payload?.error || 'Unable to load website health checks.');
        }

        if (cancelled) return;

        const rows = Array.isArray(payload?.workspaces) ? payload.workspaces : [];
        setWorkspaceHealth(rows);
        setLastCheckedAt(payload?.generatedAt || new Date().toISOString());

        setSelectedWorkspaceId((current) => {
          if (current && rows.some((item) => item.workspaceId === current)) {
            return current;
          }
          return rows[0]?.workspaceId || '';
        });
      } catch (error) {
        if (cancelled) return;
        setHealthError(error instanceof Error ? error.message : 'Unable to load website health checks.');
      } finally {
        if (!cancelled && !silent) {
          setHealthLoading(false);
        }
      }
    }

    void loadWebsiteHealth(false);
    const timerId = window.setInterval(() => {
      void loadWebsiteHealth(true);
    }, HEALTH_AUTO_REFRESH_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timerId);
    };
  }, []);

  const selectedWorkspace = useMemo(() => {
    if (!workspaceHealth.length) return null;
    return workspaceHealth.find((item) => item.workspaceId === selectedWorkspaceId) ?? workspaceHealth[0];
  }, [workspaceHealth, selectedWorkspaceId]);

  const healthSummary = useMemo(() => {
    const checks = selectedWorkspace?.checks ?? [];
    return {
      healthy: checks.filter((item) => item.status === 'pass').length,
      review: checks.filter((item) => item.status === 'warn').length,
      critical: checks.filter((item) => item.status === 'fail').length,
      unknown: checks.filter((item) => item.status === 'unknown').length,
    };
  }, [selectedWorkspace]);

  return (
    <div className="min-h-screen bg-white flex flex-col">

      {/* Top bar */}
      <header className="w-full px-8 py-5 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {branding.logoUrl || branding.dashboardLogoUrl ? (
            <div className="relative h-9 w-32">
              <Image
                src={branding.logoUrl || branding.dashboardLogoUrl}
                alt={branding.brandName}
                fill
                className="object-contain object-left"
                priority
                unoptimized
              />
            </div>
          ) : (
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: branding.primaryColor }}
            >
              <span className="text-white text-xs font-bold">
                {(branding.brandName || config.appName)[0].toUpperCase()}
              </span>
            </div>
          )}
          <span className="text-gray-900 font-bold text-lg font-['Space_Grotesk']">
            {branding.brandName || config.appName}
          </span>
        </div>
        <button
          onClick={async () => {
            await fetch('/api/auth/logout', { method: 'POST' });
            router.push('/login');
          }}
          className="text-sm text-gray-400 hover:text-gray-600 transition-colors font-['Space_Grotesk']"
        >
          Sign out
        </button>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16">

        <div className="text-center mb-12">
          <p className="text-xs font-semibold uppercase tracking-widest mb-3 font-['Space_Grotesk']" style={{ color: branding.primaryColor }}>
            Client Workspace
          </p>
          <h1 className="text-4xl font-bold text-gray-900 font-['Space_Grotesk']">
            Your Marveo workspace
          </h1>
          <p className="text-gray-400 mt-3 text-base font-['Space_Grotesk']">
            Manage your storefront content and launch readiness from a client-safe workspace surface.
          </p>
        </div>

        <div className="w-full max-w-3xl rounded-3xl border border-gray-100 bg-white p-8 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900 font-['Space_Grotesk']">Workspace areas</h2>
          <p className="mt-2 text-sm text-gray-500 font-['Space_Grotesk']">
            Client modules are being rolled into this surface. Internal operations tools remain in the Master Platform.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {workspaceSections.map((section) => (
              <div key={section} className="rounded-2xl border border-gray-100 px-4 py-3 text-sm font-medium text-gray-700 font-['Space_Grotesk']">
                {section}
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setShowComingSoon(true)}
              className="rounded-full px-4 py-2 text-sm font-semibold text-white font-['Space_Grotesk']"
              style={{ backgroundColor: branding.primaryColor }}
            >
              Open workspace modules
            </button>
            <button
              type="button"
              onClick={() => setShowComingSoon(true)}
              className="rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 font-['Space_Grotesk']"
            >
              Contact support
            </button>
          </div>
        </div>

        <div className="mt-8 w-full max-w-3xl rounded-3xl border border-gray-100 bg-white p-8 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900 font-['Space_Grotesk']">Website health monitoring</h2>
              <p className="mt-2 text-sm text-gray-500 font-['Space_Grotesk']">
                Stack-aware checks for connected websites, segmented by platform technology.
              </p>
              <p className="mt-1 text-xs text-gray-400 font-['Space_Grotesk']">
                Last checked: {lastCheckedAt ? new Date(lastCheckedAt).toLocaleString() : 'Pending'} · Auto refresh every 60s
              </p>
            </div>

            {workspaceHealth.length > 1 && (
              <label className="text-sm text-gray-600 font-['Space_Grotesk']">
                Workspace
                <select
                  value={selectedWorkspace?.workspaceId || ''}
                  onChange={(event) => setSelectedWorkspaceId(event.target.value)}
                  className="ml-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
                >
                  {workspaceHealth.map((item) => (
                    <option key={item.workspaceId} value={item.workspaceId}>
                      {item.workspaceName}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          {healthLoading ? (
            <p className="mt-6 text-sm text-gray-500 font-['Space_Grotesk']">Loading stack health checks...</p>
          ) : healthError ? (
            <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 font-['Space_Grotesk']">
              {healthError}
            </div>
          ) : !selectedWorkspace ? (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700 font-['Space_Grotesk']">
              No connected workspace found yet. Complete setup to enable monitoring.
            </div>
          ) : (
            <>
              <div className="mt-6 flex flex-wrap gap-2">
                {selectedWorkspace.stackSegments.map((stack) => (
                  <span key={stack} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 font-['Space_Grotesk']">
                    {stackLabel(stack)}
                  </span>
                ))}
                <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-600 font-['Space_Grotesk']">
                  {selectedWorkspace.websiteType}
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-4">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <p className="text-xs text-emerald-700 font-['Space_Grotesk']">Healthy</p>
                  <p className="text-xl font-bold text-emerald-800 font-['Space_Grotesk']">{healthSummary.healthy}</p>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="text-xs text-amber-700 font-['Space_Grotesk']">Needs review</p>
                  <p className="text-xl font-bold text-amber-800 font-['Space_Grotesk']">{healthSummary.review}</p>
                </div>
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
                  <p className="text-xs text-rose-700 font-['Space_Grotesk']">Attention</p>
                  <p className="text-xl font-bold text-rose-800 font-['Space_Grotesk']">{healthSummary.critical}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs text-slate-600 font-['Space_Grotesk']">Unknown</p>
                  <p className="text-xl font-bold text-slate-800 font-['Space_Grotesk']">{healthSummary.unknown}</p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {selectedWorkspace.checks.map((check) => (
                  <div key={check.key} className={`rounded-2xl border px-4 py-3 ${statusStyle(check.status)}`}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold font-['Space_Grotesk']">{check.label}</p>
                      <span className="text-xs font-semibold font-['Space_Grotesk']">{statusLabel(check.status)}</span>
                    </div>
                    <p className="mt-1 text-sm font-['Space_Grotesk']">{check.detail}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Coming soon toast */}
        {showComingSoon && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-gray-900 text-white px-6 py-4 rounded-2xl shadow-2xl text-sm font-['Space_Grotesk'] animate-in fade-in slide-in-from-bottom-4 duration-300">
            <svg className="w-5 h-5 text-amber-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
            </svg>
            <span>Client workspace modules are being finalized in this surface.</span>
            <button onClick={() => setShowComingSoon(false)} className="ml-2 text-gray-400 hover:text-white transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="px-8 py-5 border-t border-gray-100 text-center">
        <p className="text-xs text-gray-500/50 font-['Space_Grotesk']">{branding.brandName || config.appName} · {branding.brandByline || config.brandByline}</p>
      </footer>

    </div>
  );
}
