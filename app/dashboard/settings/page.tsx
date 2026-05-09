export const dynamic = 'force-dynamic';

import { getSiteSettings } from '@/lib/api';
import SettingsForm from './SettingsForm';

export default async function SettingsPage() {
  const settings = await getSiteSettings();

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Manage branding, integrations, payments, team contacts, and global SEO settings.</p>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 md:p-8">
        <SettingsForm initialSettings={settings} />
      </div>
    </div>
  );
}
