import TicketDetailClient from './TicketDetailClient';

export default async function OsTicketDetailPage(
  props: { params: Promise<{ ticketId: string }> },
) {
  const { ticketId } = await props.params;
  return <TicketDetailClient ticketId={ticketId} />;
}
