'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { SupportTicket, TicketCategory, TicketStatus } from '@/lib/adminStore';
import { TICKET_CATEGORY_LABEL, TICKET_PRIORITY_LABEL, TICKET_STATUS_LABEL, ticketPriorityBadgeClass, ticketStatusBadgeClass } from '@/lib/tickets/labels';

const STATUS_OPTIONS: Array<TicketStatus | ''> = ['', 'open', 'awaiting_support', 'awaiting_client', 'in_progress', 'resolved', 'closed'];
const CATEGORY_OPTIONS: Array<TicketCategory | ''> = ['', 'complaint', 'billing', 'technical_support', 'website_support', 'whatsapp_integration', 'general_enquiry'];

export default function SupportCenterClient() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<TicketStatus | ''>('');
  const [category, setCategory] = useState<TicketCategory | ''>('');

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (category) params.set('category', category);
    params.set('includeClosed', 'true');
    return params.toString();
  }, [status, category]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/os/tickets?${queryString}`, { cache: 'no-store' });
        const data = (await res.json().catch(() => null)) as { tickets?: SupportTicket[]; error?: string } | null;
        if (!res.ok) {
          throw new Error(data?.error || 'Unable to load tickets');
        }
        if (!cancelled) {
          const rows = Array.isArray(data?.tickets) ? data.tickets : [];
          const filtered = rows.filter((ticket) => {
            const moduleKey = String(ticket.relatedModule || '').toLowerCase();
            const isLiveChat = moduleKey === 'live_chat' || moduleKey === 'website_live_chat' || moduleKey === 'portal_chat_widget' || moduleKey === 'website_chat_widget';
            if (!isLiveChat) return true;
            return ticket.status === 'closed' || ticket.status === 'resolved';
          });
          setTickets(filtered);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load tickets');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [queryString]);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 md:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Support Center</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">My Tickets</h1>
            <p className="mt-2 text-sm text-slate-600">Track your support requests and request help for website setup or integrations.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/os/support/live-chat" className="rounded-full border border-sky-300 bg-sky-50 px-5 py-2.5 text-sm font-semibold text-sky-700">
              Live Chat
            </Link>
            <Link href="/os/support/new" className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white">
              Create Ticket
            </Link>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-sky-200 bg-sky-50 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-sky-700">Live Chat</h2>
            <p className="mt-2 text-sm text-slate-700">Chat instantly with support. Enquiry chat needs name/email, technical chat requires support PIN.</p>
            <Link href="/os/support/live-chat" className="mt-3 inline-flex rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white">
              Open Live Chat
            </Link>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Request Help</h2>
            <p className="mt-2 text-sm text-slate-700">Need website setup support?</p>
            <Link href="/os/support/new?category=website_support" className="mt-3 inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">
              Request Website Setup Support
            </Link>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Request Help</h2>
            <p className="mt-2 text-sm text-slate-700">Need WhatsApp or integration help?</p>
            <Link href="/os/support/new?category=whatsapp_integration" className="mt-3 inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">
              Request WhatsApp/Integration Support
            </Link>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">General Help</h2>
            <p className="mt-2 text-sm text-slate-700">Create a ticket for billing, complaints, or general enquiry.</p>
            <Link href="/os/support/new" className="mt-3 inline-flex rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
              Create Ticket
            </Link>
          </article>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              Status
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as TicketStatus | '')}
                className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              >
                {STATUS_OPTIONS.map((item) => (
                  <option key={item || 'all'} value={item}>
                    {item ? TICKET_STATUS_LABEL[item] : 'All statuses'}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              Category
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value as TicketCategory | '')}
                className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              >
                {CATEGORY_OPTIONS.map((item) => (
                  <option key={item || 'all'} value={item}>
                    {item ? TICKET_CATEGORY_LABEL[item] : 'All categories'}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading tickets...</div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">{error}</div>
        ) : null}

        {!loading && !error && tickets.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
            <p className="text-lg font-semibold text-slate-900">Need help? Create a ticket and our support team will assist you.</p>
            <p className="mt-2 text-sm text-slate-600">No tickets match your current filters.</p>
            <Link href="/os/support/new" className="mt-4 inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">
              Create Ticket
            </Link>
          </div>
        ) : null}

        {!loading && !error && tickets.length > 0 ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="grid grid-cols-12 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <div className="col-span-3">Ticket</div>
              <div className="col-span-2">Category</div>
              <div className="col-span-2">Priority</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-3">Updated</div>
            </div>
            {tickets.map((ticket) => (
              <Link
                key={ticket.id}
                href={`/os/support/${ticket.id}`}
                className="grid grid-cols-12 items-center gap-2 border-b border-slate-100 px-4 py-3 text-sm hover:bg-slate-50"
              >
                <div className="col-span-3">
                  <p className="font-semibold text-slate-900">{ticket.ticketNumber}</p>
                  <p className="text-xs text-slate-500 line-clamp-1">{ticket.subject}</p>
                </div>
                <div className="col-span-2 text-slate-700">{TICKET_CATEGORY_LABEL[ticket.category]}</div>
                <div className="col-span-2">
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${ticketPriorityBadgeClass(ticket.priority)}`}>
                    {TICKET_PRIORITY_LABEL[ticket.priority]}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${ticketStatusBadgeClass(ticket.status)}`}>
                    {TICKET_STATUS_LABEL[ticket.status]}
                  </span>
                </div>
                <div className="col-span-3 text-xs text-slate-600">{new Date(ticket.updatedAt).toLocaleString()}</div>
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
