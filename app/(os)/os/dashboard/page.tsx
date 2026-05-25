import Link from 'next/link';
import { getSession, hasClientWorkspaceAccess, hasInternalPlatformAccess, normalizeRoles } from '@/lib/auth';
import { readAdminStore, type WorkspaceOrchestration } from '@/lib/adminStore';
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
  const checklist = summary.widgets.onboardingChecklist.items;

  const widgetCards = [
    {
      title: "Today's Bookings",
      body: summary.widgets.todaysBookings.count > 0
        ? `${summary.widgets.todaysBookings.count} booking(s) scheduled today.`
        : 'No bookings yet. Once clients confirm appointments, they will appear here.',
    },
    {
      title: 'Pending Deposits',
      body: summary.widgets.pendingDeposits.count > 0
        ? `${summary.widgets.pendingDeposits.count} pending deposit(s) totaling ${formatCurrency(summary.widgets.pendingDeposits.amount, summary.widgets.pendingDeposits.currency)}.`
        : 'No pending deposits yet. Deposit requests will show up here once booking payments begin.',
    },
    {
      title: 'New Enquiries',
      body: summary.widgets.newEnquiries.count > 0
        ? `${summary.widgets.newEnquiries.count} new enquiry/enquiries need attention.`
        : 'No enquiries yet. Connect your channels and new requests will arrive here.',
    },
    {
      title: 'WhatsApp Setup Status',
      body: summary.widgets.whatsappStatus.connected
        ? 'WhatsApp is connected and ready for inbound conversations.'
        : `${summary.widgets.whatsappStatus.label}. Connect WhatsApp so Marveo can help you capture enquiries.`,
    },
    {
      title: 'AI Assistant Status',
      body: summary.widgets.aiAssistantStatus.enabled
        ? 'AI Assistant is enabled for this workspace.'
        : 'AI Assistant is not enabled yet. Configure it when your service catalog and response rules are ready.',
    },
    {
      title: 'Revenue Snapshot',
      body: (summary.widgets.revenueSnapshot.today > 0 || summary.widgets.revenueSnapshot.month > 0)
        ? `Today: ${formatCurrency(summary.widgets.revenueSnapshot.today, summary.widgets.revenueSnapshot.currency)}. Month: ${formatCurrency(summary.widgets.revenueSnapshot.month, summary.widgets.revenueSnapshot.currency)}.`
        : 'Revenue data will appear after your first confirmed bookings and payment captures.',
    },
    {
      title: 'Onboarding Checklist',
      body: `${summary.widgets.onboardingChecklist.completed}/${summary.widgets.onboardingChecklist.total} completed. ${isMakeupProfession ? 'Finish setup to unlock smoother client operations.' : 'Complete setup to personalize your workspace.'}`,
    },
    {
      title: 'Quick Actions',
      body: isMakeupProfession
        ? 'Set your availability so clients know when they can book.'
        : 'Use quick actions to finish setup and start operations.',
    },
  ];

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
