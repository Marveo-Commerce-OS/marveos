'use client';

import { useEffect, useState } from 'react';

type TicketCategory = 'complaint' | 'billing' | 'technical_support' | 'website_support' | 'whatsapp_integration' | 'general_enquiry';

type TicketMessage = {
  id: string;
  authorType: 'client' | 'support' | 'system';
  authorName: string;
  messageHtml: string;
  createdAt: string;
};

type ExistingTicketHint = {
  id: string;
  ticketNumber: string;
  status: string;
  subject: string;
  updatedAt: string;
};

const CATEGORY_OPTIONS: Array<{ value: TicketCategory; label: string }> = [
  { value: 'general_enquiry', label: 'General enquiry' },
  { value: 'website_support', label: 'Website support' },
  { value: 'whatsapp_integration', label: 'WhatsApp integration' },
  { value: 'billing', label: 'Billing' },
  { value: 'complaint', label: 'Complaint' },
  { value: 'technical_support', label: 'Technical support (PIN required)' },
];

const CATEGORY_DEFAULT_SUBJECT: Record<TicketCategory, string> = {
  complaint: 'Complaint follow-up',
  billing: 'Billing clarification',
  technical_support: 'Technical support request',
  website_support: 'Website support request',
  whatsapp_integration: 'WhatsApp integration support',
  general_enquiry: 'General enquiry',
};

