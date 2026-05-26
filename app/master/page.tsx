export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getControlCenterSnapshot } from './_lib/controlCenter';
import { getSession, isSuperAdmin, resolveSessionMarveoRoles, type MarveoRole } from '@/lib/auth';
import { readAdminStore } from '@/lib/adminStore';
import { resolveMasterRoleDashboard, type DashboardMetricCardKey, type MasterInternalRole } from '@/lib/master/roleDashboard';
import { getSupportSessionStoreSnapshot } from '@/lib/support-access/createSupportSession';
import { listMyAssignments, listOperationalActivityForRole } from '@/lib/master/operations';
import OverviewAnalytics, { type OverviewWorkspaceAnalyticsRow } from './_components/OverviewAnalytics';

function metricTone(type: 'good' | 'warn' | 'bad' | 'neutral') {
  if (type === 'good') return 'border-emerald-200 bg-emerald-50 text-emerald-900';
  if (type === 'warn') return 'border-amber-200 bg-amber-50 text-amber-900';
  if (type === 'bad') return 'border-red-200 bg-red-50 text-red-900';
  return 'border-slate-200 bg-white text-slate-900';
}

const INTERNAL_ROLE_PRIORITY: MasterInternalRole[] = [
  'SUPER_ADMIN',
  'ADMIN',
  'TECHNICAL_SUPPORT',
  'CUSTOMER_SUPPORT',
  'DEPLOYMENT_MANAGER',
  'BILLING_MANAGER',
];

function resolveEffectiveInternalRole(masterRole: MarveoRole | null, marveoRoles: MarveoRole[]): MasterInternalRole | null {
  if (masterRole && INTERNAL_ROLE_PRIORITY.includes(masterRole as MasterInternalRole)) {
    return masterRole as MasterInternalRole;
  }

  for (const role of INTERNAL_ROLE_PRIORITY) {
    if (marveoRoles.includes(role)) {
      return role;
    }
  }

  return null;
}

function isOpenTicketStatus(status: string) {
  return status === 'open' || status === 'awaiting_support' || status === 'awaiting_client' || status === 'in_progress';
}

function withinHours(iso: string, hours: number): boolean {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t <= hours * 60 * 60 * 1000;
}

