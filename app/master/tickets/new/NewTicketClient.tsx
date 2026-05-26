'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import RichTextEditor from '@/components/editor/RichTextEditor';
import type { TicketCategory, TicketPriority } from '@/lib/adminStore';
import { TICKET_CATEGORY_LABEL, TICKET_PRIORITY_LABEL } from '@/lib/tickets/labels';

type WorkspaceRow = {
  id: string;
  name: string;
  businessProfile?: {
    contactEmail?: string;
    email?: string;
  };
  collectedBusinessData?: {
    contactEmail?: string;
    email?: string;
  };
};

type WorkspaceClientRow = {
  id: string;
  name: string;
  email: string;
  workspaceId: string;
  workspaceName: string;
};

type DefinedReplyRow = {
  id: string;
  title: string;
  contentHtml: string;
  contentText: string;
  updatedAt: string;
};

type NotificationHealth = {
  ok?: boolean;
  supportEmailConfigured?: boolean;
  supportEmail?: string;
  fallbackRecipients?: string[];
  supportRecipients?: string[];
  canNotifySupport?: boolean;
};

const CATEGORY_OPTIONS: TicketCategory[] = [
  'complaint',
  'billing',
  'technical_support',
  'website_support',
  'whatsapp_integration',
  'general_enquiry',
];

const PRIORITY_OPTIONS: TicketPriority[] = ['low', 'normal', 'high', 'urgent'];

function resolveWorkspaceClientEmail(workspace: WorkspaceRow | null): string {
  if (!workspace) return '';

  return String(
    workspace.businessProfile?.contactEmail
      || workspace.businessProfile?.email
      || workspace.collectedBusinessData?.contactEmail
      || workspace.collectedBusinessData?.email
      || '',
  ).trim().toLowerCase();
}