export default function PublicSupportChatWidget() {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<TicketCategory>('general_enquiry');
  const [subject, setSubject] = useState(CATEGORY_DEFAULT_SUBJECT.general_enquiry);
  const [workspaceId, setWorkspaceId] = useState(process.env.NEXT_PUBLIC_MARVEO_CHAT_WORKSPACE_ID || '');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [supportPin, setSupportPin] = useState('');
  const [startMessage, setStartMessage] = useState('');
  const [replyMessage, setReplyMessage] = useState('');

  const [ticketId, setTicketId] = useState('');
  const [ticketNumber, setTicketNumber] = useState('');
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [existingTicketHint, setExistingTicketHint] = useState<ExistingTicketHint | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const requiresPin = category === 'technical_support';

  async function loadThread(nextTicketId: string, nextEmail: string) {
    if (!nextTicketId || !nextEmail) return;

    try {
      const params = new URLSearchParams({ ticketId: nextTicketId, email: nextEmail });
      const res = await fetch(`/api/public/support-chat/thread?${params.toString()}`, { cache: 'no-store' });
      const payload = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        ticket?: { ticketNumber: string };
        messages?: TicketMessage[];
      } | null;

      if (!res.ok || !payload?.ok) {
        throw new Error(payload?.error || 'Unable to load thread.');
      }

      setTicketNumber(payload.ticket?.ticketNumber || '');
      setMessages(Array.isArray(payload.messages) ? payload.messages : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load thread.');
    }
  }

  useEffect(() => {
    if (!ticketId || !email) return;

    const id = window.setInterval(() => {
      void loadThread(ticketId, email);
    }, 8000);

    return () => window.clearInterval(id);
  }, [email, ticketId]);

  async function startChat(existingTicketAction?: 'update' | 'create_new') {
    if (!name.trim() || !email.trim() || !subject.trim() || !startMessage.trim()) {
      setError('Name, email, subject and first message are required.');
      return;
    }
    if (requiresPin && !workspaceId.trim()) {
      setError('Workspace ID is required for technical support chat.');
      return;
    }
    if (requiresPin && !supportPin.trim()) {
      setError('Support PIN is required for technical support chat.');
      return;
    }

    setBusy(true);
    setError('');
    setNotice('');
    setExistingTicketHint(null);

    try {
      const res = await fetch('/api/public/support-chat/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: workspaceId.trim() || undefined,
          name,
          email,
          type: requiresPin ? 'technical' : 'enquiry',
          category,
          subject,
          supportPin,
          message: startMessage,
          existingTicketAction,
        }),
      });
      const payload = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        requiresExistingTicketAction?: boolean;
        existingTicket?: ExistingTicketHint;
        reusedExistingTicket?: boolean;
        ticket?: { id: string; ticketNumber: string };
      } | null;

      if (res.status === 409 && payload?.requiresExistingTicketAction && payload.existingTicket) {
        setExistingTicketHint(payload.existingTicket);
        setNotice('Open ticket with same subject found. Update it or create a new ticket.');
        return;
      }

      if (!res.ok || !payload?.ok || !payload.ticket) {
        throw new Error(payload?.error || 'Failed to start chat.');
      }

      setTicketId(payload.ticket.id);
      setTicketNumber(payload.ticket.ticketNumber);
      setStartMessage('');
      setNotice(payload.reusedExistingTicket
        ? 'Your message was posted to your existing open ticket.'
        : 'Chat started.');
      await loadThread(payload.ticket.id, email);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start chat.');
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage() {
    if (!ticketId || !email || !replyMessage.trim()) return;

    setBusy(true);
    setError('');

    try {
      const res = await fetch('/api/public/support-chat/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId, email, message: replyMessage }),
      });
      const payload = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !payload?.ok) {
        throw new Error(payload?.error || 'Failed to send message.');
      }

      setReplyMessage('');
      await loadThread(ticketId, email);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message.');
    } finally {
      setBusy(false);
    }
  }

  async function endChat() {
    if (!ticketId || !email) return;

    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/public/support-chat/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId, email }),
      });
      const payload = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !payload?.ok) {
        throw new Error(payload?.error || 'Failed to end chat.');
      }
      setNotice('Chat ended and ticket closed.');
      setTicketId('');
      setTicketNumber('');
      setMessages([]);
      setReplyMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to end chat.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-[80]">
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="rounded-full bg-sky-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-900/25">
          Live support chat
        </button>
      ) : (
        <div className="w-[min(94vw,420px)] overflow-hidden rounded-3xl border border-sky-100 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Marveo Support</p>
              <p className="text-sm font-semibold text-slate-900">{ticketNumber || 'New chat'}</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-full border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600">Close</button>
          </div>

          <div className="max-h-[76vh] overflow-y-auto p-4">
            {!ticketId ? (
              <div className="space-y-3">
                <input value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" placeholder="Workspace ID (optional for enquiry)" />
                <div className="grid grid-cols-2 gap-2">
                  <input value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm" placeholder="Name" />
                  <input value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm" placeholder="Email" />
                </div>
                <select
                  value={category}
                  onChange={(e) => {
                    const nextCategory = e.target.value as TicketCategory;
                    setCategory(nextCategory);
                    setSubject(CATEGORY_DEFAULT_SUBJECT[nextCategory]);
                  }}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                >
                  {CATEGORY_OPTIONS.map((item) => (<option key={item.value} value={item.value}>{item.label}</option>))}
                </select>
                <input value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" placeholder="Subject" />
                {requiresPin ? (
                  <input value={supportPin} onChange={(e) => setSupportPin(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" placeholder="Support PIN (required)" />
                ) : null}
                <textarea value={startMessage} onChange={(e) => setStartMessage(e.target.value)} rows={3} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" placeholder="Describe your issue" />
                <button type="button" onClick={() => void startChat()} disabled={busy} className="w-full rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{busy ? 'Starting...' : 'Start chat'}</button>

                {existingTicketHint ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    <p className="font-semibold">Open ticket: {existingTicketHint.ticketNumber}</p>
                    <p className="mt-1">{existingTicketHint.subject}</p>
                    <div className="mt-3 flex gap-2">
                      <button type="button" onClick={() => void startChat('update')} className="rounded-full bg-amber-600 px-3 py-1 text-xs font-semibold text-white">Update existing</button>
                      <button type="button" onClick={() => void startChat('create_new')} className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-800">Create new</button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((message) => {
                  const isClient = message.authorType === 'client';
                  return (
                    <article key={message.id} className={`max-w-[92%] rounded-2xl px-3 py-2 text-sm ${isClient ? 'ml-auto bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-800'}`}>
                      <p className={`mb-1 text-[10px] font-semibold uppercase tracking-wide ${isClient ? 'text-slate-200' : 'text-slate-500'}`}>{message.authorName}</p>
                      <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: message.messageHtml }} />
                    </article>
                  );
                })}

                <div className="flex items-end gap-2 pt-2">
                  <textarea value={replyMessage} onChange={(e) => setReplyMessage(e.target.value)} rows={2} className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm" placeholder="Type your message" disabled={busy} />
                  <button type="button" onClick={() => void sendMessage()} disabled={busy || !replyMessage.trim()} className="rounded-2xl bg-sky-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">Send</button>
                </div>
                <button type="button" onClick={() => void endChat()} disabled={busy} className="w-full rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-60">End chat</button>
              </div>
            )}

            {error ? <p className="mt-3 text-xs font-semibold text-rose-700">{error}</p> : null}
            {notice ? <p className="mt-3 text-xs font-semibold text-emerald-700">{notice}</p> : null}
          </div>
        </div>
      )}
    </div>
  );
}
