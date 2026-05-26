import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

export async function requireFinancePageAccess() {
  const session = await getSession();
  if (!session) {
    redirect('/master-login?error=auth_required&from=/master/finance');
  }

  return {
    session,
  };
}
