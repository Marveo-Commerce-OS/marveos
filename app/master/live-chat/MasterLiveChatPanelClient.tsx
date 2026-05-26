'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TicketCategory } from '@/lib/adminStore';

type LiveChatStatus = 'queued' | 'active' | 'awaiting_client' | 'ended' | 'converted';
type InboxTab = 'my' | 'queued' | 'watching' | 'recent';

type LiveChatSession = {
  id: string;
  sessionNumber: string;
  workspaceId: string;
  clientEmail: string;
  clientName: string;
  category: TicketCategory;
  subject: string;
  status: LiveChatStatus;
  assignedResponderId: string | null;
  assignedResponderName?: string;
  linkedTicketId: string | null;
  linkedTicketNumber: string | null;
  updatedAt: string;
  createdAt: string;
  lastClientAt?: string | null;
  lastSupportAt?: string | null;
  lastMessagePreview?: string;
  lastMessageAt?: string;
  lastMessageAuthorType?: 'client' | 'support' | 'system' | null;
  messageCount?: number;
};

type TicketAttachment = {
  id: string;
  name: string;
  url: string;
  uploadedAt: string;
};

type LiveChatMessage = {
  id: string;
  authorType: 'client' | 'support' | 'system';
  authorName: string;
  messageHtml: string;
  createdAt: string;
  attachments?: TicketAttachment[];
};

type Presence = {
  clientOnline: boolean;
  supportOnline: boolean;
  lastClientSeenAt: string | null;
  lastSupportSeenAt: string | null;
};

type WorkspaceInfo = {
  id: string;
  name?: string;
};

type SessionDetailPayload = {
  session: LiveChatSession;
  messages: LiveChatMessage[];
  presence: Presence | null;
  workspace?: WorkspaceInfo | null;
};

const STATUS_LABEL: Record<LiveChatStatus, string> = {
  queued: 'Queued',
  active: 'Active',
  awaiting_client: 'Awaiting Client',
  ended: 'Ended',
  converted: 'Ticket Created',
};

const STATUS_BADGE_CLASS: Record<LiveChatStatus, string> = {
  queued: 'border-amber-300 bg-amber-50 text-amber-800',
  active: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  awaiting_client: 'border-sky-300 bg-sky-50 text-sky-800',
  ended: 'border-slate-300 bg-slate-100 text-slate-700',
  converted: 'border-violet-300 bg-violet-50 text-violet-800',
};

const CATEGORY_LABEL: Record<TicketCategory, string> = {
  complaint: 'Complaint',
  billing: 'Billing',
  technical_support: 'Technical',
  website_support: 'Website',
  whatsapp_integration: 'WhatsApp',
  general_enquiry: 'General',
};

const CATEGORY_ICON: Record<TicketCategory, string> = {
  complaint: '!',
  billing: '$',
  technical_support: 'T',
  website_support: 'W',
  whatsapp_integration: 'WA',
  general_enquiry: 'G',
};

function toHtmlMessage(message: string): string {
  const escaped = message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>');
  return `<p>${escaped}</p>`;
}

function getInitials(name: string): string {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

function formatCompactTime(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatRelativeTime(value?: string | null): string {
  if (!value) return '';
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return '';
  const deltaMinutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
  if (deltaMinutes < 1) return 'now';
  if (deltaMinutes < 60) return `${deltaMinutes}m`;
  const deltaHours = Math.round(deltaMinutes / 60);
  if (deltaHours < 24) return `${deltaHours}h`;
  const deltaDays = Math.round(deltaHours / 24);
  return `${deltaDays}d`;
}

function isSameDay(left: string, right: string): boolean {
  const a = new Date(left);
  const b = new Date(right);
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function toDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
    reader.readAsDataURL(file);
  });
}

function mergeBySessionId(prev: LiveChatSession[], next: LiveChatSession[]): LiveChatSession[] {
  const prevMap = new Map(prev.map((item) => [item.id, item]));
  return next.map((item) => {
    const existing = prevMap.get(item.id);
    if (!existing) return item;

    if (
      existing.updatedAt === item.updatedAt
      && existing.status === item.status
      && existing.lastMessageAt === item.lastMessageAt
      && existing.assignedResponderId === item.assignedResponderId
      && existing.lastMessagePreview === item.lastMessagePreview
    ) {
      return existing;
    }

    return { ...existing, ...item };
  });
}

