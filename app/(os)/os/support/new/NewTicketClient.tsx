'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import RichTextEditor from '@/components/editor/RichTextEditor';
import type { TicketAttachment, TicketCategory, TicketPriority } from '@/lib/adminStore';
import { TICKET_CATEGORY_LABEL, TICKET_PRIORITY_LABEL } from '@/lib/tickets/labels';

const CATEGORY_OPTIONS: TicketCategory[] = [
  'complaint',
  'billing',
  'technical_support',
  'website_support',
  'whatsapp_integration',
  'general_enquiry',
];

const PRIORITY_OPTIONS: TicketPriority[] = ['low', 'normal', 'high', 'urgent'];

export default function NewTicketClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedCategory = String(searchParams.get('category') || '').trim() as TicketCategory;
  const initialCategory = CATEGORY_OPTIONS.includes(requestedCategory) ? requestedCategory : 'general_enquiry';
  const [category, setCategory] = useState<TicketCategory>(initialCategory);
  const [priority, setPriority] = useState<TicketPriority>('normal');
  const [relatedModule, setRelatedModule] = useState('');
  const [subject, setSubject] = useState('');
  const [descriptionHtml, setDescriptionHtml] = useState('<p></p>');
  const [descriptionText, setDescriptionText] = useState('');
  const [attachments, setAttachments] = useState<TicketAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

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

  async function submitTicket(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');

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
      const res = await fetch('/api/os/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          priority,
          relatedModule,
          subject,
          descriptionHtml,
          attachments,
        }),
      });

      const payload = (await res.json().catch(() => null)) as { ok?: boolean; ticket?: { id: string }; error?: string } | null;
      if (!res.ok || !payload?.ok || !payload.ticket) {
        throw new Error(payload?.error || 'Failed to create ticket');
      }

      router.push(`/os/support/${payload.ticket.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create ticket');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 md:px-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Support Center</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">Create New Ticket</h1>
          <p className="mt-2 text-sm text-slate-600">Share details clearly so the support team can help quickly.</p>
        </div>

        <form onSubmit={submitTicket} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              Category
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value as TicketCategory)}
                className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              >
                {CATEGORY_OPTIONS.map((item) => (
                  <option key={item} value={item}>{TICKET_CATEGORY_LABEL[item]}</option>
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
                  <option key={item} value={item}>{TICKET_PRIORITY_LABEL[item]}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="block text-sm font-medium text-slate-700">
            Related module
            <input
              value={relatedModule}
              onChange={(event) => setRelatedModule(event.target.value)}
              placeholder="e.g. billing, checkout, whatsapp"
              className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

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
                placeholder="Describe your request in detail..."
                onChange={({ html, text }) => {
                  setDescriptionHtml(html);
                  setDescriptionText(text);
                }}
              />
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-slate-700">Attachments</p>
            <div className="mt-1 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4">
              <input type="file" multiple onChange={(event) => void uploadFiles(event.target.files)} className="text-sm" />
              <p className="mt-2 text-xs text-slate-500">Attach screenshots or related files. If upload is unavailable, submit without files.</p>
            </div>
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

          {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={submitting || uploading}
              className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {submitting ? 'Submitting...' : 'Submit Ticket'}
            </button>
            <Link href="/os/support" className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
