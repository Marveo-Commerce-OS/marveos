export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { getControlCenterSnapshot } from './_lib/controlCenter';
import OverviewAnalytics, { type OverviewWorkspaceAnalyticsRow } from './_components/OverviewAnalytics';

function metricTone(type: 'good' | 'warn' | 'bad' | 'neutral') {
  if (type === 'good') return 'border-emerald-200 bg-emerald-50 text-emerald-900';
  if (type === 'warn') return 'border-amber-200 bg-amber-50 text-amber-900';
  if (type === 'bad') return 'border-red-200 bg-red-50 text-red-900';
  return 'border-slate-200 bg-white text-slate-900';
}

export default async function MasterOverviewPage() {
  const snapshot = await getControlCenterSnapshot();
  const systemTone = snapshot.metrics.systemStatus === 'Operational' ? ('good' as const) : ('warn' as const);
  const analyticsRows: OverviewWorkspaceAnalyticsRow[] = snapshot.workspaces.map((workspace) => ({
    id: workspace.id,
    country: workspace.country,
    state: workspace.state || String(workspace.businessProfile?.state || workspace.businessProfile?.stateOrRegion || workspace.businessProfile?.region || ''),
    websiteType: workspace.websiteType,
    status: workspace.status,
    connectorStatus: workspace.connectorStatus,
    supportRequired: workspace.supportRequired,
    supportAssignmentStatus: workspace.supportAssignment?.status,
    createdAt: workspace.createdAt,
  }));

  const cards = [
    { label: 'Team Members', value: snapshot.metrics.internalTeamMembers, tone: 'neutral' as const, real: true },
    { label: 'Plans Available', value: snapshot.metrics.plansAvailable, tone: 'neutral' as const, real: true },
    { label: 'Plans Sold', value: snapshot.metrics.plansSold, tone: 'good' as const, real: true },
    { label: 'Pending Deployments', value: snapshot.metrics.pendingDeployments, tone: 'warn' as const, real: true },
    { label: 'Open Support Assignments', value: snapshot.metrics.openSupportAssignments, tone: 'warn' as const, real: true },
    { label: 'Connected Websites', value: snapshot.metrics.connectedWebsites, tone: 'good' as const, real: true },
    { label: 'Failed Deployments', value: snapshot.metrics.failedDeployments, tone: snapshot.metrics.failedDeployments > 0 ? ('bad' as const) : ('good' as const), real: true },
    { label: 'Complaints', value: snapshot.metrics.complaints, tone: snapshot.metrics.complaints > 0 ? ('warn' as const) : ('good' as const), real: true },
    { label: 'System Status', value: snapshot.metrics.systemStatus, tone: systemTone, real: true },
    { label: 'Total Clients', value: snapshot.metrics.totalClients, tone: 'neutral' as const, real: true },
    { label: 'Active Workspaces', value: snapshot.metrics.activeWorkspaces, tone: 'neutral' as const, real: true },
    { label: 'Launch Blockers', value: snapshot.metrics.launchBlockers, tone: snapshot.metrics.launchBlockers > 0 ? ('bad' as const) : ('good' as const), real: true },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Marveo Master Platform</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Control Center Overview</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          This view tracks Marveo operations across all clients, workspaces, deployments, support, connectors, and launch readiness.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className={`rounded-2xl border p-4 ${metricTone(card.tone)}`}>
            <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{card.label}</p>
            <p className="mt-2 text-2xl font-bold">{card.value}</p>
            <p className="mt-2 text-xs opacity-70">Live data</p>
          </div>
        ))}
      </div>

      <OverviewAnalytics
        workspaces={analyticsRows}
        countryCatalog={snapshot.countryCatalog.map((entry) => entry.name).filter(Boolean)}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-2">
          <h2 className="text-lg font-semibold text-slate-900">Immediate operating priorities</h2>
          <ul className="mt-4 space-y-2 text-sm text-slate-700">
            <li>Pending deployments requiring handoff: {snapshot.metrics.pendingDeployments}</li>
            <li>Complaints pending triage: {snapshot.metrics.complaints}</li>
            <li>Workspaces currently blocked for launch: {snapshot.metrics.launchBlockers}</li>
            <li>Connector failures requiring intervention: {snapshot.connectorCounts.failed}</li>
          </ul>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">Quick links</h2>
          <div className="mt-4 space-y-2 text-sm">
            <Link href="/master/clients" className="block rounded-xl bg-slate-100 px-3 py-2 font-medium text-slate-800 hover:bg-slate-200">Open Clients</Link>
            <Link href="/master/workspaces" className="block rounded-xl bg-slate-100 px-3 py-2 font-medium text-slate-800 hover:bg-slate-200">Open Workspaces</Link>
            <Link href="/master/mvp-deployments" className="block rounded-xl bg-slate-100 px-3 py-2 font-medium text-slate-800 hover:bg-slate-200">Open Deployment Queue</Link>
            <Link href="/master/launch-readiness" className="block rounded-xl bg-slate-100 px-3 py-2 font-medium text-slate-800 hover:bg-slate-200">Open Launch Readiness</Link>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
        <h2 className="text-lg font-semibold text-slate-900">Billing summary status</h2>
        <p className="mt-2">Default new-workspace plan: <span className="font-semibold capitalize">{snapshot.accountPlan}</span></p>
        <p className="mt-1">Workspace usage: {snapshot.workspaces.length} / {snapshot.workspaceLimit === 999 ? 'Unlimited' : snapshot.workspaceLimit}</p>
        <p className="mt-3 text-xs text-slate-500">This reflects client subscription data, not the Marveo owner account.</p>
      </div>
    </div>
  );
}
