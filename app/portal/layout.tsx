import { redirect } from 'next/navigation';
import { getSession, hasClientWorkspaceAccess, hasInternalPlatformAccess, normalizeRoles } from '@/lib/auth';
import { getRuntimeDeploymentStatus } from '@/src/lib/deploymentStatus';

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const isDev = process.env.NODE_ENV !== 'production';
  const session = await getSession();
  if (!session) {
    const target = isDev ? '/login?error=auth_required&from=/portal' : '/login';
    redirect(target);
  }
  if ((session.user as { requirePasswordChange?: boolean } | null)?.requirePasswordChange) {
    redirect('/password/change?surface=portal&firstLogin=1');
  }

  const roles = normalizeRoles(session.user?.roles);
  if (hasInternalPlatformAccess(roles)) redirect('/master');
  if (!hasClientWorkspaceAccess(roles)) {
    const base = '/login?error=unauthorized&from=/portal';
    const withRoles = isDev ? `${base}&roles=${encodeURIComponent(roles.join(','))}` : '/login?error=unauthorized';
    redirect(withRoles);
  }

  const status = await getRuntimeDeploymentStatus();
  if (!status.setup_completed || !status.validation_passed) {
    redirect('/setup');
  }

  return <>{children}</>;
}
