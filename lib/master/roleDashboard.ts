import type { ControlCenterModuleKey } from '@/lib/adminStore';
import type { MarveoRole } from '@/lib/auth';

export type MasterInternalRole = Extract<
  MarveoRole,
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'CUSTOMER_SUPPORT'
  | 'TECHNICAL_SUPPORT'
  | 'DEPLOYMENT_MANAGER'
  | 'BILLING_MANAGER'
>;

export type DashboardMetricCardKey =
  // Platform / operations
  | 'totalClients'
  | 'activeWorkspaces'
  | 'plansSold'
  | 'pendingDeployments'
  | 'failedDeployments'
  | 'launchBlockers'
  | 'openSupportAssignments'
  | 'complaints'
  | 'billingSnapshot'
  | 'systemStatus'
  | 'teamMembers'
  | 'connectedWebsites'
  | 'reportsSummary'
  // Customer support
  | 'myAssignedTickets'
  | 'openComplaints'
  | 'awaitingClientResponse'
  | 'newEnquiries'
  | 'websiteSupportRequests'
  | 'whatsappIntegrationRequests'
  | 'escalatedTickets'
  | 'recentClientActivity'
  // Technical support
  | 'connectorIssues'
  | 'integrationValidationPending'
  | 'wordpressConnectorStatus'
  | 'websiteTechnicalIssues'
  | 'supportSessionsPending'
  | 'assignedTechnicalTickets'
  // Deployment manager
  | 'workspacesAwaitingSetup'
  | 'launchReadiness'
  | 'domainPending'
  | 'templateConnectorSelection'
  | 'deploymentStarted'
  | 'clientReviewReady'
  | 'launchAuthorizedPending'
  // Billing manager
  | 'pendingPayments'
  | 'failedPayments'
  | 'activeSubscriptions'
  | 'expiredTrials'
  | 'upgradeRequests'
  | 'billingComplaints'
  | 'invoiceIssues';

export type SidebarItem = {
  key: string;
  label: string;
  href: string;
  exact?: boolean;
  moduleKey?: ControlCenterModuleKey;
  children?: SidebarItem[];
};

export type MasterRoleDashboard = {
  role: MasterInternalRole;
  title: string;
  description: string;
  visibleCards: DashboardMetricCardKey[];
  /**
   * Baseline module permissions enforced by code.
   * The persisted access-control matrix can further restrict, but cannot expand beyond this.
   */
  allowedModulesBaseline: ControlCenterModuleKey[];
  sidebar: SidebarItem[];
};

export const MASTER_ROLE_LABELS: Record<MasterInternalRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  CUSTOMER_SUPPORT: 'Customer Support',
  TECHNICAL_SUPPORT: 'Technical Support',
  DEPLOYMENT_MANAGER: 'Deployment Manager',
  BILLING_MANAGER: 'Billing Manager',
};

export const CONTROL_CENTER_MODULE_LABELS: Record<ControlCenterModuleKey, string> = {
  overview: 'Overview',
  clients: 'Clients',
  workspaces: 'Workspaces',
  deploymentQueue: 'Deployment Queue',
  supportQueue: 'Support Queue',
  tickets: 'Tickets',
  knowledgeCenter: 'Knowledge Center',
  definedReplies: 'Defined Replies',
  launchReadiness: 'Launch Readiness',
  connectors: 'Connectors',
  templates: 'Templates',
  team: 'Team Members',
  finance: 'Finance',
  plansBilling: 'Billing',
  reports: 'Reports',
  analytics: 'Analytics',
  auditLogs: 'Audit Logs',
  systemSettings: 'System Settings',
  rolePrivileges: 'Role Privileges',
};

export function labelForControlCenterModule(moduleKey: ControlCenterModuleKey): string {
  return CONTROL_CENTER_MODULE_LABELS[moduleKey] ?? moduleKey;
}

