import { redirect } from 'next/navigation';
import { getSession, hasClientWorkspaceAccess, isAdmin, isSuperAdmin, normalizeRoles, resolveSessionMarveoRoles, MARVEO_INTERNAL_ROLES } from '@/lib/auth';
import { readAdminStore } from '@/lib/adminStore';
import Sidebar from '@/components/Sidebar';
import { getRuntimeDeploymentStatus } from '@/src/lib/deploymentStatus';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  const roles = normalizeRoles(session.user?.roles);
  if (hasClientWorkspaceAccess(roles)) redirect('/portal');

  const status = await getRuntimeDeploymentStatus();
  if (!status.setup_completed || !status.validation_passed) {
    redirect('/setup');
  }

  const admin = await isAdmin(session.token);
  if (!admin) redirect('/login?error=unauthorized');
  const superAdmin = await isSuperAdmin(session.token);

  let allowedModules: string[] | undefined;
  if (!superAdmin) {
    const store = await readAdminStore();
    const resolvedRoles = await resolveSessionMarveoRoles(session.user);
    const primaryRole = resolvedRoles.marveoRoles.find((role) =>
      MARVEO_INTERNAL_ROLES.includes(role as (typeof MARVEO_INTERNAL_ROLES)[number]),
    );
    if (!primaryRole) {
      allowedModules = [];
    } else {
      const roleVisibility = store.roleModuleVisibility[primaryRole] ?? {};
      allowedModules = Object.entries(roleVisibility)
        .filter(([, enabled]) => Boolean(enabled))
        .map(([module]) => module);
    }
  }

  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden bg-gray-50">
      <Sidebar
        displayName={session.user?.user_display_name ?? 'Admin'}
        email={session.user?.user_email ?? ''}
        canManageAccess={superAdmin}
        allowedModules={allowedModules}
      />
      <main className="flex-1 overflow-auto pt-16 md:pt-0">
        <div className="p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}
