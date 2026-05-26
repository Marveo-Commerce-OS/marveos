'use client';

import { useEffect, useState } from 'react';
import RichTextEditor from '@/components/editor/RichTextEditor';

type DefinedReply = {
  id: string;
  title: string;
  contentHtml: string;
  contentText: string;
  createdAt: string;
  updatedAt: string;
};

export default function DefinedRepliesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [definedReplies, setDefinedReplies] = useState<DefinedReply[]>([]);
  const [editingId, setEditingId] = useState('');
  const [title, setTitle] = useState('');
  const [contentHtml, setContentHtml] = useState('<p></p>');
  const [contentText, setContentText] = useState('');

  async function loadReplies() {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/master/defined-replies', { cache: 'no-store' });
      const payload = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        definedReplies?: DefinedReply[];
      } | null;

      if (!res.ok || !payload?.ok) {
        throw new Error(payload?.error || 'Unable to load defined replies.');
      }

      setDefinedReplies(Array.isArray(payload.definedReplies) ? payload.definedReplies : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load defined replies.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadReplies();
  }, []);

  function resetForm() {
    setEditingId('');
    setTitle('');
    setContentHtml('<p></p>');
    setContentText('');
  }

  async function saveReply() {
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    if (!contentText.trim()) {
      setError('Reply content is required.');
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');

    try {
      const res = await fetch('/api/master/defined-replies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId || undefined,
          title,
          contentHtml,
        }),
      });

      const payload = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;

      if (!res.ok || !payload?.ok) {
        throw new Error(payload?.error || 'Unable to save defined reply.');
      }

      setNotice(editingId ? 'Defined reply updated.' : 'Defined reply created.');
      resetForm();
      await loadReplies();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save defined reply.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteReply(id: string) {
    const confirmed = window.confirm('Delete this defined reply?');
    if (!confirmed) return;

    setSaving(true);
    setError('');
    setNotice('');

    try {
      const res = await fetch('/api/master/defined-replies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, delete: true }),
      });

      const payload = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;

      if (!res.ok || !payload?.ok) {
        throw new Error(payload?.error || 'Unable to delete defined reply.');
      }

      if (editingId === id) resetForm();
      setNotice('Defined reply deleted.');
      await loadReplies();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete defined reply.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Master Support Center</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Defined Replies</h1>
        <p className="mt-2 text-sm text-slate-600">Create reusable support responses and insert them while writing ticket descriptions/replies.</p>
      </div>

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      {notice ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div> : null}

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">{editingId ? 'Edit Defined Reply' : 'Create Defined Reply'}</h2>
        <label className="block text-sm font-medium text-slate-700">
          Title
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g. Initial troubleshooting response"
            className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            maxLength={120}
          />
        </label>

        <div>
          <p className="text-sm font-medium text-slate-700">Reply Content</p>
          <div className="mt-1">
            <RichTextEditor
              value={contentHtml}
              placeholder="Write the reusable response here..."
              onChange={({ html, text }) => {
                setContentHtml(html);
                setContentText(text);
              }}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void saveReply()}
            disabled={saving}
            className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? 'Saving...' : editingId ? 'Update Reply' : 'Create Reply'}
          </button>
          {editingId ? (
            <button
              type="button"
              onClick={resetForm}
              disabled={saving}
              className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 disabled:opacity-60"
            >
              Cancel Edit
            </button>
          ) : null}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Saved Replies</h2>
        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading defined replies...</div>
        ) : definedReplies.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">No defined replies yet.</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {definedReplies.map((reply) => (
              <article key={reply.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">{reply.title}</h3>
                    <p className="mt-1 text-xs text-slate-500">Updated: {new Date(reply.updatedAt).toLocaleString()}</p>
                  </div>
                </div>

                <div className="prose prose-sm mt-3 max-w-none text-slate-700" dangerouslySetInnerHTML={{ __html: reply.contentHtml }} />

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(reply.id);
                      setTitle(reply.title);
                      setContentHtml(reply.contentHtml);
                      setContentText(reply.contentText);
                    }}
                    className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteReply(reply.id)}
                    className="rounded-full border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-700"
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
