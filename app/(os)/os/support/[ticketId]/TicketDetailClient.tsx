'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import RichTextEditor from '@/components/editor/RichTextEditor';
import type { SupportTicket, SupportTicketMessage, TicketAttachment } from '@/lib/adminStore';
import { TICKET_CATEGORY_LABEL, TICKET_PRIORITY_LABEL, TICKET_STATUS_LABEL, ticketPriorityBadgeClass, ticketStatusBadgeClass } from '@/lib/tickets/labels';

export default function TicketDetailClient({ ticketId }: { ticketId: string }) {
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportTicketMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [replyHtml, setReplyHtml] = useState('<p></p>');
  const [replyText, setReplyText] = useState('');
  const [attachments, setAttachments] = useState<TicketAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canReply = useMemo(() => Boolean(ticket && ticket.status !== 'closed'), [ticket]);

  async function load() {
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/os/tickets/${encodeURIComponent(ticketId)}`, { cache: 'no-store' });
      const payload = (await res.json().catch(() => null)) as {
        ticket?: SupportTicket;
        messages?: SupportTicketMessage[];
        error?: string;
      } | null;

      if (!res.ok || !payload?.ticket) {
        throw new Error(payload?.error || 'Unable to load ticket');
      }

      setTicket(payload.ticket);
      setMessages(Array.isArray(payload.messages) ? payload.messages : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load ticket');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [ticketId]);

  async function uploadFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError('');

    try {
      const created: TicketAttachment[] = [];
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/media/upload', {
          method: 'POST',
          body: formData,
        });
        const payload = (await res.json().catch(() => null)) as { source_url?: string; error?: string } | null;
        if (!res.ok || !payload?.source_url) {
          throw new Error(payload?.error || 'Attachment upload failed');
        }

        created.push({
          id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          name: file.name,
          url: payload.source_url,
          size: file.size,
          contentType: file.type,
          uploadedAt: new Date().toISOString(),
        });
      }

      setAttachments((current) => [...current, ...created]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Attachment upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function submitReply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canReply) return;

    if (!replyText.trim()) {
      setError('Reply message is required.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch(`/api/os/tickets/${encodeURIComponent(ticketId)}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageHtml: replyHtml,
          attachments,
        }),
      });
      const payload = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !payload?.ok) {
        throw new Error(payload?.error || 'Failed to send reply');
      }

      setReplyHtml('<p></p>');
      setReplyText('');
      setAttachments([]);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reply');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="p-8 text-sm text-slate-600">Loading ticket...</div>;
  }

  if (error && !ticket) {
    return <div className="p-8 text-sm text-rose-700">{error}</div>;
  }

  if (!ticket) {
    return <div className="p-8 text-sm text-slate-600">Ticket not found.</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 md:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Support Ticket</p>
              <h1 className="mt-2 text-2xl font-semibold text-slate-900">{ticket.ticketNumber}</h1>
              <p className="mt-1 text-sm text-slate-600">{ticket.subject}</p>
            </div>
            <Link href="/os/support" className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">
              Back to Tickets
            </Link>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${ticketStatusBadgeClass(ticket.status)}`}>
              {TICKET_STATUS_LABEL[ticket.status]}
            </span>
            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${ticketPriorityBadgeClass(ticket.priority)}`}>
              {TICKET_PRIORITY_LABEL[ticket.priority]}
            </span>
            <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
              {TICKET_CATEGORY_LABEL[ticket.category]}
            </span>
          </div>
        </div>

        <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">Ticket History</h2>
          {messages.map((message) => (
            <article key={message.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <span>{message.authorName} ({message.authorType})</span>
                <span>{new Date(message.createdAt).toLocaleString()}</span>
              </div>
              <div className="prose prose-sm max-w-none text-slate-800" dangerouslySetInnerHTML={{ __html: message.messageHtml }} />
              {message.attachments.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {message.attachments.map((attachment) => (
                    <a
                      key={attachment.id}
                      href={attachment.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700"
                    >
                      {attachment.name}
                    </a>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </div>

        <form onSubmit={submitReply} className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">Reply</h2>
          {!canReply ? (
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              This ticket is closed. Open a new ticket if you need further help.
            </p>
          ) : null}

          <RichTextEditor
            value={replyHtml}
            placeholder="Write your reply..."
            disabled={!canReply || submitting}
            onChange={({ html, text }) => {
              setReplyHtml(html);
              setReplyText(text);
            }}
          />

          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4">
            <input type="file" multiple onChange={(event) => void uploadFiles(event.target.files)} disabled={!canReply || submitting} className="text-sm" />
            <p className="mt-2 text-xs text-slate-500">Attachment upload is optional.</p>
            {uploading ? <p className="mt-2 text-xs text-slate-500">Uploading attachments...</p> : null}
            {attachments.length > 0 ? (
              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                {attachments.map((attachment) => (
                  <li key={attachment.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <span className="truncate">{attachment.name}</span>
                    <button
                      type="button"
                      onClick={() => setAttachments((current) => current.filter((item) => item.id !== attachment.id))}
                      className="ml-3 text-xs font-medium text-rose-600"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}

          <button
            type="submit"
            disabled={!canReply || submitting || uploading}
            className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {submitting ? 'Sending...' : 'Send Reply'}
          </button>
        </form>
      </div>
    </div>
  );
}
