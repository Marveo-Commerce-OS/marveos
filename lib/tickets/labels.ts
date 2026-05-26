import type { TicketCategory, TicketPriority, TicketStatus } from '@/lib/adminStore';

export const TICKET_CATEGORY_LABEL: Record<TicketCategory, string> = {
  complaint: 'Complaint',
  billing: 'Billing',
  technical_support: 'Technical Support',
  website_support: 'Website Support',
  whatsapp_integration: 'WhatsApp/Integration',
  general_enquiry: 'General Enquiry',
};

export const TICKET_PRIORITY_LABEL: Record<TicketPriority, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
};

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  open: 'Open',
  awaiting_support: 'Awaiting Support',
  awaiting_client: 'Awaiting Client',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

export function ticketStatusBadgeClass(status: TicketStatus): string {
  if (status === 'open') return 'bg-blue-50 text-blue-700 border-blue-200';
  if (status === 'awaiting_support') return 'bg-amber-50 text-amber-700 border-amber-200';
  if (status === 'awaiting_client') return 'bg-violet-50 text-violet-700 border-violet-200';
  if (status === 'in_progress') return 'bg-slate-100 text-slate-700 border-slate-300';
  if (status === 'resolved') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  return 'bg-slate-50 text-slate-600 border-slate-200';
}

export function ticketPriorityBadgeClass(priority: TicketPriority): string {
  if (priority === 'urgent') return 'bg-rose-50 text-rose-700 border-rose-200';
  if (priority === 'high') return 'bg-orange-50 text-orange-700 border-orange-200';
  if (priority === 'normal') return 'bg-sky-50 text-sky-700 border-sky-200';
  return 'bg-slate-50 text-slate-600 border-slate-200';
}
