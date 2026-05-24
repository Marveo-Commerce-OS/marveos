export const dynamic = 'force-dynamic';

import { getControlCenterSnapshot } from '../_lib/controlCenter';

const PINNED_COUNTRIES = [
  'Nigeria',
  'United Arab Emirates',
  'United Kingdom',
  'United States',
  'Canada',
  'Kenya',
  'South Africa',
];

function barWidth(value: number, max: number): string {
  if (max <= 0 || value <= 0) return '0%';
  return `${Math.max(4, Math.round((value / max) * 100))}%`;
}

export default async function MasterAnalyticsPage() {
  const snapshot = await getControlCenterSnapshot();

  // Build country usage map from workspaces
  const countryMap: Record<string, number> = {};
  for (const workspace of snapshot.workspaces) {
    const key = (workspace.country || 'Unknown').trim() || 'Unknown';
    countryMap[key] = (countryMap[key] || 0) + 1;
  }

  // Pinned countries always shown first (even at 0), then dynamic remainder sorted by count
  const pinnedSet = new Set(PINNED_COUNTRIES);
  const pinnedCountryUsage = PINNED_COUNTRIES.map((name) => [name, countryMap[name] || 0] as [string, number]);
  const dynamicCountryUsage = Object.entries(countryMap)
    .filter(([name]) => !pinnedSet.has(name))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  const countryUsage = [...pinnedCountryUsage, ...dynamicCountryUsage];

  // State/region breakdown from businessProfile
  const stateMap: Record<string, number> = {};
  for (const workspace of snapshot.workspaces) {
    const s = (
      workspace.state ||
      String(workspace.businessProfile?.state || workspace.businessProfile?.stateOrRegion || workspace.businessProfile?.region || '')
    ).trim();
    if (s) {
      stateMap[s] = (stateMap[s] || 0) + 1;
    }
  }
  const stateUsage = Object.entries(stateMap).sort((a, b) => b[1] - a[1]).slice(0, 15);

  const usageByHour = Array.from({ length: 24 }, (_, hour) => {
    const value = snapshot.audit.filter((entry) => {
      const date = new Date(entry.at);
      return !Number.isNaN(date.getTime()) && date.getHours() === hour;
    }).length;
    return { hour, value };
  });

  const maxHourUsage = Math.max(1, ...usageByHour.map((point) => point.value));

  const stackBreakdown = {
    wordpress: snapshot.workspaces.filter((workspace) => workspace.contentSource === 'wordpress').length,
    nextjs: snapshot.workspaces.filter((workspace) => workspace.contentSource === 'nextjs').length,
    newWebsite: snapshot.workspaces.filter((workspace) => workspace.websiteType === 'NEW_WEBSITE').length,
    existingWebsite: snapshot.workspaces.filter((workspace) => workspace.websiteType === 'EXISTING_WEBSITE').length,
    customHeadless: snapshot.workspaces.filter((workspace) => workspace.websiteType === 'CUSTOM_HEADLESS').length,
  };

  const onVercel = process.env.VERCEL === '1';
  const vercelEnv = process.env.VERCEL_ENV || 'local';
  const vercelRegion = process.env.VERCEL_REGION || 'unknown';
  const infraHealthy = snapshot.metrics.failedDeployments === 0 && snapshot.metrics.systemStatus === 'Operational';

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Platform Intelligence</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Analytics</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Global usage, behavior timing, stack footprint, and infrastructure health for operational and strategic planning.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Markets Tracked</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{countryUsage.filter(([, v]) => v > 0).length} active</p>
          <p className="mt-1 text-xs text-slate-500">{PINNED_COUNTRIES.length} priority + {dynamicCountryUsage.length} others</p>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-blue-900">
          <p className="text-xs font-semibold uppercase tracking-wide">Audit Events</p>
          <p className="mt-2 text-2xl font-bold">{snapshot.audit.length}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
          <p className="text-xs font-semibold uppercase tracking-wide">Platform Status</p>
          <p className="mt-2 text-2xl font-bold">{snapshot.metrics.systemStatus}</p>
        </div>
        <div className={`rounded-2xl border p-4 ${infraHealthy ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
          <p className="text-xs font-semibold uppercase tracking-wide">Vercel Health</p>
          <p className="mt-2 text-2xl font-bold">{infraHealthy ? 'OK' : 'Attention'}</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 xl:col-span-3">
          <h2 className="text-lg font-semibold text-slate-900">Where People Are Using Marveo</h2>
          <p className="mt-1 text-xs text-slate-500">Priority markets pinned · dynamic additions below</p>
          <div className="mt-4 space-y-3">
            {countryUsage.map(([name, value], idx) => {
              const isPinned = idx < PINNED_COUNTRIES.length;
              const max = Math.max(1, ...countryUsage.map(([, v]) => v));
              return (
                <div key={name}>
                  {isPinned && idx === 0 && (
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Priority Markets</p>
                  )}
                  {!isPinned && idx === PINNED_COUNTRIES.length && (
                    <p className="mb-2 mt-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Other Markets</p>
                  )}
                  <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
                    <span className={isPinned ? 'font-medium text-slate-800' : ''}>{name}</span>
                    <span>{value}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div
                      className={`h-2 rounded-full ${isPinned ? 'bg-blue-700' : 'bg-slate-500'}`}
                      style={{ width: barWidth(value, max) }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 xl:col-span-2">
          <h2 className="text-lg font-semibold text-slate-900">When They Use It</h2>
          <p className="mt-1 text-xs text-slate-500">Audit event density by hour (0-23)</p>
          <div className="mt-4 space-y-2">
            {usageByHour.map((point) => (
              <div key={point.hour} className="grid grid-cols-[40px_1fr_28px] items-center gap-2 text-xs text-slate-600">
                <span>{String(point.hour).padStart(2, '0')}</span>
                <div className="h-2 rounded-full bg-slate-100">
                  <div className="h-2 rounded-full bg-blue-700" style={{ width: barWidth(point.value, maxHourUsage) }} />
                </div>
                <span className="text-right">{point.value}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-2">
          <h2 className="text-lg font-semibold text-slate-900">Usage by State / Region</h2>
          <p className="mt-1 text-xs text-slate-500">Top states/regions derived from workspace business profiles</p>
          {stateUsage.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">No state data yet. State is collected during workspace onboarding from the business profile.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {stateUsage.map(([name, value]) => {
                const max = Math.max(1, stateUsage[0]?.[1] || 1);
                return (
                  <div key={name}>
                    <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
                      <span>{name}</span>
                      <span>{value}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div className="h-2 rounded-full bg-indigo-600" style={{ width: barWidth(value, max) }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">Operational Pressure</h2>
          <ul className="mt-4 space-y-2 text-sm text-slate-700">
            <li>Open support assignments: {snapshot.metrics.openSupportAssignments}</li>
            <li>Launch blockers: {snapshot.metrics.launchBlockers}</li>
            <li>Failed deployments: {snapshot.metrics.failedDeployments}</li>
            <li>Connected websites: {snapshot.metrics.connectedWebsites}</li>
            <li>Plans sold: {snapshot.metrics.plansSold}</li>
          </ul>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">Stack Data</h2>
          <ul className="mt-4 space-y-2 text-sm text-slate-700">
            <li>WordPress source workspaces: {stackBreakdown.wordpress}</li>
            <li>Next.js source workspaces: {stackBreakdown.nextjs}</li>
            <li>New website builds: {stackBreakdown.newWebsite}</li>
            <li>Existing website upgrades: {stackBreakdown.existingWebsite}</li>
            <li>Custom/headless projects: {stackBreakdown.customHeadless}</li>
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">Vercel and Runtime</h2>
          <ul className="mt-4 space-y-2 text-sm text-slate-700">
            <li>Hosted on Vercel: {onVercel ? 'Yes' : 'No / Local'}</li>
            <li>Environment: {vercelEnv}</li>
            <li>Region: {vercelRegion}</li>
            <li>Node runtime: {process.version}</li>
            <li>Maintenance mode: {snapshot.maintenance.site_under_construction ? 'On' : 'Off'}</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
