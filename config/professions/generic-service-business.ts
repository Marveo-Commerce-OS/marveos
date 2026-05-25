import type { ProfessionConfig } from '@/types/profession';

export const genericServiceBusinessProfession: ProfessionConfig = {
  key: 'generic-service-business',
  professionName: 'Service Business',
  sector: 'General Services',
  enabledModules: ['leads', 'clients', 'payments', 'reports', 'team'],
  dashboardWidgets: [
    'pipelineOverview',
    'clientFollowUps',
    'paymentStatus',
    'teamActivity',
    'reportsSnapshot',
    'onboardingChecklist',
    'quickActions',
  ],
  sidebarNavigation: [
    { label: 'Dashboard', href: '/os/dashboard' },
    { label: 'Leads', href: '/os/leads', module: 'leads' },
    { label: 'Clients', href: '/os/clients', module: 'clients' },
    { label: 'Payments', href: '/os/payments', module: 'payments' },
    { label: 'Team', href: '/os/team', module: 'team' },
    { label: 'Reports', href: '/os/reports', module: 'reports' },
  ],
  onboardingQuestions: [
    { id: 'services-summary', label: 'What services do you offer?', type: 'text' },
    { id: 'service-city', label: 'What city/location do you serve?', type: 'text' },
    { id: 'enable-online-booking', label: 'Do you want clients to book online?', type: 'boolean' },
  ],
  defaultWorkflows: ['lead_to_client', 'client_to_payment', 'payment_to_followup'],
  kpiCards: ['newLeads', 'activeClients', 'paymentsReceived', 'teamTasksOpen'],
  terminology: {
    lead: 'Lead',
    order: 'Service Request',
    customer: 'Client',
  },
};

export default genericServiceBusinessProfession;
