'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type TicketCategory = 'complaint' | 'billing' | 'technical_support' | 'website_support' | 'whatsapp_integration' | 'general_enquiry';

type ChatContext = {
  ok: true;
  identity: { userId: string; email: string; name: string };
  workspace: { id: string; name: string };
  canViewSupportPin: boolean;
  canRevealSupportPin?: boolean;
  maskedSupportPin?: string | null;
  supportPin: string | null;
};

type TicketMessage = {
  id: string;
  authorType: 'client' | 'support' | 'system';
  authorName: string;
  messageHtml: string;
  createdAt: string;
};

type TicketThread = {
  ticket: {
    id: string;
    ticketNumber: string;
    status: string;
    category: string;
  };
  messages: TicketMessage[];
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

function toHtmlMessage(message: string): string {
  const escaped = message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>');
  return `<p>${escaped}</p>`;
}

export default function LiveSupportChatClient() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [context, setContext] = useState<ChatContext | null>(null);

  const [category, setCategory] = useState<TicketCategory>('general_enquiry');
  const [subject, setSubject] = useState(CATEGORY_DEFAULT_SUBJECT.general_enquiry);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [supportPin, setSupportPin] = useState('');
  const [revealedSupportPin, setRevealedSupportPin] = useState('');
  const [revealingSupportPin, setRevealingSupportPin] = useState(false);

  const [existingTicketHint, setExistingTicketHint] = useState<ExistingTicketHint | null>(null);

  const [ticketId, setTicketId] = useState('');
  const [ticketNumber, setTicketNumber] = useState('');
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);

  const [startMessage, setStartMessage] = useState('');
  const [replyMessage, setReplyMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const requiresPin = category === 'technical_support';

  async function loadContext() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/os/support/chat-context', { cache: 'no-store' });
      const payload = (await res.json().catch(() => null)) as ChatContext | { error?: string } | null;
      if (!res.ok || !payload || !('ok' in payload)) {
        throw new Error((payload as { error?: string } | null)?.error || 'Unable to load chat context.');
      }
      setContext(payload);
      setName(payload.identity.name);
      setEmail(payload.identity.email);
      setRevealedSupportPin('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load chat context.');
    } finally {
      setLoading(false);
    }
  }

  async function loadThread(nextTicketId: string) {
    if (!nextTicketId) return;
    setThreadLoading(true);
    try {
      const res = await fetch(`/api/os/tickets/${encodeURIComponent(nextTicketId)}`, { cache: 'no-store' });
      const payload = (await res.json().catch(() => null)) as TicketThread | { error?: string } | null;
      if (!res.ok || !payload || !('ticket' in payload)) {
        throw new Error((payload as { error?: string } | null)?.error || 'Unable to load chat thread.');
      }
      setTicketNumber(payload.ticket.ticketNumber);
      setMessages(payload.messages || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load chat thread.');
    } finally {
      setThreadLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadContext();
  }, []);

  useEffect(() => {
    if (!ticketId) return;
    const id = window.setInterval(() => {
      void loadThread(ticketId);
    }, 8000);

    return () => window.clearInterval(id);
  }, [ticketId]);

  async function revealSupportPin() {
    if (!context?.canRevealSupportPin) return;

    setRevealingSupportPin(true);
    setError('');
    try {
      const res = await fetch('/api/os/support/chat-context?revealPin=true', { cache: 'no-store' });
      const payload = (await res.json().catch(() => null)) as { supportPin?: string | null; error?: string } | null;
      if (!res.ok || !payload?.supportPin) {
        throw new Error(payload?.error || 'Unable to reveal support PIN.');
      }
      setRevealedSupportPin(payload.supportPin);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reveal support PIN.');
    } finally {
      setRevealingSupportPin(false);
    }
  }

  async function startChat(existingTicketAction?: 'update' | 'create_new') {
    if (!context) return;
    if (!name.trim() || !email.trim()) {
      setError('Name and email are required.');
      return;
    }
    if (!startMessage.trim()) {
      setError('Please type your first message to start the chat.');
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
      const res = await fetch('/api/os/support/live-chat/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: context.workspace.id,
          type: requiresPin ? 'technical' : 'enquiry',
          category,
          subject,
          message: startMessage,
          supportPin,
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
        setNotice('You already have an open ticket with this subject. Choose whether to update it or create a new one.');
        return;
      }

      if (!res.ok || !payload?.ok || !payload.ticket) {
        throw new Error(payload?.error || 'Failed to start live chat.');
      }

      setTicketId(payload.ticket.id);
      setTicketNumber(payload.ticket.ticketNumber);
      setStartMessage('');
      setNotice(payload.reusedExistingTicket
        ? 'Your message was added to your existing open ticket.'
        : 'Live chat started. Support team can now reply in this thread.');
      await loadThread(payload.ticket.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start live chat.');
    } finally {
      setBusy(false);
    }
  }

  async function sendReply() {
    if (!ticketId || !replyMessage.trim()) return;

    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/os/tickets/${encodeURIComponent(ticketId)}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageHtml: toHtmlMessage(replyMessage) }),
      });
      const payload = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !payload?.ok) {
        throw new Error(payload?.error || 'Failed to send chat message.');
      }
      setReplyMessage('');
      await loadThread(ticketId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send chat message.');
    } finally {
      setBusy(false);
    }
  }

  async function endChat() {
    if (!ticketId) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/os/tickets/${encodeURIComponent(ticketId)}/end`, {
        method: 'POST',
      });
      const payload = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !payload?.ok) {
        throw new Error(payload?.error || 'Failed to end chat.');
      }
      setNotice('Chat ended and ticket moved to closed state. It is now visible in ticket history.');
      setReplyMessage('');
      setTicketId('');
      setTicketNumber('');
      setMessages([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to end chat.');
    } finally {
      setBusy(false);
    }
  }

  const isStarted = Boolean(ticketId);

  const headerText = useMemo(() => {
    if (!isStarted) return 'Start a new support chat';
    return `Active chat thread ${ticketNumber ? `- ${ticketNumber}` : ''}`;
  }, [isStarted, ticketNumber]);

  if (loading) {
    return <div className="p-8 text-sm text-slate-600">Loading live chat...</div>;
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#f0f9ff,transparent_45%),radial-gradient(circle_at_bottom,#dbeafe,transparent_40%)] px-4 py-8 md:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-700">Live Support</p>
            <h1 className="mt-1 text-3xl font-bold text-slate-900">Client Support Chat</h1>
            <p className="mt-2 text-sm text-slate-600">{headerText}</p>
          </div>
          <Link href="/os/support" className="rounded-full border border-slate-300 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700">
            Back to Support Center
          </Link>
        </div>

        <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
          <aside className="space-y-4 rounded-3xl border border-white/60 bg-white/80 p-5 shadow-xl backdrop-blur">
            <h2 className="text-base font-semibold text-slate-900">Chat setup</h2>

            <label className="block text-sm font-medium text-slate-700">
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" />
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Email
              <input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" />
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Category
              <select
                value={category}
                onChange={(e) => {
                  const nextCategory = e.target.value as TicketCategory;
                  setCategory(nextCategory);
                  setSubject(CATEGORY_DEFAULT_SUBJECT[nextCategory]);
                }}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                {CATEGORY_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Subject
              <input value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" />
            </label>

            {requiresPin ? (
              <label className="block text-sm font-medium text-slate-700">
                Support PIN
                <input value={supportPin} onChange={(e) => setSupportPin(e.target.value)} placeholder="Enter 6-digit support PIN" className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" />
              </label>
            ) : null}

            {context?.canViewSupportPin && (context?.maskedSupportPin || revealedSupportPin) ? (
              <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Workspace Support PIN</p>
                <p className="mt-1 text-2xl font-bold tracking-[0.25em] text-sky-900">{revealedSupportPin || context.maskedSupportPin}</p>
                {!revealedSupportPin && context.canRevealSupportPin ? (
                  <button
                    type="button"
                    onClick={() => void revealSupportPin()}
                    disabled={revealingSupportPin}
                    className="mt-2 rounded-full border border-sky-200 bg-white px-3 py-1 text-xs font-semibold text-sky-700"
                  >
                    {revealingSupportPin ? 'Revealing...' : 'Reveal PIN'}
                  </button>
                ) : null}
                <p className="mt-1 text-xs text-sky-700">Masked by default for session safety. Required only for technical support chat.</p>
              </div>
            ) : null}

            {!isStarted ? (
              <>
                <label className="block text-sm font-medium text-slate-700">
                  First message
                  <textarea value={startMessage} onChange={(e) => setStartMessage(e.target.value)} rows={4} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" placeholder="Describe your issue or enquiry..." />
                </label>
                <button type="button" onClick={() => void startChat()} disabled={busy} className="w-full rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                  {busy ? 'Starting...' : 'Start Live Chat'}
                </button>
                {existingTicketHint ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    <p className="font-semibold">Open ticket found: {existingTicketHint.ticketNumber}</p>
                    <p className="mt-1">Subject: {existingTicketHint.subject}</p>
                    <p className="mt-1">Last updated: {new Date(existingTicketHint.updatedAt).toLocaleString()}</p>
                    <div className="mt-3 flex gap-2">
                      <button type="button" onClick={() => void startChat('update')} disabled={busy} className="rounded-full bg-amber-600 px-3 py-1 text-xs font-semibold text-white">Update existing</button>
                      <button type="button" onClick={() => void startChat('create_new')} disabled={busy} className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-800">Create new</button>
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}
          </aside>

          <section className="flex min-h-[620px] flex-col overflow-hidden rounded-3xl border border-white/60 bg-white shadow-xl">
            <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
              <p className="text-sm font-semibold text-slate-900">{ticketNumber || 'No active thread'}</p>
              <p className="text-xs text-slate-500">Workspace: {context?.workspace.name || 'N/A'}</p>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto bg-gradient-to-b from-white to-slate-50 p-5">
              {!isStarted ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                  Start a chat from the setup panel to open a support thread.
                </div>
              ) : null}

              {threadLoading ? (
                <div className="text-xs text-slate-500">Refreshing chat...</div>
              ) : null}

              {messages.map((message) => {
                const isClient = message.authorType === 'client';
                return (
                  <article key={message.id} className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                    isClient
                      ? 'ml-auto bg-slate-900 text-white'
                      : 'bg-white text-slate-800 border border-slate-200'
                  }`}>
                    <p className={`mb-1 text-[11px] font-semibold uppercase tracking-wide ${isClient ? 'text-slate-200' : 'text-slate-500'}`}>
                      {message.authorName}
                    </p>
                    <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: message.messageHtml }} />
                    <p className={`mt-2 text-[10px] ${isClient ? 'text-slate-300' : 'text-slate-400'}`}>
                      {new Date(message.createdAt).toLocaleString()}
                    </p>
                  </article>
                );
              })}
            </div>

            <div className="border-t border-slate-200 bg-white p-4">
              <div className="flex items-end gap-2">
                <textarea
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  rows={2}
                  className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm"
                  placeholder={isStarted ? 'Type your message…' : 'Start a chat first…'}
                  disabled={!isStarted || busy}
                />
                <button type="button" onClick={() => void sendReply()} disabled={!isStarted || busy || !replyMessage.trim()} className="rounded-2xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                  Send
                </button>
                <button type="button" onClick={() => void endChat()} disabled={!isStarted || busy} className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 disabled:opacity-60">
                  End chat
                </button>
              </div>

              {error ? <p className="mt-2 text-xs font-semibold text-rose-700">{error}</p> : null}
              {notice ? <p className="mt-2 text-xs font-semibold text-emerald-700">{notice}</p> : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
