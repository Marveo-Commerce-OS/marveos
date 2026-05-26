import Link from 'next/link';
import { getSession, hasClientWorkspaceAccess, hasInternalPlatformAccess, isSuperAdmin, normalizeRoles } from '@/lib/auth';
import { ensureWorkspaceSupportChatPin, readAdminStore, type WorkspaceOrchestration } from '@/lib/adminStore';
import { hasProfessionConfig, resolveProfessionConfig } from '@/config/professions';
import { buildWorkspaceDashboardSummary } from '@/modules/reports';

function resolveWorkspace(
  workspaces: WorkspaceOrchestration[],
  users: Record<string, { assignedWorkspaceId?: string }>,
  sessionUserId: string,
): WorkspaceOrchestration | null {
  if (!workspaces.length) return null;

  const assignedWorkspaceId = users[sessionUserId]?.assignedWorkspaceId;
  if (assignedWorkspaceId) {
    const assigned = workspaces.find((workspace) => workspace.id === assignedWorkspaceId);
    if (assigned) return assigned;
  }

  return workspaces[0] || null;
}

function getExplicitProfessionKey(workspace: WorkspaceOrchestration): string | undefined {
  const profile = (workspace.businessProfile || {}) as Record<string, unknown>;
  const collected = (workspace.collectedBusinessData || {}) as Record<string, unknown>;

  const explicit = String(profile.professionKey || collected.professionKey || '').trim().toLowerCase();
  return explicit || undefined;
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

const WIDGET_TITLE_MAP: Record<string, string> = {
  todaysbookings: "Today's Bookings",
  pendingdeposits: 'Pending Deposits',
  newwhatsappenquiries: 'New WhatsApp Enquiries',
  whatsappsetupstatus: 'WhatsApp Setup Status',
  aiassistantstatus: 'AI Assistant Status',
  revenuesnapshot: 'Revenue Snapshot',
  availabilitiesetup: 'Availability Setup',
  onboardingchecklist: 'Onboarding Checklist',
  quickactions: 'Quick Actions',
};

function normalizeWidgetLabel(value: string): string {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function displayWidgetTitle(value: string): string {
  return WIDGET_TITLE_MAP[normalizeWidgetLabel(value)] || value;
}

function widgetCountLabel(count: number, singular: string, plural: string = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function widgetBodyFor(widget: string, summary: ReturnType<typeof buildWorkspaceDashboardSummary>, isMakeupProfession: boolean): string {
  const normalized = normalizeWidgetLabel(widget);
  const signals = summary.dashboardSignals;

  switch (normalized) {
    case 'todays bookings':
      return summary.widgets.todaysBookings.count > 0
        ? `${widgetCountLabel(summary.widgets.todaysBookings.count, 'booking')} scheduled today.`
        : 'No bookings yet. Once clients confirm appointments, they will appear here.';
    case 'pending deposits':
      return summary.widgets.pendingDeposits.count > 0
        ? `${widgetCountLabel(summary.widgets.pendingDeposits.count, 'pending deposit')} totaling ${formatCurrency(summary.widgets.pendingDeposits.amount, summary.widgets.pendingDeposits.currency)}.`
        : 'No pending deposits yet. Deposit requests will show up here once booking payments begin.';
    case 'new whatsapp enquiries':
    case 'new leads':
      return summary.widgets.newEnquiries.count > 0
        ? `${widgetCountLabel(summary.widgets.newEnquiries.count, 'new enquiry')} need attention.`
        : 'No enquiries yet. Connect your channels and new requests will arrive here.';
    case 'ai assistant status':
      return summary.widgets.aiAssistantStatus.enabled
        ? 'AI Assistant is enabled for this workspace.'
        : 'AI Assistant is not enabled yet. Configure it when your service catalog and response rules are ready.';
    case 'whatsapp setup status':
      return summary.widgets.whatsappStatus.connected
        ? 'WhatsApp is connected and ready for inbound conversations.'
        : `${summary.widgets.whatsappStatus.label}. Connect WhatsApp so Marveo can help you capture enquiries.`;
    case 'revenue snapshot':
    case 'monthly revenue':
      return (summary.widgets.revenueSnapshot.today > 0 || summary.widgets.revenueSnapshot.month > 0)
        ? `Today: ${formatCurrency(summary.widgets.revenueSnapshot.today, summary.widgets.revenueSnapshot.currency)}. Month: ${formatCurrency(summary.widgets.revenueSnapshot.month, summary.widgets.revenueSnapshot.currency)}.`
        : 'Revenue data will appear after your first confirmed transactions.';
    case 'availability setup':
      return 'Set your availability so clients know when they can book.';
    case 'onboarding checklist':
      return `${summary.widgets.onboardingChecklist.completed}/${summary.widgets.onboardingChecklist.total} completed. ${isMakeupProfession ? 'Finish setup to unlock smoother client operations.' : 'Complete setup to personalize your workspace.'}`;
    case 'quick actions':
      return isMakeupProfession
        ? 'Use quick actions to prepare your service catalog and availability.'
        : 'Use quick actions to finish setup and start operations.';
    case 'open tickets':
    case 'support tickets':
    case 'client tickets':
      return `${widgetCountLabel(Number(signals.openTicketsCount || 0), 'open ticket')} waiting for review.`;
    case 'live chat queue':
      return `${widgetCountLabel(Number(signals.liveChatQueueCount || 0), 'live chat conversation')} waiting in the queue.`;
    case 'website enquiries':
      return `${widgetCountLabel(Number(signals.websiteEnquiriesCount || 0), 'website enquiry')} ready for follow-up.`;
    case 'active clients':
      return `${widgetCountLabel(Number(signals.activeClientsCount || 0), 'active client')} in the workspace.`;
    case 'active subscriptions':
      return `${widgetCountLabel(Number(signals.activeSubscriptionsCount || 0), 'active subscription')} currently billed.`;
    case 'support response time':
      return `Average response time: ${String(signals.supportResponseTime || 'Not tracked yet')}.`;
    case 'onboarding requests':
      return `${widgetCountLabel(Number(signals.onboardingRequestsCount || 0), 'onboarding request')} awaiting review.`;
    case 'website setup status':
      return `Website setup is ${String(signals.websiteSetupStatus || 'pending')}.`;
    case 'active projects':
      return `${widgetCountLabel(Number(signals.activeProjectsCount || 0), 'active project')} in progress.`;
    case 'pending milestones':
      return `${widgetCountLabel(Number(signals.pendingMilestonesCount || 0), 'pending milestone')} need attention.`;
    case 'open client tickets':
      return `${widgetCountLabel(Number(signals.openClientTicketsCount || 0), 'open client ticket')} waiting for review.`;
    case 'delivery risk':
      return `Delivery risk is ${String(signals.deliveryRisk || 'On track')}.`;
    case 'team workload':
      return String(signals.teamWorkload || 'No team workload data yet.');
    case 'urgent issues':
      return `${widgetCountLabel(Number(signals.urgentIssuesCount || 0), 'urgent issue')} need immediate attention.`;
    case 'assigned technicians':
      return `${widgetCountLabel(Number(signals.assignedTechniciansCount || 0), 'assigned technician')} available for support.`;
    case 'sla watch':
      return Number(signals.urgentIssuesCount || 0) > 0
        ? 'SLA watch is active because urgent issues are open.'
        : 'SLA watch is on track right now.';
    case 'resolved this month':
      return `${widgetCountLabel(Number(signals.resolvedThisMonthCount || 0), 'resolved ticket')} closed this month.`;
    case 'campaign leads':
      return `${widgetCountLabel(Number(signals.campaignLeadsCount || 0), 'campaign lead')} captured from campaigns.`;
    case 'pending invoices':
      return `${widgetCountLabel(Number(signals.pendingInvoicesCount || 0), 'pending invoice')} awaiting payment.`;
    case 'new consultation requests':
      return `${widgetCountLabel(Number(signals.newConsultationRequestsCount || 0), 'consultation request')} waiting for review.`;
    case 'active automation projects':
      return `${widgetCountLabel(Number(signals.activeAutomationProjectsCount || 0), 'automation project')} in progress.`;
    case 'pending proposals':
      return `${widgetCountLabel(Number(signals.pendingProposalsCount || 0), 'pending proposal')} waiting for client approval.`;
    case 'workflow opportunities':
      return `${widgetCountLabel(Number(signals.workflowOpportunitiesCount || 0), 'workflow opportunity')} ready to automate.`;
    default:
      return `Monitor ${displayWidgetTitle(widget)} from your workspace data.`;
  }
}

export default async function OsDashboardPage() {
  const session = await getSession();
  if (!session) {
    return <div className="p-8 text-sm text-slate-600">Sign in to access your workspace dashboard.</div>;
  }

  const roles = normalizeRoles(session.user?.roles);
  if (!hasClientWorkspaceAccess(roles) && !hasInternalPlatformAccess(roles)) {
    return <div className="p-8 text-sm text-slate-600">You do not currently have workspace access.</div>;
  }

  const store = await readAdminStore();
  const allWorkspaces = Object.values(store.cloud.workspaces).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const sessionUserId = String(session.user?.id ?? session.user?.ID ?? '').trim();
  const workspace = resolveWorkspace(allWorkspaces, store.users as Record<string, { assignedWorkspaceId?: string }>, sessionUserId);

  if (!workspace) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <div className="mx-auto max-w-5xl rounded-3xl border border-slate-200 bg-white p-8">
          <h1 className="text-2xl font-semibold text-slate-900">Workspace Dashboard</h1>
          <p className="mt-3 text-sm text-slate-600">No workspace is available yet. Complete setup to start managing bookings, enquiries, and client operations.</p>
        </div>
      </div>
    );
  }

  const explicitProfessionKey = getExplicitProfessionKey(workspace);
  const professionConfigured = explicitProfessionKey ? hasProfessionConfig(explicitProfessionKey) : false;
  const profession = resolveProfessionConfig(explicitProfessionKey);
  const isMakeupProfession = profession.key === 'makeup-artist' && professionConfigured;
  const professionIncomplete = !explicitProfessionKey;
  const summary = buildWorkspaceDashboardSummary({
    workspace,
    professionKey: profession.key,
    professionName: profession.professionName,
  });
  const isRootSuperAdmin = await isSuperAdmin(session.token);
  const canViewSupportPin = hasClientWorkspaceAccess(roles) || isRootSuperAdmin;
  const supportPin = canViewSupportPin ? await ensureWorkspaceSupportChatPin(workspace.id) : null;
  const maskedSupportPin = supportPin ? `${'*'.repeat(Math.max(0, supportPin.length - 2))}${supportPin.slice(-2)}` : null;
  const checklist = summary.widgets.onboardingChecklist.items;

  const widgetCards = (summary.dashboardWidgets.length > 0 ? summary.dashboardWidgets : profession.dashboardWidgets).map((widget) => ({
    title: displayWidgetTitle(widget),
    body: widgetBodyFor(widget, summary, isMakeupProfession),
  }));

  const quickActions = summary.quickActions.map((action) => String(action));

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 md:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Marveo OS</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">{profession.professionName} Dashboard</h1>
          <p className="mt-2 text-sm text-slate-600">
            Profession-aware workspace for {profession.sector}. This slice focuses on the modules enabled for your selected profession.
          </p>
          {professionIncomplete && (
            <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Complete your business profile to personalize your workspace.
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {profession.enabledModules.map((moduleKey) => (
              <span key={moduleKey} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                {moduleKey}
              </span>
            ))}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          {widgetCards.map((widget) => (
            <article key={widget.title} className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="text-base font-semibold text-slate-900">{widget.title}</h2>
              <p className="mt-2 text-sm text-slate-600">{widget.body}</p>
            </article>
          ))}
        </section>

        {canViewSupportPin ? (
          <section className="rounded-2xl border border-sky-100 bg-sky-50 p-5">
            <h2 className="text-base font-semibold text-slate-900">Support PIN</h2>
            <p className="mt-2 text-sm text-slate-600">Use this PIN only for technical support live chat. General enquiry chat does not require a PIN.</p>
            <div className="mt-3 inline-flex rounded-2xl border border-sky-200 bg-white px-4 py-3">
              <span className="text-2xl font-bold tracking-[0.3em] text-sky-900">{isRootSuperAdmin ? (supportPin || '------') : (maskedSupportPin || '------')}</span>
            </div>
            {!isRootSuperAdmin ? <p className="mt-2 text-xs text-slate-500">Masked for session safety. Reveal is restricted to authorized secure views.</p> : null}
            <div className="mt-3">
              <Link href="/os/support/live-chat" className="inline-flex rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white">Open Live Support Chat</Link>
            </div>
          </section>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-base font-semibold text-slate-900">Onboarding Checklist</h2>
            <p className="mt-2 text-sm text-slate-600">{isMakeupProfession ? 'Add your bridal, studio, and home-service packages.' : 'Complete your setup steps to personalize your workspace.'}</p>
            <ul className="mt-4 space-y-2 text-sm text-slate-700">
              {checklist.map((item) => (
                <li key={item.key} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2">
                  <span>{item.label}</span>
                  <span className={`text-xs font-medium ${item.done ? 'text-emerald-700' : 'text-slate-500'}`}>
                    {item.done ? 'Done' : 'Pending'}
                  </span>
                </li>
              ))}
            </ul>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-base font-semibold text-slate-900">Quick Actions</h2>
            <p className="mt-2 text-sm text-slate-600">{isMakeupProfession ? 'Set your availability so clients know when they can book.' : 'Use quick actions to finish setup and start operations.'}</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {quickActions.map((action) => (
                <button
                  key={action}
                  type="button"
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm font-medium text-slate-700"
                >
                  {action}
                </button>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              <Link href="/os/orders" className="font-medium text-slate-800 underline underline-offset-4">Open Orders Surface</Link>
              <Link href="/setup/mvp" className="font-medium text-slate-800 underline underline-offset-4">Return to Setup</Link>
            </div>
          </article>
        </section>
      </div>
    </div>
  );
}
