import { redirect } from 'next/navigation';
import { getSession, hasInternalPlatformAccess, normalizeRoles } from '@/lib/auth';

export default async function RootPage() {
  const session = await getSession();
  if (session) {
    const roles = normalizeRoles(session.user?.roles);
    if (hasInternalPlatformAccess(roles)) redirect('/master');
    redirect('/portal');
  }
  redirect('/login');
}
