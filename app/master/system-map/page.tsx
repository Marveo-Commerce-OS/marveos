import Link from 'next/link';
import { getControlCenterSnapshot } from '@/app/master/_lib/controlCenter';

type SignalTone = 'good' | 'watch' | 'risk';

function signalToneClass(tone: SignalTone): string {
  if (tone === 'good') return 'border-emerald-200 bg-emerald-50 text-emerald-900';
  if (tone === 'watch') return 'border-amber-200 bg-amber-50 text-amber-900';
  return 'border-rose-200 bg-rose-50 text-rose-900';
}

function signalStrengthBars(strength: number, tone: SignalTone) {
  const activeClass = tone === 'good' ? 'bg-emerald-700/90' : tone === 'watch' ? 'bg-amber-700/90' : 'bg-rose-700/90';
  const idleClass = tone === 'good' ? 'bg-emerald-700/20' : tone === 'watch' ? 'bg-amber-700/20' : 'bg-rose-700/20';

  return (
    <div className="mt-2 flex items-end gap-1" aria-label="Signal strength">
      {[1, 2, 3, 4].map((bar) => (
        <span
          key={`bar-${bar}`}
          className={`inline-block w-2 rounded-sm ${bar <= strength ? activeClass : idleClass}`}
          style={{ height: `${bar * 4 + 6}px` }}
        />
      ))}
    </div>
  );
}

