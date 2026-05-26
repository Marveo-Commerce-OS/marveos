export interface CreateOnboardingChecklistInput {
  workspaceId: string;
  professionKey: string;
}

export interface OnboardingChecklistItem {
  key: string;
  label: string;
  done: boolean;
}

export async function createOnboardingChecklist(
  input: CreateOnboardingChecklistInput,
): Promise<OnboardingChecklistItem[]> {
  if (input.professionKey === 'makeup-artist') {
    return [
      { key: 'upload_logo', label: 'Upload logo', done: false },
      { key: 'set_brand_colors', label: 'Set brand colors', done: false },
      { key: 'add_services_packages', label: 'Add services/packages', done: false },
      { key: 'set_availability', label: 'Set availability', done: false },
      { key: 'connect_whatsapp', label: 'Connect WhatsApp', done: false },
      { key: 'set_payment_method', label: 'Set payment method', done: false },
      { key: 'add_team_member', label: 'Add team member', done: false },
      { key: 'connect_website_later', label: 'Connect website later', done: false },
    ];
  }

  if (input.professionKey === 'saas-software-platform') {
    return [
      { key: 'define_plans', label: 'Define pricing plans', done: false },
      { key: 'set_billing', label: 'Set up billing', done: false },
      { key: 'connect_support', label: 'Connect support channels', done: false },
      { key: 'configure_onboarding', label: 'Configure onboarding flow', done: false },
      { key: 'invite_team', label: 'Invite team members', done: false },
      { key: 'publish_website', label: 'Publish website', done: false },
    ];
  }

  if (input.professionKey === 'digital-agency') {
    return [
      { key: 'add_services', label: 'Add service packages', done: false },
      { key: 'connect_lead_forms', label: 'Connect lead forms', done: false },
      { key: 'set_pipeline', label: 'Set project pipeline', done: false },
      { key: 'prepare_proposals', label: 'Prepare proposal flow', done: false },
      { key: 'invite_team', label: 'Invite team members', done: false },
      { key: 'publish_website', label: 'Publish website', done: false },
    ];
  }

  if (input.professionKey === 'it-support-company') {
    return [
      { key: 'add_support_services', label: 'Add support services', done: false },
      { key: 'connect_ticketing', label: 'Connect ticketing channels', done: false },
      { key: 'set_sla', label: 'Set SLA priorities', done: false },
      { key: 'assign_technicians', label: 'Assign technicians', done: false },
      { key: 'connect_client_sites', label: 'Connect client sites', done: false },
      { key: 'publish_website', label: 'Publish website', done: false },
    ];
  }

  if (input.professionKey === 'software-development-company') {
    return [
      { key: 'add_services', label: 'Add development services', done: false },
      { key: 'set_projects', label: 'Set project pipeline', done: false },
      { key: 'define_milestones', label: 'Define milestones', done: false },
      { key: 'connect_support', label: 'Connect support channels', done: false },
      { key: 'invite_team', label: 'Invite team members', done: false },
      { key: 'publish_website', label: 'Publish website', done: false },
    ];
  }

  if (input.professionKey === 'automation-consultant') {
    return [
      { key: 'add_services', label: 'Add automation offers', done: false },
      { key: 'connect_intake', label: 'Connect intake forms', done: false },
      { key: 'set_proposals', label: 'Set proposal flow', done: false },
      { key: 'build_workflows', label: 'Build workflow pipeline', done: false },
      { key: 'invite_team', label: 'Invite collaborators', done: false },
      { key: 'publish_website', label: 'Publish website', done: false },
    ];
  }

  void input;
  return [
    { key: 'branding', label: 'Complete branding', done: false },
    { key: 'channels', label: 'Connect channels', done: false },
    { key: 'website', label: 'Publish website', done: false },
    { key: 'ai', label: 'Enable AI assistant (optional)', done: false },
  ];
}