export function labelForMasterRole(role: string): string {
  if ((MASTER_ROLE_LABELS as Record<string, string>)[role]) {
    return (MASTER_ROLE_LABELS as Record<string, string>)[role];
  }
  return role
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

const BASELINE_MODULES: Record<MasterInternalRole, ControlCenterModuleKey[]> = {
  SUPER_ADMIN: [
    'overview',
    'clients',
    'workspaces',
    'deploymentQueue',
    'supportQueue',
    'tickets',
    'knowledgeCenter',
    'definedReplies',
    'launchReadiness',
    'connectors',
    'templates',
    'team',
    'finance',
    'plansBilling',
    'reports',
    'analytics',
    'auditLogs',
    'systemSettings',
    'rolePrivileges',
  ],
  ADMIN: [
    'overview',
    'clients',
    'workspaces',
    'deploymentQueue',
    'supportQueue',
    'tickets',
    'knowledgeCenter',
    'launchReadiness',
    'finance',
    'plansBilling',
    'reports',
  ],
  CUSTOMER_SUPPORT: [
    'overview',
    'tickets',
    'knowledgeCenter',
    'supportQueue',
    'definedReplies',
  ],
  TECHNICAL_SUPPORT: [
    'overview',
    'workspaces',
    'deploymentQueue',
    'supportQueue',
    'tickets',
    'knowledgeCenter',
    'definedReplies',
    'launchReadiness',
    'connectors',
  ],
  DEPLOYMENT_MANAGER: [
    'overview',
    'workspaces',
    'deploymentQueue',
    'launchReadiness',
    'templates',
    'supportQueue',
    'knowledgeCenter',
  ],
  BILLING_MANAGER: [
    'overview',
    'clients',
    'finance',
    'plansBilling',
    'reports',
    'tickets',
    'knowledgeCenter',
  ],
};

const ROLE_TITLES: Record<MasterInternalRole, { title: string; description: string }> = {
  SUPER_ADMIN: {
    title: 'Platform Control Center',
    description: 'Full platform command view across clients, workspaces, deployments, support, billing, and system posture.',
  },
  ADMIN: {
    title: 'Operations Overview',
    description: 'Operational command view for daily execution: clients, workspaces, support pipeline, and launch readiness.',
  },
  CUSTOMER_SUPPORT: {
    title: 'Support Desk',
    description: 'Ticket desk and complaint triage focused on client communication, follow-ups, and escalation routing.',
  },
  TECHNICAL_SUPPORT: {
    title: 'Technical Operations',
    description: 'Connector, deployment, and integration health focused on technical blockers and escalated tickets.',
  },
  DEPLOYMENT_MANAGER: {
    title: 'Deployment Operations',
    description: 'Deployment throughput and launch readiness monitoring for workspace provisioning and go-live coordination.',
  },
  BILLING_MANAGER: {
    title: 'Billing Operations',
    description: 'Commercial subscriptions, payment issues, and billing-related client escalations.',
  },
};

const ROLE_VISIBLE_CARDS: Record<MasterInternalRole, DashboardMetricCardKey[]> = {
  SUPER_ADMIN: [
    'totalClients',
    'activeWorkspaces',
    'plansSold',
    'pendingDeployments',
    'failedDeployments',
    'launchBlockers',
    'openSupportAssignments',
    'complaints',
    'billingSnapshot',
    'systemStatus',
    'teamMembers',
    'connectedWebsites',
  ],
  ADMIN: [
    'totalClients',
    'activeWorkspaces',
    'pendingDeployments',
    'openSupportAssignments',
    'launchBlockers',
    'complaints',
    'connectedWebsites',
    'reportsSummary',
  ],
  CUSTOMER_SUPPORT: [
    'myAssignedTickets',
    'openComplaints',
    'awaitingClientResponse',
    'newEnquiries',
    'websiteSupportRequests',
    'whatsappIntegrationRequests',
    'escalatedTickets',
    'recentClientActivity',
  ],
  TECHNICAL_SUPPORT: [
    'connectorIssues',
    'failedDeployments',
    'integrationValidationPending',
    'wordpressConnectorStatus',
    'websiteTechnicalIssues',
    'supportSessionsPending',
    'assignedTechnicalTickets',
    'launchBlockers',
  ],
  DEPLOYMENT_MANAGER: [
    'pendingDeployments',
    'workspacesAwaitingSetup',
    'launchReadiness',
    'domainPending',
    'templateConnectorSelection',
    'deploymentStarted',
    'clientReviewReady',
    'launchAuthorizedPending',
  ],
  BILLING_MANAGER: [
    'plansSold',
    'pendingPayments',
    'failedPayments',
    'activeSubscriptions',
    'expiredTrials',
    'upgradeRequests',
    'billingComplaints',
    'invoiceIssues',
  ],
};

const ROLE_SIDEBAR: Record<MasterInternalRole, SidebarItem[]> = {
  SUPER_ADMIN: [
    { key: 'overview', label: 'Overview', href: '/master', exact: true, moduleKey: 'overview' },
    { key: 'clients', label: 'Clients', href: '/master/clients', moduleKey: 'clients' },
    { key: 'workspaces', label: 'Workspaces', href: '/master/workspaces', moduleKey: 'workspaces' },
    { key: 'deploymentQueue', label: 'Deployment Queue', href: '/master/mvp-deployments', moduleKey: 'deploymentQueue' },
    { key: 'connectors', label: 'Connectors', href: '/master/connectors', moduleKey: 'connectors' },
    { key: 'templates', label: 'Templates', href: '/master/templates', moduleKey: 'templates' },
    {
      key: 'supportCenter',
      label: 'Support Center',
      href: '/master/tickets',
      moduleKey: 'tickets',
      children: [
        { key: 'tickets', label: 'Tickets', href: '/master/tickets', moduleKey: 'tickets' },
        { key: 'liveChatPanel', label: 'Live Chat Panel', href: '/master/live-chat', moduleKey: 'tickets' },
        { key: 'knowledgeCenter', label: 'Knowledge Center', href: '/master/knowledge-center', moduleKey: 'knowledgeCenter' },
        { key: 'supportQueue', label: 'Support Queue', href: '/master/support', moduleKey: 'supportQueue' },
        { key: 'supportSessions', label: 'Support Sessions', href: '/master/support-sessions', moduleKey: 'supportQueue' },
        { key: 'definedReplies', label: 'Defined Replies', href: '/master/defined-replies', moduleKey: 'definedReplies' },
      ],
    },
    { key: 'launchReadiness', label: 'Launch Readiness', href: '/master/launch-readiness', moduleKey: 'launchReadiness' },
    { key: 'reports', label: 'Reports', href: '/master/reports', moduleKey: 'reports' },
    { key: 'analytics', label: 'Analytics', href: '/master/analytics', moduleKey: 'analytics' },
    { key: 'auditLogs', label: 'Audit Logs', href: '/master/audit-logs', moduleKey: 'auditLogs' },
    {
      key: 'billing',
      label: 'Billing',
      href: '/master/billing',
      moduleKey: 'plansBilling',
      children: [
        { key: 'billingHome', label: 'Plans & Subscriptions', href: '/master/billing', moduleKey: 'plansBilling' },
        { key: 'paymentIssues', label: 'Payment Issues', href: '/master/payment-issues', moduleKey: 'tickets' },
      ],
    },
    {
      key: 'finance',
      label: 'Finance',
      href: '/master/finance',
      moduleKey: 'finance',
      children: [
        { key: 'financeOverview', label: 'Overview', href: '/master/finance', moduleKey: 'finance' },
        { key: 'financeLedger', label: 'Ledger', href: '/master/finance/ledger', moduleKey: 'finance' },
        { key: 'financeIncome', label: 'Income', href: '/master/finance/income', moduleKey: 'finance' },
        { key: 'financeExpenses', label: 'Expenses', href: '/master/finance/expenses', moduleKey: 'finance' },
        { key: 'financeReports', label: 'Reports', href: '/master/finance/reports', moduleKey: 'finance' },
        { key: 'financeFunding', label: 'Funding & Liabilities', href: '/master/finance/funding', moduleKey: 'finance' },
      ],
    },
    { key: 'systemSettings', label: 'System Settings', href: '/master/system-settings', moduleKey: 'systemSettings' },
    {
      key: 'rolePrivileges',
      label: 'Roles & Privileges',
      href: '/master/role-privileges',
      moduleKey: 'rolePrivileges',
      children: [
        { key: 'rolePrivilegesMatrix', label: 'Role Privileges Matrix', href: '/master/role-privileges', moduleKey: 'rolePrivileges' },
        { key: 'userProvisioning', label: 'User Provisioning', href: '/master/team', moduleKey: 'team' },
      ],
    },
  ],

  ADMIN: [
    { key: 'overview', label: 'Overview', href: '/master', exact: true, moduleKey: 'overview' },
    { key: 'clients', label: 'Clients', href: '/master/clients', moduleKey: 'clients' },
    { key: 'workspaces', label: 'Workspaces', href: '/master/workspaces', moduleKey: 'workspaces' },
    {
      key: 'supportCenter',
      label: 'Support Center',
      href: '/master/tickets',
      moduleKey: 'tickets',
      children: [
        { key: 'tickets', label: 'Tickets', href: '/master/tickets', moduleKey: 'tickets' },
        { key: 'liveChatPanel', label: 'Live Chat Panel', href: '/master/live-chat', moduleKey: 'tickets' },
        { key: 'knowledgeCenter', label: 'Knowledge Center', href: '/master/knowledge-center', moduleKey: 'knowledgeCenter' },
        { key: 'supportQueue', label: 'Support Queue', href: '/master/support', moduleKey: 'supportQueue' },
        { key: 'supportSessions', label: 'Support Sessions', href: '/master/support-sessions', moduleKey: 'supportQueue' },
      ],
    },
    { key: 'launchReadiness', label: 'Launch Readiness', href: '/master/launch-readiness', moduleKey: 'launchReadiness' },
    { key: 'reports', label: 'Reports', href: '/master/reports', moduleKey: 'reports' },
    {
      key: 'finance',
      label: 'Finance',
      href: '/master/finance',
      moduleKey: 'finance',
      children: [
        { key: 'financeOverview', label: 'Overview', href: '/master/finance', moduleKey: 'finance' },
        { key: 'financeLedger', label: 'Ledger', href: '/master/finance/ledger', moduleKey: 'finance' },
        { key: 'financeIncome', label: 'Income', href: '/master/finance/income', moduleKey: 'finance' },
        { key: 'financeExpenses', label: 'Expenses', href: '/master/finance/expenses', moduleKey: 'finance' },
        { key: 'financeReports', label: 'Reports', href: '/master/finance/reports', moduleKey: 'finance' },
        { key: 'financeFunding', label: 'Funding & Liabilities', href: '/master/finance/funding', moduleKey: 'finance' },
      ],
    },
  ],

  CUSTOMER_SUPPORT: [
    { key: 'myDashboard', label: 'My Dashboard', href: '/master', exact: true, moduleKey: 'overview' },
    { key: 'tickets', label: 'Tickets', href: '/master/tickets', moduleKey: 'tickets' },
    { key: 'liveChatPanel', label: 'Live Chat Panel', href: '/master/live-chat', moduleKey: 'tickets' },
    { key: 'knowledgeCenter', label: 'Knowledge Center', href: '/master/knowledge-center', moduleKey: 'knowledgeCenter' },
    { key: 'enquiries', label: 'Client Enquiries', href: '/master/client-enquiries', moduleKey: 'tickets' },
    { key: 'supportSessions', label: 'Support Sessions', href: '/master/support-sessions', moduleKey: 'supportQueue' },
    { key: 'definedReplies', label: 'Defined Replies', href: '/master/defined-replies', moduleKey: 'definedReplies' },
  ],

  TECHNICAL_SUPPORT: [
    { key: 'myDashboard', label: 'My Dashboard', href: '/master', exact: true, moduleKey: 'overview' },
    { key: 'liveChatPanel', label: 'Live Chat Panel', href: '/master/live-chat', moduleKey: 'tickets' },
    { key: 'knowledgeCenter', label: 'Knowledge Center', href: '/master/knowledge-center', moduleKey: 'knowledgeCenter' },
    { key: 'connectorIssues', label: 'Connector Issues', href: '/master/connectors', moduleKey: 'connectors' },
    { key: 'deployments', label: 'Deployments', href: '/master/mvp-deployments', moduleKey: 'deploymentQueue' },
    { key: 'launchReadiness', label: 'Launch Readiness', href: '/master/launch-readiness', moduleKey: 'launchReadiness' },
    { key: 'supportSessions', label: 'Support Sessions', href: '/master/support-sessions', moduleKey: 'supportQueue' },
    { key: 'technicalTickets', label: 'Technical Tickets', href: '/master/technical-tickets', moduleKey: 'tickets' },
  ],

  DEPLOYMENT_MANAGER: [
    { key: 'myDashboard', label: 'My Dashboard', href: '/master', exact: true, moduleKey: 'overview' },
    { key: 'knowledgeCenter', label: 'Knowledge Center', href: '/master/knowledge-center', moduleKey: 'knowledgeCenter' },
    { key: 'deploymentQueue', label: 'Deployment Queue', href: '/master/mvp-deployments', moduleKey: 'deploymentQueue' },
    { key: 'workspaces', label: 'Workspaces', href: '/master/workspaces', moduleKey: 'workspaces' },
    { key: 'launchReadiness', label: 'Launch Readiness', href: '/master/launch-readiness', moduleKey: 'launchReadiness' },
    { key: 'templates', label: 'Template / Website Requests', href: '/master/templates', moduleKey: 'templates' },
    { key: 'supportQueue', label: 'Support Queue', href: '/master/support', moduleKey: 'supportQueue' },
  ],

  BILLING_MANAGER: [
    { key: 'myDashboard', label: 'My Dashboard', href: '/master', exact: true, moduleKey: 'overview' },
    { key: 'knowledgeCenter', label: 'Knowledge Center', href: '/master/knowledge-center', moduleKey: 'knowledgeCenter' },
    { key: 'billing', label: 'Billing', href: '/master/billing', moduleKey: 'plansBilling' },
    { key: 'subscriptions', label: 'Subscriptions', href: '/master/billing#subscriptions', moduleKey: 'plansBilling' },
    { key: 'paymentIssues', label: 'Payment Issues', href: '/master/payment-issues', moduleKey: 'tickets' },
    { key: 'clients', label: 'Clients', href: '/master/clients', moduleKey: 'clients' },
    { key: 'reports', label: 'Reports', href: '/master/reports', moduleKey: 'reports' },
    {
      key: 'finance',
      label: 'Finance',
      href: '/master/finance',
      moduleKey: 'finance',
      children: [
        { key: 'financeOverview', label: 'Overview', href: '/master/finance', moduleKey: 'finance' },
        { key: 'financeLedger', label: 'Ledger', href: '/master/finance/ledger', moduleKey: 'finance' },
        { key: 'financeIncome', label: 'Income', href: '/master/finance/income', moduleKey: 'finance' },
        { key: 'financeExpenses', label: 'Expenses', href: '/master/finance/expenses', moduleKey: 'finance' },
        { key: 'financeReports', label: 'Reports', href: '/master/finance/reports', moduleKey: 'finance' },
        { key: 'financeFunding', label: 'Funding & Liabilities', href: '/master/finance/funding', moduleKey: 'finance' },
      ],
    },
  ],
};

export function resolveMasterRoleDashboard(role: MasterInternalRole): MasterRoleDashboard {
  const copy = ROLE_TITLES[role];
  return {
    role,
    title: copy.title,
    description: copy.description,
    visibleCards: ROLE_VISIBLE_CARDS[role],
    allowedModulesBaseline: BASELINE_MODULES[role],
    sidebar: ROLE_SIDEBAR[role],
  };
}
