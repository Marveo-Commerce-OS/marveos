import type { ProfessionConfig } from '@/types/profession';

export const makeupArtistProfession: ProfessionConfig = {
  key: 'makeup-artist',
  professionName: 'Makeup Artist',
  sector: 'Beauty & Personal Care',
  enabledModules: ['bookings', 'leads', 'clients', 'payments', 'whatsapp', 'reports', 'team'],
  dashboardWidgets: [
    'todaysBookings',
    'pendingDeposits',
    'newWhatsAppEnquiries',
    'aiAssistantStatus',
    'revenueSnapshot',
    'availabilitySetup',
    'onboardingChecklist',
    'quickActions',
  ],
  sidebarNavigation: [
    { label: 'Dashboard', href: '/os/dashboard' },
    { label: 'Bookings', href: '/os/bookings', module: 'bookings' },
    { label: 'Leads', href: '/os/leads', module: 'leads' },
    { label: 'Clients', href: '/os/clients', module: 'clients' },
    { label: 'Payments', href: '/os/payments', module: 'payments' },
    { label: 'Team', href: '/os/team', module: 'team' },
    { label: 'WhatsApp', href: '/os/whatsapp', module: 'whatsapp' },
    { label: 'Reports', href: '/os/reports', module: 'reports' },
  ],
  onboardingQuestions: [
    { id: 'offers-bridal-makeup', label: 'Do you offer bridal makeup?', type: 'boolean' },
    { id: 'offers-studio-appointments', label: 'Do you offer studio appointments?', type: 'boolean' },
    { id: 'offers-home-service', label: 'Do you offer home service?', type: 'boolean' },
    { id: 'requires-deposit-before-booking', label: 'Do you require deposit before booking?', type: 'boolean' },
    { id: 'default-deposit', label: 'What is your default deposit percentage or amount?', type: 'text' },
    { id: 'availability-days', label: 'What days are you available?', type: 'text' },
    { id: 'service-city', label: 'What city/location do you serve?', type: 'text' },
    { id: 'team-mode', label: 'Do you work alone or with a team?', type: 'select', options: ['Alone', 'With a team'] },
    { id: 'enable-online-booking', label: 'Do you want clients to book online?', type: 'boolean' },
    { id: 'enable-whatsapp-enquiries-first', label: 'Do you want WhatsApp enquiries enabled first?', type: 'boolean' },
  ],
  defaultWorkflows: ['lead_to_consultation', 'consultation_to_booking', 'booking_to_followup'],
  kpiCards: ['todaysBookings', 'pendingDeposits', 'newEnquiries', 'monthlyRevenue'],
  terminology: {
    lead: 'Enquiry',
    order: 'Booking',
    customer: 'Client',
  },
};

export default makeupArtistProfession;
