import type { ProfessionConfig } from '@/types/profession';

export const softwareDevelopmentCompanyProfession: ProfessionConfig = {
  key: 'software-development-company',
  professionName: 'Software Development Company',
  sector: 'Technology & Software',
  enabledModules: ['leads', 'clients', 'projects', 'tickets', 'milestones', 'invoices', 'team', 'reports', 'finance-lite', 'website'],
  dashboardWidgets: ['Active Projects', 'Pending Milestones', 'Open Client Tickets', 'New Leads', 'Pending Invoices', 'Delivery Risk', 'Monthly Revenue', 'Team Workload'],
  sidebarNavigation: [
    { label: 'Dashboard', href: '/os/dashboard' },
    { label: 'Leads', href: '/os/leads', module: 'leads' },
    { label: 'Clients', href: '/os/clients', module: 'clients' },
    { label: 'Projects', href: '/os/projects', module: 'projects' },
    { label: 'Milestones', href: '/os/milestones', module: 'milestones' },
    { label: 'Tickets', href: '/os/tickets', module: 'tickets' },
    { label: 'Invoices', href: '/os/invoices', module: 'invoices' },
    { label: 'Website', href: '/os/website', module: 'website' },
    { label: 'Team', href: '/os/team', module: 'team' },
    { label: 'Reports', href: '/os/reports', module: 'reports' },
    { label: 'Finance', href: '/os/finance', module: 'finance-lite' },
  ],
  onboardingQuestions: [
    { id: 'delivery-model', label: 'Do you deliver fixed scope or ongoing builds?', type: 'select', options: ['Fixed scope', 'Ongoing builds', 'Both'] },
    { id: 'requirements-process', label: 'Do you collect requirements before development starts?', type: 'boolean' },
    { id: 'codebase-stack', label: 'What stack do you primarily use?', type: 'text' },
    { id: 'client-communication', label: 'Do clients need ticket-based support?', type: 'boolean' },
  ],
  defaultWorkflows: ['lead_to_discovery', 'discovery_to_sprint', 'sprint_to_delivery'],
  kpiCards: ['activeProjects', 'pendingMilestones', 'openClientTickets', 'monthlyRevenue'],
  terminology: {
    project: 'Project',
    milestone: 'Milestone',
    customer: 'Client',
    requirement: 'Requirement',
    delivery: 'Delivery',
  },
  quickActions: ['Add Lead', 'Create Project', 'Create Ticket', 'Add Milestone', 'Create Invoice', 'View Reports'],
};

export default softwareDevelopmentCompanyProfession;