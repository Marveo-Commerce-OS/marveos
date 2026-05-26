import type { ProfessionConfig } from '@/types/profession';

export const automationConsultantProfession: ProfessionConfig = {
  key: 'automation-consultant',
  professionName: 'Automation Consultant',
  sector: 'Technology & Software',
  enabledModules: ['leads', 'clients', 'consultations', 'projects', 'automations', 'tickets', 'invoices', 'reports', 'finance-lite', 'website'],
  dashboardWidgets: ['New Consultation Requests', 'Active Automation Projects', 'Client Tickets', 'Pending Proposals', 'Pending Invoices', 'Revenue Snapshot', 'Workflow Opportunities'],
  sidebarNavigation: [
    { label: 'Dashboard', href: '/os/dashboard' },
    { label: 'Leads', href: '/os/leads', module: 'leads' },
    { label: 'Clients', href: '/os/clients', module: 'clients' },
    { label: 'Consultations', href: '/os/consultations', module: 'consultations' },
    { label: 'Projects', href: '/os/projects', module: 'projects' },
    { label: 'Automations', href: '/os/automations', module: 'automations' },
    { label: 'Tickets', href: '/os/tickets', module: 'tickets' },
    { label: 'Invoices', href: '/os/invoices', module: 'invoices' },
    { label: 'Website', href: '/os/website', module: 'website' },
    { label: 'Reports', href: '/os/reports', module: 'reports' },
    { label: 'Finance', href: '/os/finance', module: 'finance-lite' },
  ],
  onboardingQuestions: [
    { id: 'consultation-offer', label: 'Do you offer paid consultations?', type: 'boolean' },
    { id: 'automation-focus', label: 'Which workflows do you automate most often?', type: 'text' },
    { id: 'implementation-model', label: 'Do you implement automations or just advise?', type: 'select', options: ['Advise only', 'Implement only', 'Both'] },
    { id: 'proposal-process', label: 'Do you send proposals before implementation?', type: 'boolean' },
  ],
  defaultWorkflows: ['consultation_to_proposal', 'proposal_to_implementation', 'implementation_to_support'],
  kpiCards: ['newConsultations', 'activeAutomationProjects', 'pendingProposals', 'workflowOpportunities'],
  terminology: {
    consultation: 'Consultation',
    automation: 'Automation',
    workflow: 'Workflow',
    proposal: 'Proposal',
    implementation: 'Implementation',
  },
  quickActions: ['Add Lead', 'Create Consultation', 'Create Project', 'Create Ticket', 'Create Invoice', 'View Reports'],
};

export default automationConsultantProfession;