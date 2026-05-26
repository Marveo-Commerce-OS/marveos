'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { TicketCategory, TicketPriority, TicketStatus } from '@/lib/adminStore';
import { TICKET_CATEGORY_LABEL, TICKET_PRIORITY_LABEL, TICKET_STATUS_LABEL, ticketPriorityBadgeClass, ticketStatusBadgeClass } from '@/lib/tickets/labels';
import SupportCenterTabs from '@/components/SupportCenterTabs';

type TicketRow = {
  id: string;
  ticketNumber: string;
  workspaceId: string;
  workspaceName?: string;
  clientName: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  subject: string;
  assignedToName?: string;
  lastReplyAt: string | null;
  createdAt: string;
};

const STATUS_OPTIONS: Array<TicketStatus | ''> = ['', 'open', 'awaiting_support', 'awaiting_client', 'in_progress', 'resolved', 'closed'];
const CATEGORY_OPTIONS: Array<TicketCategory | ''> = ['', 'complaint', 'billing', 'technical_support', 'website_support', 'whatsapp_integration', 'general_enquiry'];
const PRIORITY_OPTIONS: Array<TicketPriority | ''> = ['', 'low', 'normal', 'high', 'urgent'];

export default function TicketsDeskClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQueryApplied = useRef(false);

  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [summary, setSummary] = useState({ openTickets: 0, urgentTickets: 0, awaitingClient: 0, awaitingSupport: 0 });
  const [status, setStatus] = useState<TicketStatus | ''>('');
  const [category, setCategory] = useState<TicketCategory | ''>('');
  const [priority, setPriority] = useState<TicketPriority | ''>('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [canAdminManageTickets, setCanAdminManageTickets] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialQueryApplied.current) return;

    const nextStatus = searchParams.get('status') as TicketStatus | null;
    const nextCategory = searchParams.get('category') as TicketCategory | null;
    const nextPriority = searchParams.get('priority') as TicketPriority | null;
    const nextQuery = String(searchParams.get('q') || '').trim();

    if (nextStatus && STATUS_OPTIONS.includes(nextStatus)) setStatus(nextStatus);
    if (nextCategory && CATEGORY_OPTIONS.includes(nextCategory)) setCategory(nextCategory);
    if (nextPriority && PRIORITY_OPTIONS.includes(nextPriority)) setPriority(nextPriority);
    if (nextQuery) setSearch(nextQuery);

    initialQueryApplied.current = true;
  }, [searchParams]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (category) params.set('category', category);
    if (priority) params.set('priority', priority);
    if (search.trim()) params.set('q', search.trim());
    params.set('includeClosed', 'true');
    return params.toString();
  }, [status, category, priority, search]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/master/tickets?${queryString}`, { cache: 'no-store' });
        const payload = (await res.json().catch(() => null)) as {
          tickets?: TicketRow[];
          summary?: { openTickets: number; urgentTickets: number; awaitingClient: number; awaitingSupport: number };
          canAdminManageTickets?: boolean;
          error?: string;
        } | null;

        if (!res.ok) {
          throw new Error(payload?.error || 'Unable to load ticket desk');
        }

        if (!cancelled) {
          setTickets(Array.isArray(payload?.tickets) ? payload.tickets : []);
          setSummary(payload?.summary || { openTickets: 0, urgentTickets: 0, awaitingClient: 0, awaitingSupport: 0 });
          setCanAdminManageTickets(Boolean(payload?.canAdminManageTickets));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load ticket desk');
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

  async function resetAllTickets() {
    const confirmed = window.confirm('Reset all tickets in this table? This will clear all ticket records and message threads.');
    if (!confirmed) return;

    setActionBusy(true);
    setError('');
    setNotice('');

    try {
      const res = await fetch('/api/master/tickets/reset', {
        method: 'POST',
      });
      const payload = (await res.json().catch(() => null)) as {
        ok?: boolean;
        clearedTickets?: number;
        error?: string;
      } | null;

      if (!res.ok || !payload?.ok) {
        throw new Error(payload?.error || 'Failed to reset tickets');
      }

      setNotice(`Ticket reset complete. Cleared ${payload.clearedTickets || 0} tickets.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset tickets');
    } finally {
      setActionBusy(false);
    }
  }

  async function deleteTicket(ticket: TicketRow) {
    const confirmed = window.confirm(`Delete ${ticket.ticketNumber}? This cannot be undone.`);
    if (!confirmed) return;

    setActionBusy(true);
    setError('');
    setNotice('');

    try {
      const res = await fetch(`/api/master/tickets/${encodeURIComponent(ticket.id)}`, {
        method: 'DELETE',
      });
      const payload = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !payload?.ok) {
        throw new Error(payload?.error || 'Failed to delete ticket');
      }

      setNotice(`Deleted ${ticket.ticketNumber}.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete ticket');
    } finally {
      setActionBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Master Support Center</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Tickets</h1>
          <p className="mt-2 text-sm text-slate-600">Manage support conversations across workspaces from one desk.</p>
        </div>
        <Link href="/master/tickets/new" className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
          Create Ticket
        </Link>
        {canAdminManageTickets ? (
          <button
            type="button"
            onClick={() => void resetAllTickets()}
            disabled={loading || actionBusy}
            className="rounded-full border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 disabled:opacity-60"
          >
            Reset Tickets Table
          </button>
        ) : null}
      </div>

      <SupportCenterTabs active="tickets" />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Open Tickets</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{summary.openTickets}</p>
        </article>
        <article className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <p className="text-xs uppercase tracking-wide text-rose-700">Urgent Tickets</p>
          <p className="mt-2 text-2xl font-semibold text-rose-900">{summary.urgentTickets}</p>
        </article>
        <article className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
          <p className="text-xs uppercase tracking-wide text-violet-700">Awaiting Client</p>
          <p className="mt-2 text-2xl font-semibold text-violet-900">{summary.awaitingClient}</p>
        </article>
        <article className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs uppercase tracking-wide text-amber-700">Awaiting Support</p>
          <p className="mt-2 text-2xl font-semibold text-amber-900">{summary.awaitingSupport}</p>
        </article>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-4">
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

          <label className="text-sm font-medium text-slate-700">
            Priority
            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value as TicketPriority | '')}
              className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            >
              {PRIORITY_OPTIONS.map((item) => (
                <option key={item || 'all'} value={item}>
                  {item ? TICKET_PRIORITY_LABEL[item] : 'All priorities'}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-slate-700">
            Search
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Ticket, subject, client"
              className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        </div>
      </div>

      {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading tickets...</div> : null}
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">{error}</div> : null}
      {notice ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-sm text-emerald-700">{notice}</div> : null}

      {!loading && !error ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="grid grid-cols-12 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <div className="col-span-2">Ticket Number</div>
            <div className="col-span-2">Client / Workspace</div>
            <div className="col-span-1">Category</div>
            <div className="col-span-1">Priority</div>
            <div className="col-span-1">Status</div>
            <div className="col-span-2">Subject</div>
            <div className="col-span-1">Assigned To</div>
            <div className="col-span-1">Last Reply</div>
            <div className="col-span-1">Created</div>
            <div className="col-span-1 text-right">Actions</div>
          </div>

          {tickets.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-slate-600">No tickets found for current filters.</div>
          ) : (
            tickets.map((ticket) => (
              <div key={ticket.id} className="grid grid-cols-12 items-center gap-2 border-b border-slate-100 px-4 py-3 text-sm hover:bg-slate-50">
                <div className="col-span-2 font-semibold text-slate-900">{ticket.ticketNumber}</div>
                <div className="col-span-2">
                  <p className="line-clamp-1 text-slate-900">{ticket.clientName}</p>
                  <p className="line-clamp-1 text-xs text-slate-500">{ticket.workspaceName || ticket.workspaceId}</p>
                </div>
                <div className="col-span-1 text-xs text-slate-700">{TICKET_CATEGORY_LABEL[ticket.category]}</div>
                <div className="col-span-1">
                  <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${ticketPriorityBadgeClass(ticket.priority)}`}>
                    {TICKET_PRIORITY_LABEL[ticket.priority]}
                  </span>
                </div>
                <div className="col-span-1">
                  <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${ticketStatusBadgeClass(ticket.status)}`}>
                    {TICKET_STATUS_LABEL[ticket.status]}
                  </span>
                </div>
                <div className="col-span-2 line-clamp-1 text-slate-700">{ticket.subject}</div>
                <div className="col-span-1 line-clamp-1 text-xs text-slate-600">{ticket.assignedToName || 'Unassigned'}</div>
                <div className="col-span-1 text-xs text-slate-600">{ticket.lastReplyAt ? new Date(ticket.lastReplyAt).toLocaleDateString() : '-'}</div>
                <div className="col-span-1 text-xs text-slate-600">{new Date(ticket.createdAt).toLocaleDateString()}</div>
                <div className="col-span-1 text-right">
                  <div className="inline-flex items-center gap-2">
                    <Link
                      href={`/master/tickets/${ticket.id}`}
                      className="inline-flex rounded-full border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                    >
                      View
                    </Link>
                    {canAdminManageTickets ? (
                      <button
                        type="button"
                        onClick={() => void deleteTicket(ticket)}
                        disabled={actionBusy}
                        className="inline-flex rounded-full border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                      >
                        Delete
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