export default async function SystemMapPage() {
  const snapshot = await getControlCenterSnapshot();

  const components = [
    {
      id: 'deployments',
      title: 'Deployment Pipeline',
      tone: snapshot.metrics.failedDeployments > 0 ? ('risk' as const) : snapshot.metrics.pendingDeployments > 0 ? ('watch' as const) : ('good' as const),
      strength: snapshot.metrics.failedDeployments > 0 ? 2 : snapshot.metrics.pendingDeployments > 0 ? 3 : 4,
      note: snapshot.metrics.failedDeployments > 0
        ? `${snapshot.metrics.failedDeployments} failed deployments need intervention.`
        : snapshot.metrics.pendingDeployments > 0
          ? `${snapshot.metrics.pendingDeployments} deployments are queued for action.`
          : 'Deployment queue is clear.',
      href: '/master/mvp-deployments',
    },
    {
      id: 'support',
      title: 'Support Operations',
      tone: snapshot.metrics.openSupportAssignments > 0 ? ('watch' as const) : ('good' as const),
      strength: snapshot.metrics.openSupportAssignments > 6 ? 2 : snapshot.metrics.openSupportAssignments > 0 ? 3 : 4,
      note: snapshot.metrics.openSupportAssignments > 0
        ? `${snapshot.metrics.openSupportAssignments} support assignments are still open.`
        : 'Support queue is stable.',
      href: '/master/support',
    },
    {
      id: 'connectors',
      title: 'Connector Network',
      tone: snapshot.connectorCounts.failed > 0 ? ('risk' as const) : snapshot.connectorCounts.pending > 0 ? ('watch' as const) : ('good' as const),
      strength: snapshot.connectorCounts.failed > 0 ? 2 : snapshot.connectorCounts.pending > 0 ? 3 : 4,
      note: snapshot.connectorCounts.failed > 0
        ? `${snapshot.connectorCounts.failed} connector integrations are failing.`
        : snapshot.connectorCounts.pending > 0
          ? `${snapshot.connectorCounts.pending} connectors are waiting verification.`
          : 'Connector state is healthy.',
      href: '/master/connectors',
    },
    {
      id: 'launch',
      title: 'Launch Readiness',
      tone: snapshot.metrics.launchBlockers > 0 ? ('risk' as const) : ('good' as const),
      strength: snapshot.metrics.launchBlockers > 5 ? 1 : snapshot.metrics.launchBlockers > 0 ? 2 : 4,
      note: snapshot.metrics.launchBlockers > 0
        ? `${snapshot.metrics.launchBlockers} workspaces are blocked from launch.`
        : 'No launch blockers detected.',
      href: '/master/launch-readiness',
    },
    {
      id: 'billing',
      title: 'Billing and Plans',
      tone: snapshot.metrics.plansSold > 0 ? ('good' as const) : ('watch' as const),
      strength: snapshot.metrics.plansSold > 0 ? 4 : 3,
      note: snapshot.metrics.plansSold > 0
        ? `${snapshot.metrics.plansSold} active plan subscriptions in circulation.`
        : 'No active plan sales recorded yet.',
      href: '/master/billing',
    },
    {
      id: 'core',
      title: 'Core Platform Settings',
      tone: snapshot.metrics.systemStatus === 'Operational' ? ('good' as const) : ('watch' as const),
      strength: snapshot.metrics.systemStatus === 'Operational' ? 4 : 3,
      note: snapshot.metrics.systemStatus === 'Operational'
        ? 'Core configuration and controls are operational.'
        : 'Core settings indicate degraded platform posture.',
      href: '/master/system-settings',
    },
  ];

  const externalComponents = [
    {
      id: 'vercel',
      title: 'Vercel Platform',
      service: 'Hosting and deployments',
      statusUrl: 'https://www.vercel-status.com/',
      note: 'Use this when deployments fail, previews stall, or edge routing is unstable.',
    },
    {
      id: 'postgres',
      title: 'Managed Postgres',
      service: 'Primary data persistence',
      statusUrl: 'https://status.neon.tech/',
      note: 'Check this for elevated query latency, connection failures, or write instability.',
    },
    {
      id: 'blob',
      title: 'Vercel Blob Storage',
      service: 'Media upload and file retrieval',
      statusUrl: 'https://www.vercel-status.com/',
      note: 'Review when media upload, retrieval, or signed access paths degrade.',
    },
    {
      id: 'github',
      title: 'GitHub',
      service: 'Repository and release operations',
      statusUrl: 'https://www.githubstatus.com/',
      note: 'Useful when release checks, tags, or plugin update retrieval is disrupted.',
    },
    {
      id: 'paystack',
      title: 'Paystack',
      service: 'Payment verification and onboarding billing',
      statusUrl: 'https://status.paystack.com/',
      note: 'Check during payment verification failures or delayed transaction confirmations.',
    },
    {
      id: 'resend',
      title: 'Resend',
      service: 'Email API delivery path',
      statusUrl: 'https://status.resend.com/',
      note: 'Check when outbound transactional notifications fail under Resend provider mode.',
    },
    {
      id: 'ses',
      title: 'Amazon SES and AWS',
      service: 'Email relay and cloud dependency health',
      statusUrl: 'https://status.aws.amazon.com/',
      note: 'Use when SES SMTP or AWS-managed email paths show regional disruption.',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Marveo Master Platform</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">System Components Tracker</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          This view tracks the operating components that make up the platform. Each signal reflects operational posture and links to the working module.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {components.map((component) => (
          <Link
            key={component.id}
            href={component.href}
            className={`rounded-2xl border p-4 transition hover:shadow-md ${signalToneClass(component.tone)}`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide opacity-75">{component.title}</p>
            {signalStrengthBars(component.strength, component.tone)}
            <p className="mt-3 text-sm font-medium">{component.note}</p>
            <p className="mt-2 text-xs opacity-75">Open component module</p>
          </Link>
        ))}
      </div>

      <div className="space-y-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">External Dependencies</h2>
          <p className="mt-1 text-sm text-slate-600">
            These monitors help detect global provider incidents that can cascade into Marveo operations.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {externalComponents.map((component) => (
            <a
              key={component.id}
              href={component.statusUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:shadow-md"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{component.title}</p>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-700">Status Page</span>
              </div>
              <p className="mt-3 text-sm font-medium text-slate-900">{component.service}</p>
              <p className="mt-2 text-xs text-slate-600">{component.note}</p>
              <p className="mt-3 text-xs font-medium text-slate-700">Open external monitor</p>
            </a>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
        <p className="font-semibold text-slate-900">How to read this</p>
        <p className="mt-2">Signals show operational health guidance based on platform metrics. They are not low-level infrastructure telemetry.</p>
      </div>
    </div>
  );
}
