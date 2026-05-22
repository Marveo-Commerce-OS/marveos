export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { getSession, isSuperAdmin } from '@/lib/auth';
import AdminSettingsClient from './AdminSettingsClient';

export default async function AdminSettingsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const superAdmin = await isSuperAdmin(session.token);
  if (!superAdmin) redirect('/dashboard');

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Advanced Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Manage launch control, module visibility, and administrative audit activity.</p>
      </div>
      <AdminSettingsClient />
    </div>
  );
}