function messageSignature(messages: LiveChatMessage[]): string {
  if (messages.length === 0) return '0';
  const last = messages[messages.length - 1];
  return `${messages.length}:${last.id}:${last.createdAt}`;
}

function tabLabel(tab: InboxTab): string {
  if (tab === 'my') return 'My chats';
  if (tab === 'queued') return 'Queue';
  if (tab === 'watching') return 'Watching';
  return 'Recent';
}

export default function MasterLiveChatPanelClient() {
  const [sessions, setSessions] = useState<LiveChatSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [detail, setDetail] = useState<SessionDetailPayload | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<InboxTab>('my');
  const [replyMessage, setReplyMessage] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<TicketAttachment[]>([]);

  const [busy, setBusy] = useState(false);
  const [initialLoadingList, setInitialLoadingList] = useState(true);
  const [initialLoadingDetail, setInitialLoadingDetail] = useState(false);
  const [error, setError] = useState('');
  const [newMessageHint, setNewMessageHint] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);

  const [isPageVisible, setIsPageVisible] = useState(true);
  const [isWindowFocused, setIsWindowFocused] = useState(true);

  const [readMarkersBySession, setReadMarkersBySession] = useState<Record<string, string>>({});

  const threadViewportRef = useRef<HTMLDivElement | null>(null);
  const threadBottomRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const shouldStickToBottomRef = useRef(true);

  useEffect(() => {
    const debounce = window.setTimeout(() => {
      setSearchTerm(searchInput.trim());
    }, 260);

    return () => window.clearTimeout(debounce);
  }, [searchInput]);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set('includeConverted', 'true');
    if (searchTerm) params.set('q', searchTerm);
    return params.toString();
  }, [searchTerm]);

  const markSessionRead = useCallback((session: LiveChatSession) => {
    const marker = session.lastClientAt || session.lastMessageAt || session.updatedAt;
    setReadMarkersBySession((prev) => {
      if (!marker) return prev;
      if (prev[session.id] === marker) return prev;
      return { ...prev, [session.id]: marker };
    });
  }, []);

  const loadSessions = useCallback(async (options?: { silent?: boolean }) => {
    const silent = Boolean(options?.silent);
    if (!silent) {
      setInitialLoadingList(true);
      setError('');
    }

    try {
      const res = await fetch(`/api/master/live-chat/sessions?${query}`, { cache: 'no-store' });
      const payload = (await res.json().catch(() => null)) as { sessions?: LiveChatSession[]; error?: string } | null;
      if (!res.ok) throw new Error(payload?.error || 'Unable to load live sessions.');

      const rows = Array.isArray(payload?.sessions) ? payload.sessions : [];
      setSessions((prev) => mergeBySessionId(prev, rows));

      setSelectedSessionId((previous) => {
        if (previous && rows.some((row) => row.id === previous)) return previous;
        return rows[0]?.id || '';
      });
    } catch (err) {
      if (!silent) setError(err instanceof Error ? err.message : 'Unable to load live sessions.');
    } finally {
      if (!silent) setInitialLoadingList(false);
    }
  }, [query]);

  const loadDetail = useCallback(async (sessionId: string, options?: { silent?: boolean }) => {
    if (!sessionId) {
      setDetail(null);
      return;
    }

    const silent = Boolean(options?.silent);
    if (!silent) {
      setInitialLoadingDetail(true);
      setError('');
    }

    const viewport = threadViewportRef.current;
    if (viewport) {
      const distanceFromBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
      shouldStickToBottomRef.current = distanceFromBottom < 80;
    }

    try {
      const res = await fetch(`/api/master/live-chat/sessions/${encodeURIComponent(sessionId)}`, { cache: 'no-store' });
      const payload = (await res.json().catch(() => null)) as (SessionDetailPayload & { error?: string }) | null;
      if (!res.ok || !payload?.session) throw new Error(payload?.error || 'Unable to load conversation.');

      setDetail((previous) => {
        if (!previous || previous.session.id !== payload.session.id) {
          return payload;
        }

        const prevSignature = messageSignature(previous.messages);
        const nextSignature = messageSignature(payload.messages);
        const samePresence = previous.presence?.clientOnline === payload.presence?.clientOnline
          && previous.presence?.supportOnline === payload.presence?.supportOnline
          && previous.presence?.lastClientSeenAt === payload.presence?.lastClientSeenAt
          && previous.presence?.lastSupportSeenAt === payload.presence?.lastSupportSeenAt;
        const sameSessionShape = previous.session.updatedAt === payload.session.updatedAt
          && previous.session.status === payload.session.status
          && previous.session.assignedResponderId === payload.session.assignedResponderId;

        if (prevSignature === nextSignature && samePresence && sameSessionShape) {
          return previous;
        }

        const previousIds = new Set(previous.messages.map((message) => message.id));
        const hasIncoming = payload.messages.some((message) => !previousIds.has(message.id) && message.authorType !== 'support');

        if (hasIncoming && !shouldStickToBottomRef.current) {
          setNewMessageHint(true);
        }

        return {
          ...previous,
          ...payload,
          messages: payload.messages,
        };
      });
    } catch (err) {
      if (!silent) {
        setError(err instanceof Error ? err.message : 'Unable to load conversation.');
      }
    } finally {
      if (!silent) setInitialLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    const onVisibilityChange = () => setIsPageVisible(document.visibilityState === 'visible');
    const onFocus = () => setIsWindowFocused(true);
    const onBlur = () => setIsWindowFocused(false);

    onVisibilityChange();
    window.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);

    return () => {
      window.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSessions();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadSessions]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadDetail(selectedSessionId);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadDetail, selectedSessionId]);

  useEffect(() => {
    const intervalMs = isPageVisible && isWindowFocused ? 18000 : 60000;
    const listInterval = window.setInterval(() => {
      void loadSessions({ silent: true });
    }, intervalMs);
    return () => window.clearInterval(listInterval);
  }, [isPageVisible, isWindowFocused, loadSessions]);

  useEffect(() => {
    if (!selectedSessionId) return;
    if (!isPageVisible) return;

    const intervalMs = isWindowFocused ? 4000 : 12000;
    const threadInterval = window.setInterval(() => {
      void loadDetail(selectedSessionId, { silent: true });
    }, intervalMs);

    return () => window.clearInterval(threadInterval);
  }, [isPageVisible, isWindowFocused, loadDetail, selectedSessionId]);

  useEffect(() => {
    if (!shouldStickToBottomRef.current) return;
    threadBottomRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
    setNewMessageHint(false);
  }, [detail?.messages]);

  useEffect(() => {
    if (!selectedSessionId) return;

    void fetch(`/api/master/live-chat/sessions/${encodeURIComponent(selectedSessionId)}/presence`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ online: true }),
    });

    const heartbeat = window.setInterval(() => {
      void fetch(`/api/master/live-chat/sessions/${encodeURIComponent(selectedSessionId)}/presence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ online: true }),
      });
    }, 20000);

    return () => {
      window.clearInterval(heartbeat);
      void fetch(`/api/master/live-chat/sessions/${encodeURIComponent(selectedSessionId)}/presence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ online: false }),
      });
    };
  }, [selectedSessionId]);

  async function takeOwnership(sessionId: string) {
    setBusy(true);
    setError('');

    try {
      const res = await fetch(`/api/master/live-chat/sessions/${encodeURIComponent(sessionId)}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const payload = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !payload?.ok) throw new Error(payload?.error || 'Unable to take chat.');

      await loadSessions({ silent: true });
      await loadDetail(sessionId, { silent: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to take chat.');
    } finally {
      setBusy(false);
    }
  }

  async function sendReply() {
    if (!selectedSessionId || !replyMessage.trim()) return;

    setBusy(true);
    setError('');

    try {
      const res = await fetch(`/api/master/live-chat/sessions/${encodeURIComponent(selectedSessionId)}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageHtml: toHtmlMessage(replyMessage),
          attachments: pendingAttachments,
        }),
      });
      const payload = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !payload?.ok) throw new Error(payload?.error || 'Unable to send reply.');

      setReplyMessage('');
      setPendingAttachments([]);
      shouldStickToBottomRef.current = true;
      await loadDetail(selectedSessionId, { silent: true });
      await loadSessions({ silent: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send reply.');
    } finally {
      setBusy(false);
    }
  }

  async function endChat() {
    if (!selectedSessionId) return;

    setBusy(true);
    setError('');

    try {
      const res = await fetch(`/api/master/live-chat/sessions/${encodeURIComponent(selectedSessionId)}/end`, {
        method: 'POST',
      });
      const payload = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !payload?.ok) throw new Error(payload?.error || 'Unable to end chat.');

      await loadSessions({ silent: true });
      await loadDetail(selectedSessionId, { silent: true });
      setShowActionsMenu(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to end chat.');
    } finally {
      setBusy(false);
    }
  }

  async function convertToTicket() {
    if (!selectedSessionId) return;

    setBusy(true);
    setError('');

    try {
      const res = await fetch(`/api/master/live-chat/sessions/${encodeURIComponent(selectedSessionId)}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ closeTicket: false }),
      });
      const payload = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !payload?.ok) throw new Error(payload?.error || 'Unable to convert chat.');

      await loadSessions({ silent: true });
      await loadDetail(selectedSessionId, { silent: true });
      setShowActionsMenu(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to convert chat.');
    } finally {
      setBusy(false);
    }
  }

  async function attachFiles(files: FileList | null) {
    if (!files || files.length === 0) return;

    try {
      const next = [...pendingAttachments];
      for (const file of Array.from(files)) {
        const url = await toDataUrl(file);
        next.push({
          id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          name: file.name,
          url,
          uploadedAt: new Date().toISOString(),
        });
      }
      setPendingAttachments(next.slice(0, 3));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to attach file.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  const activeSession = detail?.session || null;

  const sessionGroups = useMemo(() => {
    const myChats = sessions.filter((session) => session.assignedResponderId && (session.status === 'active' || session.status === 'awaiting_client'));
    const queued = sessions.filter((session) => !session.assignedResponderId && (session.status === 'queued' || session.status === 'active'));
    const watching = sessions.filter((session) => Boolean(session.assignedResponderId) && session.status === 'queued');
    const recent = sessions.filter((session) => session.status === 'ended' || session.status === 'converted');
    return { myChats, queued, watching, recent };
  }, [sessions]);

  const activeTabRows = useMemo(() => {
    if (activeTab === 'my') return sessionGroups.myChats;
    if (activeTab === 'queued') return sessionGroups.queued;
    if (activeTab === 'watching') return sessionGroups.watching;
    return sessionGroups.recent;
  }, [activeTab, sessionGroups]);

  const tabCounts = useMemo(() => ({
    my: sessionGroups.myChats.length,
    queued: sessionGroups.queued.length,
    watching: sessionGroups.watching.length,
    recent: sessionGroups.recent.length,
  }), [sessionGroups]);

  function unreadCount(session: LiveChatSession): number {
    const readMarker = readMarkersBySession[session.id];
    const latestClientAt = session.lastClientAt || session.lastMessageAt || null;
    if (!latestClientAt) return 0;
    if (!readMarker) return session.lastMessageAuthorType === 'client' ? 1 : 0;
    return new Date(latestClientAt).getTime() > new Date(readMarker).getTime() && session.lastMessageAuthorType === 'client' ? 1 : 0;
  }

  function renderSessionRow(session: LiveChatSession) {
    const selected = selectedSessionId === session.id;
    const unread = unreadCount(session);

    return (
      <button
        key={session.id}
        type="button"
        onClick={() => {
          setSelectedSessionId(session.id);
          markSessionRead(session);
        }}
        className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${selected ? 'border-[#0b63ce] bg-[#ebf4ff] shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}`}
      >
        <div className="flex items-start gap-3">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${selected ? 'bg-[#0b63ce] text-white' : 'bg-slate-200 text-slate-700'}`}>
            {getInitials(session.clientName)}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm font-semibold text-slate-900">{session.clientName}</p>
              <p className="text-[11px] text-slate-500">{formatRelativeTime(session.lastMessageAt || session.updatedAt)}</p>
            </div>

            <div className="mt-0.5 flex items-center gap-1.5">
              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-slate-100 px-1 text-[10px] font-semibold text-slate-600">{CATEGORY_ICON[session.category]}</span>
              <p className="line-clamp-1 text-xs text-slate-600">{session.lastMessagePreview || session.subject}</p>
            </div>

            <div className="mt-1.5 flex items-center justify-between gap-2">
              <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_BADGE_CLASS[session.status]}`}>
                {STATUS_LABEL[session.status]}
              </span>

              <div className="flex items-center gap-2">
                {unread > 0 ? <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">{unread}</span> : null}
                <span className={`h-2 w-2 rounded-full ${session.status === 'active' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
              </div>
            </div>
          </div>
        </div>
      </button>
    );
  }

  return (
    <div className="space-y-4">
      {error ? <div className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}

      <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-[#f8fafc] to-[#f0f6ff] p-3 shadow-sm">
        <div className="grid gap-3 xl:grid-cols-[360px,1fr]">
          <aside className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
            <div className="border-b border-slate-200 bg-white px-3 py-3">
              <p className="text-lg font-bold text-slate-900">Live Chat Desk</p>
              <p className="text-xs text-slate-500">Segmented inbox with operator tabs</p>

              <div className="mt-3 grid grid-cols-4 gap-1.5 rounded-xl bg-slate-100 p-1">
                {(['my', 'queued', 'watching', 'recent'] as InboxTab[]).map((tab) => {
                  const active = tab === activeTab;
                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveTab(tab)}
                      className={`rounded-lg px-2 py-1.5 text-[11px] font-semibold transition ${active ? 'bg-white text-[#0b63ce] shadow-sm' : 'text-slate-600 hover:bg-slate-200'}`}
                    >
                      {tabLabel(tab)}
                      <span className="ml-1 text-[10px] text-slate-500">{tabCounts[tab]}</span>
                    </button>
                  );
                })}
              </div>

              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search customer, email or preview"
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-800"
              />
            </div>

            <div className="max-h-[76vh] overflow-y-auto p-2">
              {initialLoadingList ? <p className="px-1 py-2 text-xs text-slate-500">Loading chats...</p> : null}

              <div className="mb-2 rounded-xl border border-slate-200 bg-white px-2.5 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{tabLabel(activeTab)}</p>
                <p className="text-xs text-slate-600">{tabCounts[activeTab]} conversations</p>
              </div>

              <div className="space-y-1.5">
                {activeTabRows.map(renderSessionRow)}
                {activeTabRows.length === 0 ? <p className="px-2 py-2 text-xs text-slate-500">No conversations in this segment.</p> : null}
              </div>
            </div>
          </aside>

          <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {!activeSession ? (
              <div className="flex h-[76vh] items-center justify-center px-6 text-center text-sm text-slate-500">
                Select a conversation from the left tabs to open the feed.
              </div>
            ) : (
              <div className="flex h-[76vh] flex-col">
                <header className="border-b border-slate-200 bg-white px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xl font-semibold text-slate-900">{activeSession.clientName}</p>
                      <p className="text-xs text-slate-500">{activeSession.clientEmail}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      {!activeSession.assignedResponderId ? (
                        <button type="button" onClick={() => void takeOwnership(activeSession.id)} disabled={busy} className="rounded-full border border-[#0b63ce] bg-[#edf4ff] px-3 py-1.5 text-xs font-semibold text-[#0b63ce] disabled:opacity-60">Take chat</button>
                      ) : null}

                      <div className="relative">
                        <button type="button" onClick={() => setShowActionsMenu((prev) => !prev)} className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700">Actions</button>
                        {showActionsMenu ? (
                          <div className="absolute right-0 z-20 mt-2 w-44 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                            {!activeSession.assignedResponderId ? (
                              <button type="button" onClick={() => void takeOwnership(activeSession.id)} disabled={busy} className="w-full rounded-lg px-3 py-2 text-left text-xs hover:bg-slate-100 disabled:opacity-60">Take ownership</button>
                            ) : null}
                            <button type="button" onClick={() => void endChat()} disabled={busy || activeSession.status === 'ended'} className="w-full rounded-lg px-3 py-2 text-left text-xs hover:bg-slate-100 disabled:opacity-60">End chat</button>
                            <button type="button" onClick={() => void convertToTicket()} disabled={busy || activeSession.status === 'converted'} className="w-full rounded-lg px-3 py-2 text-left text-xs hover:bg-slate-100 disabled:opacity-60">Convert to ticket</button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 font-semibold ${STATUS_BADGE_CLASS[activeSession.status]}`}>{STATUS_LABEL[activeSession.status]}</span>
                    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-700">#{activeSession.sessionNumber}</span>
                    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-700">{CATEGORY_LABEL[activeSession.category]}</span>
                    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-700">{detail?.workspace?.name || activeSession.workspaceId}</span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-700">
                      <span className={`h-2 w-2 rounded-full ${detail?.presence?.clientOnline ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                      {detail?.presence?.clientOnline ? 'Client online' : 'Client offline'}
                    </span>
                  </div>
                </header>

                <div ref={threadViewportRef} className="relative flex-1 overflow-y-auto bg-[linear-gradient(180deg,#f7fbff_0%,#eef5ff_100%)] px-4 py-3">
                  {initialLoadingDetail && (detail?.messages || []).length === 0 ? <p className="mb-2 text-xs text-slate-500">Loading conversation...</p> : null}
                  {(detail?.messages || []).length === 0 ? <p className="text-sm text-slate-600">Chat started. Send a reply to begin.</p> : null}

                  {(detail?.messages || []).map((message, index, rows) => {
                    const previous = rows[index - 1];
                    const showDay = !previous || !isSameDay(previous.createdAt, message.createdAt);
                    const mine = message.authorType === 'support';

                    return (
                      <div key={message.id} className="mb-3">
                        {showDay ? (
                          <div className="mb-2 flex items-center justify-center">
                            <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                              {new Date(message.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        ) : null}

                        <div className={`flex items-end gap-2 ${mine ? 'justify-end' : 'justify-start'}`}>
                          {!mine ? (
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-300 text-[10px] font-bold text-slate-700">
                              {getInitials(activeSession.clientName)}
                            </div>
                          ) : null}

                          <div className={`max-w-[78%] rounded-2xl px-3 py-2 shadow-sm ${mine ? 'bg-[#0b63ce] text-white' : 'border border-slate-200 bg-white text-slate-900'}`}>
                            <div className={`prose prose-sm max-w-none ${mine ? 'prose-invert' : ''}`} dangerouslySetInnerHTML={{ __html: message.messageHtml }} />

                            {Array.isArray(message.attachments) && message.attachments.length > 0 ? (
                              <div className="mt-2 space-y-1">
                                {message.attachments.map((attachment) => (
                                  <a key={attachment.id} href={attachment.url} target="_blank" rel="noreferrer" className="block text-xs underline underline-offset-2">
                                    {attachment.name}
                                  </a>
                                ))}
                              </div>
                            ) : null}

                            <p className={`mt-1 text-[10px] ${mine ? 'text-blue-100' : 'text-slate-500'}`}>{formatCompactTime(message.createdAt)}</p>
                          </div>

                          {mine ? (
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-200 text-[10px] font-bold text-sky-800">You</div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}

                  <div ref={threadBottomRef} />

                  {newMessageHint ? (
                    <button
                      type="button"
                      onClick={() => {
                        shouldStickToBottomRef.current = true;
                        threadBottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
                        setNewMessageHint(false);
                      }}
                      className="sticky bottom-2 ml-auto block rounded-full bg-[#0b63ce] px-3 py-1 text-xs font-semibold text-white"
                    >
                      New messages
                    </button>
                  ) : null}
                </div>

                <footer className="border-t border-slate-200 bg-white p-3">
                  {pendingAttachments.length > 0 ? (
                    <div className="mb-2 flex flex-wrap gap-2">
                      {pendingAttachments.map((attachment) => (
                        <button key={attachment.id} type="button" onClick={() => setPendingAttachments((prev) => prev.filter((item) => item.id !== attachment.id))} className="rounded-full border border-slate-300 bg-slate-100 px-2 py-1 text-[11px] text-slate-700">
                          {attachment.name} x
                        </button>
                      ))}
                    </div>
                  ) : null}

                  <div className="flex items-end gap-2 rounded-2xl border border-slate-300 bg-white px-2 py-2">
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-700">+</button>
                    <input ref={fileInputRef} type="file" multiple onChange={(event) => void attachFiles(event.target.files)} className="hidden" />

                    <textarea
                      value={replyMessage}
                      onChange={(event) => setReplyMessage(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault();
                          if (!busy && replyMessage.trim()) {
                            void sendReply();
                          }
                        }
                      }}
                      rows={1}
                      placeholder="Type your reply"
                      className="max-h-28 w-full resize-none bg-transparent px-1 py-1 text-sm text-slate-800 outline-none"
                    />

                    <button type="button" onClick={() => void sendReply()} disabled={busy || !replyMessage.trim()} className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#0b63ce] text-white disabled:opacity-60">↑</button>
                  </div>

                  <p className="mt-2 text-[11px] text-slate-500">Enter to send, Shift+Enter for new line.</p>
                </footer>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
