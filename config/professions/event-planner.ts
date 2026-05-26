import type { ProfessionConfig } from '@/types/profession';

export const eventPlannerProfession: ProfessionConfig = {
  key: 'event-planner',
  professionName: 'Event Planner',
  sector: 'Events',
  enabledModules: ['bookings', 'leads', 'clients', 'payments', 'team', 'reports', 'whatsapp'],
  dashboardWidgets: ['upcomingEvents', 'newLeads', 'teamCapacity', 'budgetStatus'],
  sidebarNavigation: [
    { label: 'Overview', href: '/os' },
    { label: 'Events', href: '/os/bookings', module: 'bookings' },
    { label: 'Leads', href: '/os/leads', module: 'leads' },
    { label: 'Clients', href: '/os/clients', module: 'clients' },
    { label: 'Payments', href: '/os/payments', module: 'payments' },
    { label: 'Team', href: '/os/team', module: 'team' },
    { label: 'WhatsApp', href: '/os/whatsapp', module: 'whatsapp' },
    { label: 'Reports', href: '/os/reports', module: 'reports' },
    { label: 'Support Center', href: '/os/support' },
  ],
  onboardingQuestions: [
    { id: 'event-types', label: 'Primary event types?', type: 'select', options: ['Weddings', 'Corporate', 'Social', 'Mixed'] },
    { id: 'monthly-volume', label: 'How many events per month?', type: 'text' },
  ],
  defaultWorkflows: ['lead_to_proposal', 'proposal_to_confirmation', 'execution_to_followup'],
  kpiCards: ['confirmedEvents', 'proposalWinRate', 'eventProfitMargin', 'clientSatisfactionScore'],
  terminology: {
    booking: 'Event',
    order: 'Engagement',
    customer: 'Client',
  },
  quickActions: [
    'Add Event',
    'Add Lead',
    'Create Proposal',
    'Add Team Member',
    'Create Payment Link',
    'Open WhatsApp',
  ],
};

export default eventPlannerProfession;
