import type { ProfessionConfig } from '@/types/profession';

export const digitalAgencyProfession: ProfessionConfig = {
  key: 'digital-agency',
  professionName: 'Digital Agency',
  sector: 'Technology & Software',
  enabledModules: ['leads', 'clients', 'projects', 'tickets', 'live-chat', 'support-center', 'invoices', 'finance-lite', 'team', 'reports', 'website', 'campaigns'],
  dashboardWidgets: ['New Leads', 'Active Clients', 'Open Projects', 'Pending Invoices', 'Support Tickets', 'Campaign Leads', 'Monthly Revenue', 'Team Tasks'],
  sidebarNavigation: [
    { label: 'Dashboard', href: '/os/dashboard' },
    { label: 'Leads', href: '/os/leads', module: 'leads' },
    { label: 'Clients', href: '/os/clients', module: 'clients' },
    { label: 'Projects', href: '/os/projects', module: 'projects' },
    { label: 'Tickets', href: '/os/tickets', module: 'tickets' },
    { label: 'Live Chat', href: '/os/support/live-chat', module: 'live-chat' },
    { label: 'Support Center', href: '/os/support', module: 'support-center' },
    { label: 'Invoices', href: '/os/invoices', module: 'invoices' },
    { label: 'Campaigns', href: '/os/campaigns', module: 'campaigns' },
    { label: 'Website', href: '/os/website', module: 'website' },
    { label: 'Team', href: '/os/team', module: 'team' },
    { label: 'Reports', href: '/os/reports', module: 'reports' },
  ],
  onboardingQuestions: [
    { id: 'agency-services', label: 'What services do you offer?', type: 'text' },
    { id: 'active-clients', label: 'How many active clients do you manage?', type: 'text' },
    { id: 'project-delivery', label: 'Do you deliver work in projects or retainers?', type: 'select', options: ['Projects', 'Retainers', 'Both'] },
    { id: 'campaign-tracking', label: 'Do you track leads from campaigns?', type: 'boolean' },
  ],
  defaultWorkflows: ['lead_to_proposal', 'proposal_to_project', 'project_to_delivery'],
  kpiCards: ['newLeads', 'activeClients', 'openProjects', 'monthlyRevenue'],
  terminology: {
    lead: 'Lead',
    order: 'Project',
    customer: 'Client',
    proposal: 'Proposal',
  },
  quickActions: ['Add Lead', 'Add Client', 'Create Project', 'Create Invoice', 'Add Team Member', 'View Reports'],
};

export default digitalAgencyProfession;