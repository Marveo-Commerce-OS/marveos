import { appendAuditLog } from '@/lib/adminStore';

export type TicketNotificationEvent =
  | 'ticket.created'
  | 'ticket.support_replied'
  | 'ticket.client_replied'
  | 'ticket.assigned'
  | 'ticket.status_changed'
  | 'ticket.resolved';

export async function notifyTicketEvent(input: {
  event: TicketNotificationEvent;
  actorEmail: string;
  ticketId: string;
  ticketNumber: string;
  workspaceId: string;
  recipientEmail?: string;
  details?: string;
}) {
  await appendAuditLog({
    actorEmail: input.actorEmail || 'system',
    action: `ticket.notification.${input.event}`,
    target: `ticket:${input.ticketId}`,
    details: [
      `ticketNumber=${input.ticketNumber}`,
      `workspaceId=${input.workspaceId}`,
      input.recipientEmail ? `recipient=${input.recipientEmail}` : '',
      input.details || '',
    ].filter(Boolean).join(';'),
  });
}
