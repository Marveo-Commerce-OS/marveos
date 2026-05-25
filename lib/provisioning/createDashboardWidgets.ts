export interface CreateDashboardWidgetsInput {
  workspaceId: string;
  professionKey: string;
}

export async function createDashboardWidgets(input: CreateDashboardWidgetsInput): Promise<string[]> {
  void input.workspaceId;

  if (input.professionKey === 'makeup-artist') {
    return [
      'Today\'s Bookings',
      'Pending Deposits',
      'New WhatsApp Enquiries',
      'AI Assistant Status',
      'Revenue Snapshot',
      'Availability Setup',
    ];
  }

  return [
    'Pipeline Overview',
    'Client Follow-ups',
    'Payment Status',
    'Team Activity',
    'Reports Snapshot',
  ];
}