export default function NewMasterTicketClient() {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<WorkspaceRow[]>([]);
  const [workspaceClients, setWorkspaceClients] = useState<WorkspaceClientRow[]>([]);
  const [workspaceId, setWorkspaceId] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientUserId, setClientUserId] = useState('');
  const [category, setCategory] = useState<TicketCategory>('general_enquiry');
  const [priority, setPriority] = useState<TicketPriority>('normal');
  const [definedReplies, setDefinedReplies] = useState<DefinedReplyRow[]>([]);
  const [notificationHealth, setNotificationHealth] = useState<NotificationHealth | null>(null);
  const [selectedDefinedReplyId, setSelectedDefinedReplyId] = useState('');
  const [subject, setSubject] = useState('');
  const [descriptionHtml, setDescriptionHtml] = useState('<p></p>');
  const [descriptionText, setDescriptionText] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const selectedWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === workspaceId) || null,
    [workspaces, workspaceId],
  );

  const clientsForWorkspace = useMemo(
    () => workspaceClients.filter((row) => row.workspaceId === workspaceId),
    [workspaceClients, workspaceId],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadWorkspaces() {
      setLoading(true);
      setError('');

      try {
        const res = await fetch('/api/cloud/workspaces', { cache: 'no-store' });
        const payload = (await res.json().catch(() => null)) as { workspaces?: WorkspaceRow[]; error?: string } | null;
        if (!res.ok) {
          throw new Error(payload?.error || 'Failed to load workspaces');
        }

        if (!cancelled) {
          const rows = Array.isArray(payload?.workspaces) ? payload.workspaces : [];
          setWorkspaces(rows);
          if (!workspaceId && rows.length > 0) {
            setWorkspaceId(rows[0].id);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load workspaces');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadWorkspaces();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadNotificationHealth() {
      try {
        const res = await fetch('/api/master/tickets/notification-health', { cache: 'no-store' });
        const payload = (await res.json().catch(() => null)) as NotificationHealth | null;
        if (!res.ok || !payload?.ok || cancelled) return;

        setNotificationHealth(payload);
      } catch {
        // Ignore notification health failures and continue form usage.
      }
    }

    void loadNotificationHealth();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadDefinedReplies() {
      try {
        const res = await fetch('/api/master/defined-replies', { cache: 'no-store' });
        const payload = (await res.json().catch(() => null)) as {
          ok?: boolean;
          definedReplies?: DefinedReplyRow[];
        } | null;
        if (!res.ok || !payload?.ok || cancelled) return;

        const rows = Array.isArray(payload.definedReplies) ? payload.definedReplies : [];
        setDefinedReplies(rows);
      } catch {
        // Ignore defined-replies loading failure in ticket form.
      }
    }

    void loadDefinedReplies();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedWorkspace) return;

    const firstClient = clientsForWorkspace[0] || null;
    if (!firstClient) {
      setClientUserId('');
      setClientName('');
      setClientEmail('');
      return;
    }

    setClientUserId(firstClient.id);
    setClientName(firstClient.name);
    setClientEmail(firstClient.email);
  }, [selectedWorkspace, clientsForWorkspace]);

  useEffect(() => {
    let cancelled = false;

    async function loadWorkspaceClients() {
      try {
        const res = await fetch('/api/master/tickets/clients', { cache: 'no-store' });
        const payload = (await res.json().catch(() => null)) as { ok?: boolean; clients?: WorkspaceClientRow[] } | null;
        if (!res.ok || !payload?.ok || cancelled) return;

        setWorkspaceClients(Array.isArray(payload.clients) ? payload.clients : []);
      } catch {
        // Ignore client-directory loading failures and let form surface required validation.
      }
    }

    void loadWorkspaceClients();
    return () => {
      cancelled = true;
    };
  }, []);

  function insertDefinedReply() {
    const reply = definedReplies.find((item) => item.id === selectedDefinedReplyId);
    if (!reply) return;

    setDescriptionHtml((current) => {
      const base = current.trim();
      if (!base || base === '<p></p>') return reply.contentHtml;
      return `${base}<p></p>${reply.contentHtml}`;
    });
    setDescriptionText((current) => `${current.trim()}\n\n${reply.contentText}`.trim());
  }

  async function submitTicket(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    if (!workspaceId) {
      setError('Workspace is required.');
      setSubmitting(false);
      return;
    }

    if (!clientUserId) {
      setError('Select an existing client for this workspace.');
      setSubmitting(false);
      return;
    }

    if (!subject.trim()) {
      setError('Subject is required.');
      setSubmitting(false);
      return;
    }

    if (!descriptionText.trim()) {
      setError('Description is required.');
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch('/api/master/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          clientName,
          clientEmail,
          clientUserId,
          category,
          priority,
          subject,
          descriptionHtml,
        }),
      });

      const payload = (await res.json().catch(() => null)) as { ok?: boolean; ticket?: { id: string }; error?: string } | null;
      if (!res.ok || !payload?.ok || !payload.ticket) {
        throw new Error(payload?.error || 'Failed to create ticket');
      }

      router.push(`/master/tickets/${payload.ticket.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create ticket');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Master Support Center</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Create Ticket</h1>
        <p className="mt-2 text-sm text-slate-600">Create a support ticket manually for any workspace.</p>
      </div>

      <form onSubmit={submitTicket} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            Workspace
            <select
              value={workspaceId}
              onChange={(event) => setWorkspaceId(event.target.value)}
              className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              disabled={loading}
            >
              <option value="">Select workspace</option>
              {workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name} ({workspace.id})
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Existing client
            <select
              value={clientUserId}
              onChange={(event) => {
                const selected = clientsForWorkspace.find((row) => row.id === event.target.value) || null;
                setClientUserId(event.target.value);
                setClientName(selected?.name || '');
                setClientEmail(selected?.email || '');
              }}
              className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              disabled={!workspaceId}
            >
              <option value="">Select existing client</option>
              {clientsForWorkspace.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name} ({client.email})
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            Client email
            <input
              value={clientEmail}
              readOnly
              className="mt-1 block w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Client name
            <input
              value={clientName}
              readOnly
              className="mt-1 block w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            Category
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as TicketCategory)}
              className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            >
              {CATEGORY_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {TICKET_CATEGORY_LABEL[item]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Priority
            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value as TicketPriority)}
              className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            >
              {PRIORITY_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {TICKET_PRIORITY_LABEL[item]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-900">Defined Reply</p>
          <p className="mt-1 text-xs text-slate-600">Insert a reusable response block into the description.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <select
              value={selectedDefinedReplyId}
              onChange={(event) => setSelectedDefinedReplyId(event.target.value)}
              className="min-w-[260px] rounded-xl border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Select defined reply</option>
              {definedReplies.map((reply) => (
                <option key={reply.id} value={reply.id}>{reply.title}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={insertDefinedReply}
              disabled={!selectedDefinedReplyId}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
            >
              Insert
            </button>
          </div>
        </div>

        <label className="block text-sm font-medium text-slate-700">
          Subject
          <input
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder="Brief summary of the issue"
            className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            maxLength={180}
            required
          />
        </label>

        <div>
          <p className="text-sm font-medium text-slate-700">Description</p>
          <div className="mt-1">
            <RichTextEditor
              value={descriptionHtml}
              placeholder="Describe the issue, context, and what the team should do next..."
              onChange={({ html, text }) => {
                setDescriptionHtml(html);
                setDescriptionText(text);
              }}
            />
          </div>
        </div>

        {selectedWorkspace ? (
          <p className="text-xs text-slate-500">
            Existing clients for workspace: {clientsForWorkspace.length}
          </p>
        ) : null}

        <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-800">
          Client-created tickets also appear in this Master ticket queue.
        </div>

        {notificationHealth && !notificationHealth.supportEmailConfigured ? (
          <div
            className={`rounded-2xl px-4 py-3 text-xs ${notificationHealth.canNotifySupport
              ? 'border border-amber-200 bg-amber-50 text-amber-900'
              : 'border border-rose-200 bg-rose-50 text-rose-800'}`}
          >
            <p className="font-semibold">
              {notificationHealth.canNotifySupport
                ? 'Support email is not configured. Fallback recipients will receive support notifications.'
                : 'Support notification recipients are not configured. Marveo support will not receive ticket creation emails.'}
            </p>
            {Array.isArray(notificationHealth.fallbackRecipients) && notificationHealth.fallbackRecipients.length > 0 ? (
              <p className="mt-1 break-all">
                Fallback recipients: {notificationHealth.fallbackRecipients.join(', ')}
              </p>
            ) : null}
          </div>
        ) : null}

        {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={submitting || loading}
            className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {submitting ? 'Creating...' : 'Create Ticket'}
          </button>
          <Link href="/master/tickets" className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
