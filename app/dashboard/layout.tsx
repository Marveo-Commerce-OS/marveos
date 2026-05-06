import { redirect } from 'next/navigation';
import { getSession, isAdmin, isSuperAdmin } from '@/lib/auth';
import { readAdminStore } from '@/lib/adminStore';
import Sidebar from '@/components/Sidebar';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  const admin = await isAdmin(session.token);
  if (!admin) redirect('/login?error=unauthorized');
  const superAdmin = await isSuperAdmin(session.token);

  const store = await readAdminStore();
  const roles = Array.isArray(session.user?.roles) ? session.user.roles.map((r: string) => String(r).toLowerCase()) : [];
  const primaryRole = roles[0] ?? 'shop_manager';
  const roleVisibility = store.roleModuleVisibility[primaryRole] ?? {};
  const allowedModules = Object.entries(roleVisibility)
    .filter(([, enabled]) => Boolean(enabled))
    .map(([module]) => module);

  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden bg-gray-50">
      <Sidebar
        displayName={session.user?.user_display_name ?? 'Admin'}
        email={session.user?.user_email ?? ''}
        canManageAccess={superAdmin}
        allowedModules={superAdmin ? undefined : allowedModules}
      />
      <main className="flex-1 overflow-auto pt-16 md:pt-0">
        <div className="p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}
