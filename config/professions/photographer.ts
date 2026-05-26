import type { ProfessionConfig } from '@/types/profession';

export const photographerProfession: ProfessionConfig = {
  key: 'photographer',
  professionName: 'Photographer',
  sector: 'Creative Services',
  enabledModules: ['bookings', 'leads', 'clients', 'payments', 'inventory', 'team', 'reports'],
  dashboardWidgets: ['shootsToday', 'pendingLeads', 'invoiceStatus', 'deliveryQueue'],
  sidebarNavigation: [
    { label: 'Overview', href: '/os' },
    { label: 'Bookings', href: '/os/bookings', module: 'bookings' },
    { label: 'Leads', href: '/os/leads', module: 'leads' },
    { label: 'Clients', href: '/os/clients', module: 'clients' },
    { label: 'Payments', href: '/os/payments', module: 'payments' },
    { label: 'Inventory', href: '/os/inventory', module: 'inventory' },
    { label: 'Team', href: '/os/team', module: 'team' },
    { label: 'Reports', href: '/os/reports', module: 'reports' },
    { label: 'Support Center', href: '/os/support' },
  ],
  onboardingQuestions: [
    { id: 'shoot-type', label: 'What type of shoots do you run most?', type: 'select', options: ['Events', 'Studio', 'Product', 'Mixed'] },
    { id: 'delivery-sla', label: 'Typical delivery timeline (days)?', type: 'text' },
  ],
  defaultWorkflows: ['lead_to_brief', 'brief_to_shoot', 'shoot_to_delivery'],
  kpiCards: ['bookingsPerMonth', 'averageDeliveryTime', 'leadConversionRate', 'outstandingInvoices'],
  terminology: {
    booking: 'Shoot',
    order: 'Project',
    customer: 'Client',
  },
  quickActions: [
    'Add Booking',
    'Add Lead',
    'Create Invoice',
    'Upload Deliverables',
    'Add Team Member',
    'View Reports',
  ],
};

export default photographerProfession;
