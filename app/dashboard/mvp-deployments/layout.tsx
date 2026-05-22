import { redirect } from 'next/navigation';
import { getSession, hasClientWorkspaceAccess, normalizeRoles } from '@/lib/auth';

export default async function DashboardDeploymentQueueLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  const roles = normalizeRoles(session.user?.roles);
  if (hasClientWorkspaceAccess(roles)) {
    redirect('/portal');
  }

  return <>{children}</>;
}
