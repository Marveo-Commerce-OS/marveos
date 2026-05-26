import MasterTicketDetailClient from './MasterTicketDetailClient';
import { getSession, isSuperAdmin } from '@/lib/auth';

export default async function MasterTicketDetailPage(
  props: { params: Promise<{ ticketId: string }> },
) {
  const { ticketId } = await props.params;
  const session = await getSession();
  const canResetTicket = session?.token ? await isSuperAdmin(session.token) : false;

  return <MasterTicketDetailClient ticketId={ticketId} isSuperAdmin={canResetTicket} />;
}
