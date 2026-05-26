'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import RichTextEditor from '@/components/editor/RichTextEditor';
import SupportCenterTabs from '@/components/SupportCenterTabs';
import type { SupportTicket, SupportTicketMessage, TicketAttachment, TicketPriority, TicketStatus } from '@/lib/adminStore';
import { TICKET_PRIORITY_LABEL, TICKET_STATUS_LABEL, ticketPriorityBadgeClass, ticketStatusBadgeClass } from '@/lib/tickets/labels';

type SupportUser = {
  id: string;
  name: string;
  email: string;
  roles: string[];
};

type DefinedReply = {
  id: string;
  title: string;
  contentHtml: string;
  contentText: string;
  updatedAt: string;
};

const STATUS_OPTIONS: TicketStatus[] = ['open', 'awaiting_support', 'awaiting_client', 'in_progress', 'resolved', 'closed'];
const PRIORITY_OPTIONS: TicketPriority[] = ['low', 'normal', 'high', 'urgent'];

export default function MasterTicketDetailClient({ ticketId, isSuperAdmin }: { ticketId: string; isSuperAdmin: boolean }) {
  const router = useRouter();
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportTicketMessage[]>([]);
  const [workspaceName, setWorkspaceName] = useState('');
  const [assignedToName, setAssignedToName] = useState('Unassigned');
  const [supportUsers, setSupportUsers] = useState<SupportUser[]>([]);
  const [statusDraft, setStatusDraft] = useState<TicketStatus>('open');
  const [priorityDraft, setPriorityDraft] = useState<TicketPriority>('normal');
  const [assignedToDraft, setAssignedToDraft] = useState('');
  const [definedReplies, setDefinedReplies] = useState<DefinedReply[]>([]);
  const [selectedReplyTemplateId, setSelectedReplyTemplateId] = useState('');
  const [selectedNoteTemplateId, setSelectedNoteTemplateId] = useState('');
  const [replyHtml, setReplyHtml] = useState('<p></p>');
  const [replyText, setReplyText] = useState('');
  const [internalNoteHtml, setInternalNoteHtml] = useState('<p></p>');
  const [internalNoteText, setInternalNoteText] = useState('');
  const [attachments, setAttachments] = useState<TicketAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifyingSupportOtp, setVerifyingSupportOtp] = useState(false);
  const [supportChallengeId, setSupportChallengeId] = useState('');
  const [supportOtpCode, setSupportOtpCode] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [canAdminManageTicket, setCanAdminManageTicket] = useState(isSuperAdmin);

  const canMutate = useMemo(() => Boolean(ticket), [ticket]);

  async function load() {
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/master/tickets/${encodeURIComponent(ticketId)}`, { cache: 'no-store' });
      const payload = (await res.json().catch(() => null)) as {
        ticket?: SupportTicket;
        messages?: SupportTicketMessage[];
        workspace?: { name?: string; id?: string };
        assignedToName?: string;
        supportUsers?: SupportUser[];
        canAdminManageTicket?: boolean;
        error?: string;
      } | null;

      if (!res.ok || !payload?.ticket) {
        throw new Error(payload?.error || 'Unable to load ticket');
      }

      setTicket(payload.ticket);
      setMessages(Array.isArray(payload.messages) ? payload.messages : []);
      setWorkspaceName(payload.workspace?.name || payload.ticket.workspaceId);
      setAssignedToName(payload.assignedToName || 'Unassigned');
      setSupportUsers(Array.isArray(payload.supportUsers) ? payload.supportUsers : []);
      setStatusDraft(payload.ticket.status);
      setPriorityDraft(payload.ticket.priority);
      setAssignedToDraft(payload.ticket.assignedTo || '');
      setCanAdminManageTicket(Boolean(payload.canAdminManageTicket));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load ticket');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [ticketId]);

  useEffect(() => {
    let cancelled = false;

    async function loadDefinedReplies() {
      try {
        const res = await fetch('/api/master/defined-replies', { cache: 'no-store' });
        const payload = (await res.json().catch(() => null)) as {
          ok?: boolean;
          definedReplies?: DefinedReply[];
        } | null;

        if (!res.ok || !payload?.ok || cancelled) return;
        setDefinedReplies(Array.isArray(payload.definedReplies) ? payload.definedReplies : []);
      } catch {
        // Ignore defined-replies loading failures in ticket detail view.
      }
    }

    void loadDefinedReplies();
    return () => {
      cancelled = true;
    };
  }, []);

  function appendHtmlBlock(current: string, insert: string): string {
    const base = current.trim();
    const snippet = insert.trim();
    if (!snippet) return base || '<p></p>';
    if (!base || base === '<p></p>') return snippet;
    return `${base}<p></p>${snippet}`;
  }

  function appendTextBlock(current: string, insert: string): string {
    const left = current.trim();
    const right = insert.trim();
    if (!right) return left;
    if (!left) return right;
    return `${left}\n\n${right}`;
  }

  function insertDefinedReplyIntoClientReply() {
    const selected = definedReplies.find((row) => row.id === selectedReplyTemplateId);
    if (!selected) return;

    setReplyHtml((current) => appendHtmlBlock(current, selected.contentHtml));
    setReplyText((current) => appendTextBlock(current, selected.contentText));
  }

  function insertDefinedReplyIntoInternalNote() {
    const selected = definedReplies.find((row) => row.id === selectedNoteTemplateId);
    if (!selected) return;

    setInternalNoteHtml((current) => appendHtmlBlock(current, selected.contentHtml));
    setInternalNoteText((current) => appendTextBlock(current, selected.contentText));
  }

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

  async function saveTicketMeta() {
    if (!ticket) return;
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const patchRes = await fetch(`/api/master/tickets/${encodeURIComponent(ticket.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: statusDraft, priority: priorityDraft }),
      });
      const patchPayload = (await patchRes.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!patchRes.ok || !patchPayload?.ok) {
        throw new Error(patchPayload?.error || 'Failed to update status/priority');
      }

      const assignRes = await fetch(`/api/master/tickets/${encodeURIComponent(ticket.id)}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedTo: assignedToDraft }),
      });
      const assignPayload = (await assignRes.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!assignRes.ok || !assignPayload?.ok) {
        throw new Error(assignPayload?.error || 'Failed to assign ticket');
      }

      setMessage('Ticket details updated.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update ticket');
    } finally {
      setSaving(false);
    }
  }

  async function submitReply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ticket) return;
    if (!replyText.trim()) {
      setError('Reply message is required.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const res = await fetch(`/api/master/tickets/${encodeURIComponent(ticket.id)}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageHtml: replyHtml, attachments }),
      });
      const payload = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !payload?.ok) {
        throw new Error(payload?.error || 'Failed to send reply');
      }

      setReplyHtml('<p></p>');
      setReplyText('');
      setAttachments([]);
      setMessage('Reply sent to client.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reply');
    } finally {
      setSaving(false);
    }
  }

  async function submitInternalNote() {
    if (!ticket) return;
    if (!internalNoteText.trim()) {
      setError('Internal note is required.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const res = await fetch(`/api/master/tickets/${encodeURIComponent(ticket.id)}/internal-note`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageHtml: internalNoteHtml }),
      });
      const payload = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !payload?.ok) {
        throw new Error(payload?.error || 'Failed to add internal note');
      }

      setInternalNoteHtml('<p></p>');
      setInternalNoteText('');
      setMessage('Internal note added.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add internal note');
    } finally {
      setSaving(false);
    }
  }

  async function triggerSupportAccessRequest() {
    if (!ticket) return;

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const res = await fetch('/api/master/support/request-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: ticket.workspaceId,
          reason: `Support request from ticket ${ticket.ticketNumber}`,
          clientEmail: ticket.clientEmail,
          clientUserId: ticket.clientUserId,
        }),
      });

      const payload = (await res.json().catch(() => null)) as { ok?: boolean; challengeId?: string; error?: string } | null;
      if (!res.ok || !payload?.ok) {
        throw new Error(payload?.error || 'Failed to request support access');
      }

      setSupportChallengeId(String(payload.challengeId || ''));
      setMessage(`Support access request sent. Ask the client for the 6-digit verification code and enter it below. Challenge ID: ${payload.challengeId || 'n/a'}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request support access');
    } finally {
      setSaving(false);
    }
  }

  async function verifySupportAccessCode() {
    if (!supportChallengeId.trim()) {
      setError('Challenge ID is required. Request support access first if this is empty.');
      return;
    }
    if (supportOtpCode.trim().length !== 6) {
      setError('Enter the 6-digit verification code from the client email.');
      return;
    }

    setVerifyingSupportOtp(true);
    setError('');
    setMessage('');

    try {
      const res = await fetch('/api/master/support/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId: supportChallengeId.trim(),
          otpCode: supportOtpCode.trim(),
        }),
      });

      const payload = (await res.json().catch(() => null)) as {
        ok?: boolean;
        supportSession?: { id?: string; expiresAt?: string };
        error?: string;
      } | null;

      if (!res.ok || !payload?.ok) {
        throw new Error(payload?.error || 'Failed to verify support access code');
      }

      setSupportOtpCode('');
      setMessage(`Support access approved. Session ${payload.supportSession?.id || 'n/a'} created${payload.supportSession?.expiresAt ? ` and expires at ${new Date(payload.supportSession.expiresAt).toLocaleString()}` : ''}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify support access code');
    } finally {
      setVerifyingSupportOtp(false);
    }
  }

  async function resetCurrentTicket() {
    if (!ticket) return;
    const confirmed = window.confirm('Reset this ticket to Open + Normal priority and clear assignee?');
    if (!confirmed) return;

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const res = await fetch(`/api/master/tickets/${encodeURIComponent(ticket.id)}/reset`, {
        method: 'POST',
      });
      const payload = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !payload?.ok) {
        throw new Error(payload?.error || 'Failed to reset ticket');
      }

      setMessage('Ticket reset completed.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset ticket');
    } finally {
      setSaving(false);
    }
  }

  async function deleteCurrentTicket() {
    if (!ticket) return;
    const confirmed = window.confirm(`Permanently delete ${ticket.ticketNumber}? This cannot be undone.`);
    if (!confirmed) return;

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const res = await fetch(`/api/master/tickets/${encodeURIComponent(ticket.id)}`, {
        method: 'DELETE',
      });
      const payload = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !payload?.ok) {
        throw new Error(payload?.error || 'Failed to delete ticket');
      }

      router.push('/master/tickets?notice=ticket_deleted');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete ticket');
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading ticket...</div>;
  }

  if (error && !ticket) {
    return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">{error}</div>;
  }

  if (!ticket) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Ticket not found.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Master Support Center</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">{ticket.ticketNumber}</h1>
          <p className="mt-2 text-sm text-slate-600">{ticket.subject}</p>
        </div>
        <Link href="/master/tickets" className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">
          Back to Tickets
        </Link>
      </div>

      <SupportCenterTabs active="tickets" />

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div> : null}

      <section className="grid gap-4 lg:grid-cols-3">
        <article className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Client Info</h2>
          <p className="text-sm font-medium text-slate-900">{ticket.clientName}</p>
          <p className="text-sm text-slate-600">{ticket.clientEmail}</p>
          <p className="text-xs text-slate-500">User ID: {ticket.clientUserId || 'n/a'}</p>
        </article>

        <article className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Workspace</h2>
          <p className="text-sm font-medium text-slate-900">{workspaceName}</p>
          <p className="text-xs text-slate-500">Workspace ID: {ticket.workspaceId}</p>
          <p className="text-xs text-slate-500">Related module: {ticket.relatedModule || 'n/a'}</p>
          <Link href={`/master/workspaces?workspaceId=${encodeURIComponent(ticket.workspaceId)}`} className="inline-block text-xs font-semibold text-slate-700 underline">
            Open workspace
          </Link>
        </article>

        <article className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Ticket Snapshot</h2>
          <div className="flex flex-wrap gap-2">
            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${ticketStatusBadgeClass(ticket.status)}`}>
              {TICKET_STATUS_LABEL[ticket.status]}
            </span>
            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${ticketPriorityBadgeClass(ticket.priority)}`}>
              {TICKET_PRIORITY_LABEL[ticket.priority]}
            </span>
          </div>
          <p className="text-xs text-slate-500">Assigned to: {assignedToName}</p>
          <p className="text-xs text-slate-500">Created: {new Date(ticket.createdAt).toLocaleString()}</p>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Assignment Controls</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-sm font-medium text-slate-700">
            Status
            <select value={statusDraft} onChange={(event) => setStatusDraft(event.target.value as TicketStatus)} className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
              {STATUS_OPTIONS.map((item) => (
                <option key={item} value={item}>{TICKET_STATUS_LABEL[item]}</option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-slate-700">
            Priority
            <select value={priorityDraft} onChange={(event) => setPriorityDraft(event.target.value as TicketPriority)} className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
              {PRIORITY_OPTIONS.map((item) => (
                <option key={item} value={item}>{TICKET_PRIORITY_LABEL[item]}</option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-slate-700">
            Assign To
            <select value={assignedToDraft} onChange={(event) => setAssignedToDraft(event.target.value)} className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
              <option value="">Unassigned</option>
              {supportUsers.map((user) => (
                <option key={user.id} value={user.id}>{user.name} ({user.email})</option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void saveTicketMeta()}
            disabled={!canMutate || saving}
            className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            type="button"
            onClick={() => void triggerSupportAccessRequest()}
            disabled={!canMutate || saving}
            className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 disabled:opacity-60"
          >
            Trigger Support Access Request
          </button>
          {canAdminManageTicket ? (
            <button
              type="button"
              onClick={() => void resetCurrentTicket()}
              disabled={!canMutate || saving}
              className="rounded-full border border-rose-300 px-5 py-2.5 text-sm font-semibold text-rose-700 disabled:opacity-60"
            >
              Reset Ticket
            </button>
          ) : null}
          {canAdminManageTicket ? (
            <button
              type="button"
              onClick={() => void deleteCurrentTicket()}
              disabled={!canMutate || saving}
              className="rounded-full border border-red-400 bg-red-50 px-5 py-2.5 text-sm font-semibold text-red-800 disabled:opacity-60"
            >
              Delete Ticket
            </button>
          ) : null}
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-amber-900">Verify Client Code For Support Access</h3>
          <p className="text-xs text-amber-800">
            The verification code sent to the client email must be entered here to approve the support session.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              Challenge ID
              <input
                value={supportChallengeId}
                onChange={(event) => setSupportChallengeId(event.target.value)}
                placeholder="Auto-filled after request"
                className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Verification Code
              <input
                value={supportOtpCode}
                onChange={(event) => setSupportOtpCode(event.target.value.replace(/\D+/g, '').slice(0, 6))}
                placeholder="6-digit code from client email"
                inputMode="numeric"
                className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={() => void verifySupportAccessCode()}
            disabled={verifyingSupportOtp || saving}
            className="rounded-full border border-amber-300 bg-white px-5 py-2 text-sm font-semibold text-amber-900 disabled:opacity-60"
          >
            {verifyingSupportOtp ? 'Verifying...' : 'Verify Code And Create Session'}
          </button>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">Conversation Thread</h2>
        {messages.map((messageItem) => (
          <article key={messageItem.id} className={`rounded-2xl border p-4 ${messageItem.isInternalNote ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'}`}>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <span>{messageItem.authorName} ({messageItem.authorType}) {messageItem.isInternalNote ? '• Internal Note' : ''}</span>
              <span>{new Date(messageItem.createdAt).toLocaleString()}</span>
            </div>
            <div className="prose prose-sm max-w-none text-slate-800" dangerouslySetInnerHTML={{ __html: messageItem.messageHtml }} />
            {messageItem.attachments.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {messageItem.attachments.map((attachment) => (
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
      </section>

      <form onSubmit={submitReply} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">Reply to Client</h2>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-900">Insert Defined Reply</p>
          <p className="mt-1 text-xs text-slate-600">Select a reusable response and insert it into this reply.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <select
              value={selectedReplyTemplateId}
              onChange={(event) => setSelectedReplyTemplateId(event.target.value)}
              className="min-w-[260px] rounded-xl border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Select defined reply</option>
              {definedReplies.map((row) => (
                <option key={row.id} value={row.id}>{row.title}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={insertDefinedReplyIntoClientReply}
              disabled={!selectedReplyTemplateId}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
            >
              Insert
            </button>
          </div>
        </div>

        <RichTextEditor
          value={replyHtml}
          placeholder="Write a support reply..."
          disabled={saving}
          onChange={({ html, text }) => {
            setReplyHtml(html);
            setReplyText(text);
          }}
        />

        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4">
          <input type="file" multiple onChange={(event) => void uploadFiles(event.target.files)} disabled={saving} className="text-sm" />
          <p className="mt-2 text-xs text-slate-500">Attach optional files for the client reply.</p>
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

        <button
          type="submit"
          disabled={saving || uploading}
          className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {saving ? 'Sending...' : 'Send Reply'}
        </button>
      </form>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">Internal Notes</h2>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-900">Insert Defined Reply</p>
          <p className="mt-1 text-xs text-slate-600">Select a reusable response and insert it into this internal note.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <select
              value={selectedNoteTemplateId}
              onChange={(event) => setSelectedNoteTemplateId(event.target.value)}
              className="min-w-[260px] rounded-xl border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Select defined reply</option>
              {definedReplies.map((row) => (
                <option key={row.id} value={row.id}>{row.title}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={insertDefinedReplyIntoInternalNote}
              disabled={!selectedNoteTemplateId}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
            >
              Insert
            </button>
          </div>
        </div>

        <RichTextEditor
          value={internalNoteHtml}
          placeholder="Add an internal note only visible to support/master..."
          disabled={saving}
          onChange={({ html, text }) => {
            setInternalNoteHtml(html);
            setInternalNoteText(text);
          }}
        />
        <button
          type="button"
          onClick={() => void submitInternalNote()}
          disabled={saving}
          className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 disabled:opacity-60"
        >
          {saving ? 'Saving...' : 'Add Internal Note'}
        </button>
      </section>
    </div>
  );
}
