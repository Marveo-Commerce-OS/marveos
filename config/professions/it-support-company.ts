import type { ProfessionConfig } from '@/types/profession';

export const itSupportCompanyProfession: ProfessionConfig = {
  key: 'it-support-company',
  professionName: 'IT Support Company',
  sector: 'Technology & Software',
  enabledModules: ['clients', 'tickets', 'support-center', 'live-chat', 'service-requests', 'assets', 'invoices', 'reports', 'team', 'finance-lite'],
  dashboardWidgets: ['Open Support Tickets', 'Urgent Issues', 'Assigned Technicians', 'SLA Watch', 'Pending Invoices', 'Client Sites', 'Resolved This Month'],
  sidebarNavigation: [
    { label: 'Dashboard', href: '/os/dashboard' },
    { label: 'Clients', href: '/os/clients', module: 'clients' },
    { label: 'Tickets', href: '/os/tickets', module: 'tickets' },
    { label: 'Service Requests', href: '/os/service-requests', module: 'service-requests' },
    { label: 'Assets', href: '/os/assets', module: 'assets' },
    { label: 'Live Chat', href: '/os/support/live-chat', module: 'live-chat' },
    { label: 'Support Center', href: '/os/support', module: 'support-center' },
    { label: 'Invoices', href: '/os/invoices', module: 'invoices' },
    { label: 'Team', href: '/os/team', module: 'team' },
    { label: 'Reports', href: '/os/reports', module: 'reports' },
    { label: 'Finance', href: '/os/finance', module: 'finance-lite' },
  ],
  onboardingQuestions: [
    { id: 'support-model', label: 'Do you offer managed support contracts?', type: 'boolean' },
    { id: 'client-sites', label: 'Do you manage client sites and devices?', type: 'boolean' },
    { id: 'sla-tracking', label: 'Do you track SLAs?', type: 'boolean' },
    { id: 'on-site-support', label: 'Do you offer on-site support?', type: 'boolean' },
  ],
  defaultWorkflows: ['service_request_to_ticket', 'ticket_to_resolution', 'resolution_to_billing'],
  kpiCards: ['openTickets', 'urgentIssues', 'assignedTechnicians', 'slaWatch'],
  terminology: {
    ticket: 'Ticket',
    customer: 'Client',
    technician: 'Technician',
    project: 'Support Contract',
  },
  quickActions: ['Create Service Request', 'Create Ticket', 'Assign Technician', 'Add Client Site', 'Create Invoice', 'View Reports'],
};

export default itSupportCompanyProfession;