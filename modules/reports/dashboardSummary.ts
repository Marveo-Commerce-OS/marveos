import type { WorkspaceOrchestration } from '@/lib/adminStore';
import { resolveProfessionConfig } from '@/config/professions';

export interface DashboardSummaryWidgets {
  todaysBookings: {
    count: number;
    items: unknown[];
  };
  pendingDeposits: {
    count: number;
    amount: number;
    currency: string;
    items: unknown[];
  };
  newEnquiries: {
    count: number;
    items: unknown[];
  };
  whatsappStatus: {
    connected: boolean;
    label: string;
  };
  aiAssistantStatus: {
    enabled: boolean;
    label: string;
  };
  revenueSnapshot: {
    today: number;
    month: number;
    currency: string;
  };
  onboardingChecklist: {
    total: number;
    completed: number;
    items: Array<{ key: string; label: string; done: boolean }>;
  };
}

export interface DashboardSummary {
  workspaceId: string;
  professionKey: string;
  professionName: string;
  widgets: DashboardSummaryWidgets;
  dashboardWidgets: string[];
  quickActions: unknown[];
  dashboardSignals: Record<string, string | number | boolean>;
}

export interface BuildDashboardSummaryInput {
  workspace: WorkspaceOrchestration;
  professionKey: string;
  professionName: string;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function toNumber(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeDate(value: unknown): string | null {
  const text = String(value || '').trim();
  if (!text) return null;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthIsoPrefix(): string {
  return new Date().toISOString().slice(0, 7);
}

function pickFirstArray(record: Record<string, unknown>, keys: string[]): unknown[] {
  for (const key of keys) {
    const candidate = asArray(record[key]);
    if (candidate.length > 0) return candidate;
  }
  return [];
}

function amountFromItem(item: unknown): number {
  const row = asRecord(item);
  return toNumber(row.amount ?? row.depositAmount ?? row.total ?? 0);
}

function countItemsByKeys(
  collected: Record<string, unknown>,
  keys: string[],
  predicate?: (item: unknown) => boolean,
): number {
  for (const key of keys) {
    const candidate = asArray(collected[key]);
    if (candidate.length === 0) continue;
    return predicate ? candidate.filter(predicate).length : candidate.length;
  }

  return 0;
}

function countItemsByKeysWithDateFilter(
  collected: Record<string, unknown>,
  keys: string[],
  dateFilter: (date: string | null, row: Record<string, unknown>) => boolean,
): number {
  for (const key of keys) {
    const candidate = asArray(collected[key]);
    if (candidate.length === 0) continue;
    return candidate.filter((item) => {
      const row = asRecord(item);
      const date = normalizeDate(row.date ?? row.dateTime ?? row.scheduledAt ?? row.createdAt ?? row.updatedAt);
      return dateFilter(date, row);
    }).length;
  }

  return 0;
}

function checklistFromCollected(collected: Record<string, unknown>, professionKey: string): Array<{ key: string; label: string; done: boolean }> {
  const checklist = asArray(collected.onboardingChecklist)
    .map((item) => {
      const row = asRecord(item);
      const key = String(row.key || '').trim();
      const label = String(row.label || '').trim();
      const done = Boolean(row.done);
      if (!key || !label) return null;
      return { key, label, done };
    })
    .filter((item): item is { key: string; label: string; done: boolean } => Boolean(item));

  if (checklist.length > 0) return checklist;

  if (professionKey === 'makeup-artist') {
    return [
      { key: 'upload_logo', label: 'Upload logo', done: false },
      { key: 'set_brand_colors', label: 'Set brand colors', done: false },
      { key: 'add_services_packages', label: 'Add services/packages', done: false },
      { key: 'set_availability', label: 'Set availability', done: false },
      { key: 'connect_whatsapp', label: 'Connect WhatsApp', done: false },
      { key: 'set_payment_method', label: 'Set payment method', done: false },
      { key: 'add_team_member', label: 'Add team member', done: false },
      { key: 'connect_website_later', label: 'Connect website later', done: false },
    ];
  }

  return [
    { key: 'profile_basics', label: 'Complete business profile', done: false },
    { key: 'service_setup', label: 'Add services', done: false },
    { key: 'payment_setup', label: 'Set payment method', done: false },
    { key: 'team_setup', label: 'Add team member', done: false },
    { key: 'reporting_review', label: 'Review reporting preferences', done: false },
  ];
}

function buildDashboardSignals(workspace: WorkspaceOrchestration, collected: Record<string, unknown>): Record<string, string | number | boolean> {
  const activeClientsCount = countItemsByKeys(collected, ['activeClients', 'clients']);
  const activeSubscriptionsCount = countItemsByKeys(collected, ['activeSubscriptions', 'subscriptions']);
  const openTicketsCount = countItemsByKeys(collected, ['openTickets', 'tickets', 'supportTickets', 'clientTickets']);
  const urgentIssuesCount = countItemsByKeys(collected, ['urgentIssues']);
  const liveChatQueueCount = countItemsByKeys(collected, ['liveChatQueue', 'liveChatSessions', 'chatQueue']);
  const websiteEnquiriesCount = countItemsByKeys(collected, ['websiteEnquiries', 'websiteLeads', 'enquiries']);
  const newLeadsCount = countItemsByKeys(collected, ['newLeads', 'leads', 'enquiries', 'websiteEnquiries', 'consultationRequests', 'newConsultations']);
  const pendingInvoicesCount = countItemsByKeys(collected, ['pendingInvoices', 'invoices'], (item) => {
    const row = asRecord(item);
    const status = String(row.status || row.state || '').trim().toLowerCase();
    return !status || ['pending', 'unpaid', 'overdue', 'open'].includes(status);
  });
  const activeProjectsCount = countItemsByKeys(collected, ['activeProjects', 'projects']);
  const pendingMilestonesCount = countItemsByKeys(collected, ['pendingMilestones', 'milestones']);
  const openClientTicketsCount = countItemsByKeys(collected, ['openClientTickets', 'clientTickets', 'tickets']);
  const consultationRequestsCount = countItemsByKeys(collected, ['consultationRequests', 'newConsultations']);
  const onboardingRequestsCount = countItemsByKeys(collected, ['onboardingRequests', 'setupRequests']);
  const activeAutomationProjectsCount = countItemsByKeys(collected, ['activeAutomationProjects', 'automationProjects']);
  const pendingProposalsCount = countItemsByKeys(collected, ['pendingProposals', 'proposals']);
  const workflowOpportunitiesCount = countItemsByKeys(collected, ['workflowOpportunities', 'opportunities']);
  const assignedTechniciansCount = countItemsByKeys(collected, ['assignedTechnicians', 'technicians']);
  const clientSitesCount = countItemsByKeys(collected, ['clientSites', 'sites']);
  const teamTasksCount = countItemsByKeys(collected, ['teamTasks', 'tasks']);
  const campaignLeadsCount = countItemsByKeys(collected, ['campaignLeads', 'adsLeads', 'campaignEnquiries']);
  const supportResponseTime = String(collected.supportResponseTime || collected.responseTime || collected.supportResponseTimeLabel || 'Not tracked yet');
  const deliveryRisk = String(collected.deliveryRisk || collected.riskLevel || 'On track');
  const teamWorkload = String(collected.teamWorkload || (assignedTechniciansCount > 0 ? `${assignedTechniciansCount} active team member(s)` : 'No team workload data yet'));
  const websiteSetupStatus = workspace.connectorStatus === 'CONNECTED'
    ? 'Connected'
    : String(collected.websiteSetupStatus || 'Setup pending');
  const supportContracts = countItemsByKeys(collected, ['supportContracts', 'contracts']);

  const resolvedThisMonthCount = countItemsByKeysWithDateFilter(
    collected,
    ['resolvedTickets', 'tickets', 'supportTickets'],
    (date, row) => {
      if (!date || !date.startsWith(monthIsoPrefix())) return false;
      const status = String(row.status || row.state || '').trim().toLowerCase();
      return ['resolved', 'closed', 'done', 'complete', 'completed'].includes(status);
    },
  );

  const newConsultationRequestsCount = consultationRequestsCount;

  return {
    newLeadsCount,
    openTicketsCount,
    urgentIssuesCount,
    liveChatQueueCount,
    websiteEnquiriesCount,
    activeClientsCount,
    activeSubscriptionsCount,
    pendingInvoicesCount,
    activeProjectsCount,
    pendingMilestonesCount,
    openClientTicketsCount,
    consultationRequestsCount,
    onboardingRequestsCount,
    newConsultationRequestsCount,
    activeAutomationProjectsCount,
    pendingProposalsCount,
    workflowOpportunitiesCount,
    assignedTechniciansCount,
    clientSitesCount,
    teamTasksCount,
    campaignLeadsCount,
    supportResponseTime,
    deliveryRisk,
    teamWorkload,
    websiteSetupStatus,
    resolvedThisMonthCount,
    supportContracts,
    monthlyRevenue: toNumber(asRecord(collected.revenueSnapshot).month) || 0,
    todayRevenue: toNumber(asRecord(collected.revenueSnapshot).today) || 0,
  };
}

export function buildWorkspaceDashboardSummary(input: BuildDashboardSummaryInput): DashboardSummary {
  const workspace = input.workspace;
  const collected = asRecord(workspace.collectedBusinessData);
  const profession = resolveProfessionConfig(input.professionKey);
  const selectedModules = new Set((workspace.selectedModules || []).map((item) => String(item || '').trim().toLowerCase()));

  const bookingItems = pickFirstArray(collected, ['todaysBookings', 'bookingsToday']);
  const fallbackBookings = asArray(collected.bookings).filter((item) => {
    const row = asRecord(item);
    const date = normalizeDate(row.date ?? row.dateTime ?? row.scheduledAt ?? row.createdAt);
    return date === todayIso();
  });
  const todaysBookings = bookingItems.length > 0 ? bookingItems : fallbackBookings;

  const pendingDepositItems = pickFirstArray(collected, ['pendingDeposits', 'depositRequests']);
  const pendingDepositsAmount = pendingDepositItems.reduce<number>((total, item) => total + amountFromItem(item), 0);

  const newEnquiryItems = pickFirstArray(collected, ['newEnquiries', 'enquiries', 'leads']);

  const payments = asArray(collected.payments);
  const orders = asArray(collected.orders);
  const revenueSource = payments.length > 0 ? payments : orders;
  const today = todayIso();
  const monthPrefix = monthIsoPrefix();
  const revenueToday = revenueSource.reduce<number>((sum, item) => {
    const row = asRecord(item);
    const date = normalizeDate(row.date ?? row.dateCreated ?? row.createdAt);
    if (date !== today) return sum;
    return sum + amountFromItem(item);
  }, 0);
  const revenueMonth = revenueSource.reduce<number>((sum, item) => {
    const row = asRecord(item);
    const date = normalizeDate(row.date ?? row.dateCreated ?? row.createdAt);
    if (!date || !date.startsWith(monthPrefix)) return sum;
    return sum + amountFromItem(item);
  }, 0);

  const embeddedRevenue = asRecord(collected.revenueSnapshot);
  const currency = String(
    embeddedRevenue.currency
    || collected.currency
    || 'USD',
  ).trim() || 'USD';

  const checklist = checklistFromCollected(collected, input.professionKey);
  const checklistCompleted = checklist.filter((item) => item.done).length;

  const whatsappConnected = Boolean(collected.whatsappConnected) || workspace.connectorStatus === 'CONNECTED';
  const whatsappEnabled = selectedModules.has('whatsapp');
  const aiEnabled = Boolean(collected.aiAssistantEnabled || collected.aiEnabled);
  const dashboardSignals = buildDashboardSignals(workspace, collected);

  return {
    workspaceId: workspace.id,
    professionKey: profession.key,
    professionName: profession.professionName,
    widgets: {
      todaysBookings: {
        count: todaysBookings.length,
        items: todaysBookings,
      },
      pendingDeposits: {
        count: pendingDepositItems.length,
        amount: pendingDepositsAmount,
        currency,
        items: pendingDepositItems,
      },
      newEnquiries: {
        count: newEnquiryItems.length,
        items: newEnquiryItems,
      },
      whatsappStatus: {
        connected: whatsappConnected,
        label: whatsappConnected
          ? 'Connected'
          : (whatsappEnabled ? 'Not connected yet' : 'Not enabled for this workspace'),
      },
      aiAssistantStatus: {
        enabled: aiEnabled,
        label: aiEnabled ? 'Enabled' : 'Not enabled yet',
      },
      revenueSnapshot: {
        today: toNumber(embeddedRevenue.today) || revenueToday,
        month: toNumber(embeddedRevenue.month) || revenueMonth,
        currency,
      },
      onboardingChecklist: {
        total: checklist.length,
        completed: checklistCompleted,
        items: checklist,
      },
    },
    dashboardWidgets: profession.dashboardWidgets.length > 0 ? profession.dashboardWidgets : resolveProfessionConfig(undefined).dashboardWidgets,
    quickActions: profession.quickActions.length > 0 ? profession.quickActions : resolveProfessionConfig(undefined).quickActions,
    dashboardSignals,
  };
}
