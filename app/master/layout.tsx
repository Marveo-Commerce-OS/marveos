import { redirect } from 'next/navigation';
import { getSession, hasClientWorkspaceAccess, isAdmin, isSuperAdmin, normalizeRoles } from '@/lib/auth';
import MasterSidebar from '@/components/MasterSidebar';
import { getRuntimeDeploymentStatus } from '@/src/lib/deploymentStatus';

export default async function MasterLayout({ children }: { children: React.ReactNode }) {
  const isDev = process.env.NODE_ENV !== 'production';
  const session = await getSession();
  if (!session) {
    const target = isDev ? '/master-login?error=auth_required&from=/master' : '/master-login';
    redirect(target);
  }

  const status = await getRuntimeDeploymentStatus();
  if (!status.setup_completed || !status.validation_passed) {
    redirect('/setup');
  }

  const roles = normalizeRoles(session.user?.roles);
  if (hasClientWorkspaceAccess(roles)) {
    redirect('/portal');
  }

  const admin = await isAdmin(session.token);
  if (!admin) {
    const base = '/master-login?error=unauthorized&from=/master';
    const withRoles = isDev ? `${base}&roles=${encodeURIComponent(roles.join(','))}` : '/master-login?error=unauthorized';
    redirect(withRoles);
  }

  const superAdmin = await isSuperAdmin(session.token);

  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden bg-gray-50">
      <MasterSidebar
        displayName={session.user?.user_display_name ?? 'Admin'}
        email={session.user?.user_email ?? ''}
      />
      <main className="flex-1 overflow-auto pt-16 md:pt-0">
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900 md:px-8">
          Control Center is now the canonical internal surface. Legacy /dashboard routes remain available during migration.
        </div>
        {!superAdmin && (
          <div className="border-b border-blue-200 bg-blue-50 px-4 py-2 text-xs text-blue-900 md:px-8">
            Limited internal role detected: some sections may be read-only.
          </div>
        )}
        <div className="p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}
