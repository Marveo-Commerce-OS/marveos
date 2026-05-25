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

  void input;
  return [
    { key: 'branding', label: 'Complete branding', done: false },
    { key: 'channels', label: 'Connect channels', done: false },
    { key: 'website', label: 'Publish website', done: false },
    { key: 'ai', label: 'Enable AI assistant (optional)', done: false },
  ];
}
