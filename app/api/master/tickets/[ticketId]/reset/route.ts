import { NextRequest, NextResponse } from 'next/server';
import { appendAuditLog } from '@/lib/adminStore';
import { normalizeMarveoRoles } from '@/lib/auth';
import { requireMasterAccess } from '@/lib/permissions/access';
import { resetTicket } from '@/lib/tickets/service';

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ ticketId: string }> },
) {
  const access = await requireMasterAccess();
  if ('error' in access) return access.error;

  const isSuperAdmin = normalizeMarveoRoles(access.roles).includes('SUPER_ADMIN');
  if (!isSuperAdmin) {
    return NextResponse.json({ error: 'Only super admin can reset tickets.' }, { status: 403 });
  }

  const { ticketId } = await context.params;
  const ticket = await resetTicket({ ticketId });
  if (!ticket) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
  }

  const actorEmail = String(access.session.user?.user_email || access.session.user?.email || 'unknown').trim().toLowerCase();
  await appendAuditLog({
    actorEmail,
    action: 'ticket.master.reset',
    target: `ticket:${ticketId}`,
    details: `status=${ticket.status};priority=${ticket.priority};assignedTo=${ticket.assignedTo || 'none'}`,
  });

  return NextResponse.json({ ok: true, ticket });
}
