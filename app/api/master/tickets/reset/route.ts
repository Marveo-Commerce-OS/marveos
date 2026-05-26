import { NextResponse } from 'next/server';
import { appendAuditLog } from '@/lib/adminStore';
import { normalizeMarveoRoles } from '@/lib/auth';
import { requireMasterAccess } from '@/lib/permissions/access';
import { resetAllTickets } from '@/lib/tickets/service';

export async function POST() {
  const access = await requireMasterAccess();
  if ('error' in access) return access.error;

  const isSuperAdmin = normalizeMarveoRoles(access.roles).includes('SUPER_ADMIN');
  if (!isSuperAdmin) {
    return NextResponse.json({ error: 'Only super admin can reset all tickets.' }, { status: 403 });
  }

  const { clearedTickets, clearedMessageThreads } = await resetAllTickets();

  const actorEmail = String(access.session.user?.user_email || access.session.user?.email || 'unknown').trim().toLowerCase();
  await appendAuditLog({
    actorEmail,
    action: 'ticket.master.reset_all',
    target: 'ticket_desk',
    details: `clearedTickets=${clearedTickets};clearedMessageThreads=${clearedMessageThreads}`,
  });

  return NextResponse.json({
    ok: true,
    clearedTickets,
    clearedMessageThreads,
  });
}