export default async function MasterOverviewPage() {
  const session = await getSession();
  if (!session) redirect('/master-login?error=auth_required&from=/master');

  const roleContext = await resolveSessionMarveoRoles(session.user);
  const roles = roleContext.marveoRoles;
  const superAdmin = await isSuperAdmin(session.token);

  const effectiveRole = superAdmin
    ? ('SUPER_ADMIN' as const)
    : resolveEffectiveInternalRole(roleContext.masterRole, roles);

  if (!effectiveRole) {
    // Layout already blocks non-admin; this is a defensive fallback.
    redirect('/master-login?error=unauthorized&from=/master');
  }

  const dashboard = resolveMasterRoleDashboard(effectiveRole);
  const snapshot = await getControlCenterSnapshot();
  const store = await readAdminStore();

  const currentUserId = String(session.user?.id ?? session.user?.ID ?? '').trim();
  const allTickets = Object.values(store.cloud.ticketing.tickets);
  const openTickets = allTickets.filter((ticket) => isOpenTicketStatus(ticket.status));

  const scopedTickets = (() => {
    if (effectiveRole === 'SUPER_ADMIN' || effectiveRole === 'ADMIN') return openTickets;
    if (!currentUserId) return [];
    return openTickets.filter((ticket) => ticket.assignedTo === currentUserId);
  })();

  const myAssignedTickets = scopedTickets.length;
  const openComplaints = scopedTickets.filter((ticket) => ticket.category === 'complaint').length;
  const awaitingClientResponse = scopedTickets.filter((ticket) => ticket.status === 'awaiting_client').length;
  const newEnquiries = scopedTickets.filter((ticket) => ticket.category === 'general_enquiry').length;
  const websiteSupportRequests = scopedTickets.filter((ticket) => ticket.category === 'website_support').length;
  const whatsappIntegrationRequests = scopedTickets.filter((ticket) => ticket.category === 'whatsapp_integration').length;
  const escalatedTickets = scopedTickets.filter((ticket) => ticket.priority === 'urgent').length;
  const recentClientActivity = scopedTickets.filter((ticket) => withinHours(ticket.updatedAt, 24)).length;

  const connectorIssues = snapshot.workspaces.filter((workspace) => workspace.connectorStatus === 'FAILED' || workspace.connectorStatus === 'SUPPORT_REQUIRED').length;
  const integrationValidationPending = snapshot.workspaces.filter((workspace) => workspace.connectorStatus === 'PENDING_VERIFICATION' || workspace.connectorStatus === 'TOKEN_GENERATED').length;
  const wordpressConnectorStatus = snapshot.connectorCounts.connected;
  const websiteTechnicalIssues = scopedTickets.filter((ticket) => ticket.category === 'technical_support' || ticket.category === 'website_support').length;
  const assignedTechnicalTickets = scopedTickets.filter((ticket) => ticket.category === 'technical_support' || ticket.category === 'website_support' || ticket.category === 'whatsapp_integration').length;

  const supportSessions = Array.from(getSupportSessionStoreSnapshot().values());
  const supportSessionsPending = supportSessions.filter((sessionRow) => {
    if (!currentUserId) return false;
    if (sessionRow.supportUserId !== currentUserId) return false;
    if (sessionRow.revokedAt) return false;
    return new Date(sessionRow.expiresAt).getTime() > Date.now();
  }).length;

  const workspacesAwaitingSetup = snapshot.workspaces.filter((workspace) => workspace.status === 'draft' || workspace.status === 'onboarding').length;
  const launchReadiness = snapshot.workspaces.filter((workspace) => workspace.status === 'ready_for_launch').length;
  const domainPending = snapshot.workspaces.filter((workspace) => (workspace.missingRequirements || []).some((item) => String(item).toLowerCase().includes('domain'))).length;
  const templateConnectorSelection = snapshot.workspaces.filter((workspace) => {
    if (workspace.websiteType === 'NEW_WEBSITE') return !workspace.selectedTemplateId;
    if (workspace.websiteType === 'EXISTING_WEBSITE') return workspace.connectorStatus !== 'CONNECTED';
    return false;
  }).length;
  const deploymentStarted = snapshot.workspaces.filter((workspace) => workspace.onboardingStatus === 'DEPLOYING').length;
  const clientReviewReady = snapshot.workspaces.filter((workspace) => workspace.onboardingStatus === 'READY_FOR_REVIEW').length;
  const launchAuthorizedPending = snapshot.workspaces.filter((workspace) => workspace.onboardingStatus === 'READY_FOR_LAUNCH').length;

  const subscriptions = Object.values(store.cloud.commercial?.subscriptions ?? {});
  const pendingPayments = subscriptions.filter((sub) => sub.paymentVerificationStatus === 'PENDING').length;
  const failedPayments = subscriptions.filter((sub) => sub.paymentVerificationStatus === 'FAILED').length;
  const activeSubscriptions = subscriptions.filter((sub) => sub.status === 'ACTIVE' || sub.status === 'TRIAL' || sub.status === 'PAST_DUE').length;
  const expiredTrials = subscriptions.filter((sub) => {
    if (sub.status === 'EXPIRED') return true;
    if (sub.status !== 'TRIAL') return false;
    if (!sub.trialEndDate) return false;
    return new Date(sub.trialEndDate).getTime() < Date.now();
  }).length;
  const upgradeRequests = Object.values(store.cloud.commercial?.billingCycleChangeRequests ?? {}).filter((req) => req.status === 'PENDING_APPROVAL').length;
  const billingComplaints = openTickets.filter((ticket) => ticket.category === 'billing').length;
  const invoiceIssues = Object.values(store.cloud.commercial?.invoices ?? {}).filter((invoice) => !invoice.pdfFileName).length;

  const reportsSummary = snapshot.metrics.failedDeployments + snapshot.metrics.openSupportAssignments;
  const myAssignments = currentUserId ? await listMyAssignments(currentUserId) : [];
  const activity = await listOperationalActivityForRole(effectiveRole, currentUserId || undefined);

  const metricMap: Record<DashboardMetricCardKey, {
    label: string;
    value: string | number;
    tone: 'good' | 'warn' | 'bad' | 'neutral';
    href?: string;
    helper?: string;
  }> = {
    totalClients: { label: 'Total Clients', value: snapshot.metrics.totalClients, tone: 'neutral' },
    activeWorkspaces: { label: 'Active Workspaces', value: snapshot.metrics.activeWorkspaces, tone: 'neutral' },
    plansSold: { label: 'Plans Sold', value: snapshot.metrics.plansSold, tone: snapshot.metrics.plansSold > 0 ? 'good' : 'neutral', href: '/master/billing' },
    pendingDeployments: { label: 'Pending Deployments', value: snapshot.metrics.pendingDeployments, tone: snapshot.metrics.pendingDeployments > 0 ? 'warn' : 'good', href: '/master/mvp-deployments' },
    failedDeployments: { label: 'Failed Deployments', value: snapshot.metrics.failedDeployments, tone: snapshot.metrics.failedDeployments > 0 ? 'bad' : 'good', href: '/master/mvp-deployments' },
    launchBlockers: { label: 'Launch Blockers', value: snapshot.metrics.launchBlockers, tone: snapshot.metrics.launchBlockers > 0 ? 'bad' : 'good', href: '/master/launch-readiness' },
    openSupportAssignments: { label: 'Support Assignments', value: snapshot.metrics.openSupportAssignments, tone: snapshot.metrics.openSupportAssignments > 0 ? 'warn' : 'good', href: '/master/support' },
    complaints: { label: 'Complaints', value: snapshot.metrics.complaints, tone: snapshot.metrics.complaints > 0 ? 'warn' : 'good', href: '/master/complaints' },
    billingSnapshot: {
      label: 'Revenue/Billing Snapshot',
      value: `${snapshot.subscriptionCapacity.trackedSubscriptions} subs tracked`,
      tone: snapshot.subscriptionCapacity.overCapacity > 0 ? 'warn' : 'neutral',
      href: '/master/billing',
      helper: `${snapshot.subscriptionCapacity.overCapacity} over capacity`,
    },
    systemStatus: { label: 'System Status', value: snapshot.metrics.systemStatus, tone: snapshot.metrics.systemStatus === 'Operational' ? 'good' : 'warn', href: '/master/system-map' },
    teamMembers: { label: 'Team Members', value: snapshot.metrics.internalTeamMembers, tone: 'neutral', href: '/master/team' },
    connectedWebsites: { label: 'Connected Websites', value: snapshot.metrics.connectedWebsites, tone: 'good', href: '/master/connectors' },
    reportsSummary: { label: 'Reports Summary', value: reportsSummary, tone: reportsSummary > 0 ? 'warn' : 'good', href: '/master/reports' },

    myAssignedTickets: { label: 'My Assigned Tickets', value: myAssignedTickets, tone: myAssignedTickets > 0 ? 'warn' : 'good', href: '/master/tickets' },
    openComplaints: { label: 'Open Complaints', value: openComplaints, tone: openComplaints > 0 ? 'warn' : 'good', href: '/master/complaints' },
    awaitingClientResponse: { label: 'Awaiting Client Response', value: awaitingClientResponse, tone: awaitingClientResponse > 0 ? 'warn' : 'good', href: '/master/awaiting-client-response' },
    newEnquiries: { label: 'New Enquiries', value: newEnquiries, tone: newEnquiries > 0 ? 'warn' : 'good', href: '/master/client-enquiries' },
    websiteSupportRequests: { label: 'Website Support Requests', value: websiteSupportRequests, tone: websiteSupportRequests > 0 ? 'warn' : 'good', href: '/master/website-support-requests' },
    whatsappIntegrationRequests: { label: 'WhatsApp/Integration Requests', value: whatsappIntegrationRequests, tone: whatsappIntegrationRequests > 0 ? 'warn' : 'good', href: '/master/whatsapp-integration-requests' },
    escalatedTickets: { label: 'Escalated Tickets', value: escalatedTickets, tone: escalatedTickets > 0 ? 'bad' : 'good', href: '/master/escalated-tickets' },
    recentClientActivity: { label: 'Recent Client Activity (24h)', value: recentClientActivity, tone: recentClientActivity > 0 ? 'neutral' : 'good', href: '/master/tickets' },

    connectorIssues: { label: 'Connector Issues', value: connectorIssues, tone: connectorIssues > 0 ? 'bad' : 'good', href: '/master/connectors' },
    integrationValidationPending: { label: 'Integration Validation Pending', value: integrationValidationPending, tone: integrationValidationPending > 0 ? 'warn' : 'good', href: '/master/connectors' },
    wordpressConnectorStatus: { label: 'WordPress Connector Status', value: `${wordpressConnectorStatus} connected`, tone: wordpressConnectorStatus > 0 ? 'good' : 'warn', href: '/master/connectors' },
    websiteTechnicalIssues: { label: 'Website Technical Issues', value: websiteTechnicalIssues, tone: websiteTechnicalIssues > 0 ? 'warn' : 'good', href: '/master/technical-tickets' },
    supportSessionsPending: { label: 'Support Sessions Pending', value: supportSessionsPending, tone: supportSessionsPending > 0 ? 'warn' : 'good', href: '/master/support-sessions' },
    assignedTechnicalTickets: { label: 'Assigned Technical Tickets', value: assignedTechnicalTickets, tone: assignedTechnicalTickets > 0 ? 'warn' : 'good', href: '/master/technical-tickets' },

    workspacesAwaitingSetup: { label: 'Workspaces Awaiting Setup', value: workspacesAwaitingSetup, tone: workspacesAwaitingSetup > 0 ? 'warn' : 'good', href: '/master/workspaces' },
    launchReadiness: { label: 'Launch Readiness', value: launchReadiness, tone: launchReadiness > 0 ? 'good' : 'warn', href: '/master/launch-readiness' },
    domainPending: { label: 'Domain Pending', value: domainPending, tone: domainPending > 0 ? 'warn' : 'good', href: '/master/launch-readiness' },
    templateConnectorSelection: { label: 'Template/Connector Selection', value: templateConnectorSelection, tone: templateConnectorSelection > 0 ? 'warn' : 'good', href: '/master/mvp-deployments' },
    deploymentStarted: { label: 'Deployment Started', value: deploymentStarted, tone: deploymentStarted > 0 ? 'warn' : 'good', href: '/master/mvp-deployments' },
    clientReviewReady: { label: 'Client Review Ready', value: clientReviewReady, tone: clientReviewReady > 0 ? 'neutral' : 'good', href: '/master/mvp-deployments' },
    launchAuthorizedPending: { label: 'Launch Authorized Pending', value: launchAuthorizedPending, tone: launchAuthorizedPending > 0 ? 'warn' : 'good', href: '/master/mvp-deployments' },

    pendingPayments: { label: 'Pending Payments', value: pendingPayments, tone: pendingPayments > 0 ? 'warn' : 'good', href: '/master/billing#subscriptions' },
    failedPayments: { label: 'Failed Payments', value: failedPayments, tone: failedPayments > 0 ? 'bad' : 'good', href: '/master/billing#subscriptions' },
    activeSubscriptions: { label: 'Active Subscriptions', value: activeSubscriptions, tone: 'neutral', href: '/master/billing#subscriptions' },
    expiredTrials: { label: 'Expired Trials', value: expiredTrials, tone: expiredTrials > 0 ? 'warn' : 'good', href: '/master/billing#subscriptions' },
    upgradeRequests: { label: 'Upgrade Requests', value: upgradeRequests, tone: upgradeRequests > 0 ? 'warn' : 'good', href: '/master/billing#subscriptions' },
    billingComplaints: { label: 'Billing Complaints', value: billingComplaints, tone: billingComplaints > 0 ? 'warn' : 'good', href: '/master/payment-issues' },
    invoiceIssues: { label: 'Invoice Issues', value: invoiceIssues, tone: invoiceIssues > 0 ? 'warn' : 'good', href: '/master/billing#subscriptions' },
  };

  const cards = dashboard.visibleCards.map((key) => metricMap[key]).filter(Boolean);

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

  const showGlobalAnalytics = effectiveRole === 'SUPER_ADMIN';
  const showBillingSummary = effectiveRole === 'SUPER_ADMIN' || effectiveRole === 'BILLING_MANAGER';

  const quickLinks = (() => {
    if (effectiveRole === 'CUSTOMER_SUPPORT') {
      return [
        { key: 'tickets', label: 'Open My Tickets', href: '/master/tickets?mine=1' },
        { key: 'awaiting', label: 'Awaiting Client Response', href: '/master/awaiting-client-response' },
        { key: 'escalated', label: 'Escalated Complaints', href: '/master/escalated-tickets' },
      ];
    }

    if (effectiveRole === 'TECHNICAL_SUPPORT') {
      return [
        { key: 'connectorIssues', label: 'My Connector Issues', href: '/master/connectors' },
        { key: 'failedDeployments', label: 'Failed Deployments', href: '/master/mvp-deployments?status=failed' },
        { key: 'validationPending', label: 'Validation Pending', href: '/master/launch-readiness' },
      ];
    }

    if (effectiveRole === 'DEPLOYMENT_MANAGER') {
      return [
        { key: 'deploymentQueue', label: 'My Deployments', href: '/master/mvp-deployments' },
        { key: 'launchBlockers', label: 'Launch Blockers', href: '/master/launch-readiness' },
        { key: 'readyForReview', label: 'Ready For Review', href: '/master/mvp-deployments?status=ready_for_review' },
      ];
    }

    if (effectiveRole === 'BILLING_MANAGER') {
      return [
        { key: 'pendingPayments', label: 'Pending Payments', href: '/master/billing#subscriptions' },
        { key: 'upgradeRequests', label: 'Upgrade Requests', href: '/master/billing#subscriptions' },
        { key: 'failedActions', label: 'Failed Billing Actions', href: '/master/payment-issues' },
      ];
    }

    return dashboard.sidebar
      .flatMap((item) => (item.children?.length ? item.children : [item]))
      .filter((item) => item.href && item.href.startsWith('/master'))
      .slice(0, 5);
  })();

  const totalWorkspaces = snapshot.workspaces.length;
  const defaultPlanLimitLabel = snapshot.workspaceLimit === 999 ? 'Unlimited' : String(snapshot.workspaceLimit);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Marvéo Master Platform</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">{dashboard.title}</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">{dashboard.description}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const content = (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{card.label}</p>
              <p className="mt-2 text-2xl font-bold">{card.value}</p>
              {card.helper ? <p className="mt-2 text-xs opacity-70">{card.helper}</p> : <p className="mt-2 text-xs opacity-70">Operational snapshot</p>}
            </>
          );

          if (card.href) {
            return (
              <Link key={card.label} href={card.href} className={`rounded-2xl border p-4 ${metricTone(card.tone)} transition hover:shadow-md`}>
                {content}
              </Link>
            );
          }

          return (
            <div key={card.label} className={`rounded-2xl border p-4 ${metricTone(card.tone)}`}>
              {content}
            </div>
          );
        })}
      </div>

      {showGlobalAnalytics ? (
        <OverviewAnalytics
          workspaces={analyticsRows}
          countryCatalog={snapshot.countryCatalog.map((entry) => entry.name).filter(Boolean)}
        />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-3">
          <h2 className="text-lg font-semibold text-slate-900">My workload</h2>
          <p className="mt-1 text-sm text-slate-600">Assignments owned by your role are prioritized first.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Total assignments</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{myAssignments.length}</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs uppercase tracking-wide text-amber-700">In progress</p>
              <p className="mt-1 text-xl font-bold text-amber-900">
                {myAssignments.filter((assignment) => assignment.assignmentStatus === 'in_progress').length}
              </p>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50 p-3">
              <p className="text-xs uppercase tracking-wide text-red-700">Escalated</p>
              <p className="mt-1 text-xl font-bold text-red-900">
                {myAssignments.filter((assignment) => assignment.assignmentStatus === 'escalated').length}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-2">
          <h2 className="text-lg font-semibold text-slate-900">Next actions</h2>
          <ul className="mt-4 space-y-2 text-sm text-slate-700">
            {effectiveRole === 'SUPER_ADMIN' || effectiveRole === 'ADMIN' ? (
              <>
                <li>Pending deployments requiring handoff: {snapshot.metrics.pendingDeployments}</li>
                <li>Complaints pending triage: {snapshot.metrics.complaints}</li>
                <li>Workspaces currently blocked for launch: {snapshot.metrics.launchBlockers}</li>
                <li>Connector failures requiring intervention: {snapshot.connectorCounts.failed}</li>
              </>
            ) : effectiveRole === 'CUSTOMER_SUPPORT' ? (
              <>
                <li>Tickets assigned to you: {myAssignedTickets}</li>
                <li>Awaiting client response: {awaitingClientResponse}</li>
                <li>Urgent escalations: {escalatedTickets}</li>
              </>
            ) : effectiveRole === 'TECHNICAL_SUPPORT' ? (
              <>
                <li>Connector issues: {connectorIssues}</li>
                <li>Failed deployments: {snapshot.metrics.failedDeployments}</li>
                <li>Technical tickets assigned: {assignedTechnicalTickets}</li>
              </>
            ) : effectiveRole === 'DEPLOYMENT_MANAGER' ? (
              <>
                <li>Deployments pending: {snapshot.metrics.pendingDeployments}</li>
                <li>Workspaces awaiting setup: {workspacesAwaitingSetup}</li>
                <li>Launch authorized pending: {launchAuthorizedPending}</li>
              </>
            ) : (
              <>
                <li>Pending payments: {pendingPayments}</li>
                <li>Failed payments: {failedPayments}</li>
                <li>Billing complaints (open): {billingComplaints}</li>
              </>
            )}
          </ul>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">Quick links</h2>
          <div className="mt-4 space-y-2 text-sm">
            {quickLinks.length === 0 ? (
              <p className="text-slate-500">No links available for current role.</p>
            ) : (
              quickLinks.map((item) => (
                <Link
                  key={`${item.key}-${item.href}`}
                  href={item.href}
                  className="block rounded-xl bg-slate-100 px-3 py-2 font-medium text-slate-800 hover:bg-slate-200"
                >
                  {item.label}
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-3">
          <h2 className="text-lg font-semibold text-slate-900">Recent activity</h2>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Role relevant</p>
              <ul className="mt-2 space-y-2 text-sm text-slate-700">
                {activity.relevant.length === 0 ? <li>No relevant activity yet.</li> : activity.relevant.slice(0, 6).map((event) => (
                  <li key={event.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="font-medium text-slate-900">{event.type.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-slate-600">{event.target} · {new Date(event.createdAt).toLocaleString()}</p>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">My activity</p>
              <ul className="mt-2 space-y-2 text-sm text-slate-700">
                {activity.mine.length === 0 ? <li>No personal activity yet.</li> : activity.mine.slice(0, 6).map((event) => (
                  <li key={event.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="font-medium text-slate-900">{event.type.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-slate-600">{event.target} · {new Date(event.createdAt).toLocaleString()}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {showBillingSummary ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
          <h2 className="text-lg font-semibold text-slate-900">Billing summary</h2>
          <p className="mt-2">Default onboarding plan: <span className="font-semibold capitalize">{snapshot.accountPlan}</span></p>
          <p className="mt-1">Workspace cap per client subscription on default plan: {defaultPlanLimitLabel}</p>
          <p className="mt-1">Total workspaces currently tracked: {totalWorkspaces}</p>
          <p className="mt-2">Subscriptions in scope: {snapshot.subscriptionCapacity.trackedSubscriptions}</p>
          <p className="mt-1">Within capacity: {snapshot.subscriptionCapacity.withinCapacity} | At capacity: {snapshot.subscriptionCapacity.atCapacity}</p>
          <p className="mt-1">Over capacity: {snapshot.subscriptionCapacity.overCapacity}</p>
          {snapshot.subscriptionCapacity.unresolved > 0 ? (
            <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {snapshot.subscriptionCapacity.unresolved} subscription record(s) are missing or unresolved. Entitlement checks can become ambiguous until billing links are fixed.
            </p>
          ) : null}
          <p className="mt-3 text-xs text-slate-500">Source: commercial plan entitlement mapped from the default onboarding account plan.</p>
        </div>
      ) : null}

      {effectiveRole === 'DEPLOYMENT_MANAGER' ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-xs text-slate-600">
          <p className="font-semibold text-slate-900">Note</p>
          <p className="mt-2">
            Some deployment-manager cards (Domain Pending / Launch Authorized Pending) are derived from onboarding status and blocker text.
            If domain-specific state is required, extend workspace orchestration to store explicit domain readiness markers.
          </p>
      </div>
      ) : null}
    </div>
  );
}
