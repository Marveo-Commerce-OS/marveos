import { redirect } from 'next/navigation';
import { getSession, hasClientWorkspaceAccess, normalizeRoles } from '@/lib/auth';

export default async function MasterDeploymentQueueLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) {
    redirect('/master-login');
  }

  const roles = normalizeRoles(session.user?.roles);
  if (hasClientWorkspaceAccess(roles)) {
    redirect('/portal');
  }

  return <>{children}</>;
}
