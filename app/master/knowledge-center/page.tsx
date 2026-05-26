'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import RichTextEditor from '@/components/editor/RichTextEditor';

type Audience = 'internal' | 'client' | 'both';

type KnowledgeArticle = {
  id: string;
  title: string;
  summary: string;
  audience: Audience;
  sourceDoc?: string;
  heroImageUrl?: string;
  videoUrl?: string;
  contentHtml: string;
  contentText: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export default function KnowledgeCenterPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [internal, setInternal] = useState(true);
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);

  const [audienceFilter, setAudienceFilter] = useState<'' | Audience>('');
  const [query, setQuery] = useState('');

  const [editingId, setEditingId] = useState('');
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [audience, setAudience] = useState<Audience>('both');
  const [sourceDoc, setSourceDoc] = useState('');
  const [heroImageUrl, setHeroImageUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [contentHtml, setContentHtml] = useState('<p></p>');
  const [contentText, setContentText] = useState('');

  const canEdit = internal;

  async function loadArticles(nextAudience = audienceFilter, nextQuery = query) {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();
      if (nextAudience) params.set('audience', nextAudience);
      if (nextQuery.trim()) params.set('q', nextQuery.trim());

      const res = await fetch(`/api/master/knowledge-center?${params.toString()}`, { cache: 'no-store' });
      const payload = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        internal?: boolean;
        articles?: KnowledgeArticle[];
      } | null;

      if (!res.ok || !payload?.ok) {
        throw new Error(payload?.error || 'Unable to load knowledge center articles.');
      }

      setInternal(Boolean(payload.internal));
      setArticles(Array.isArray(payload.articles) ? payload.articles : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load knowledge center articles.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadArticles();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetForm() {
    setEditingId('');
    setTitle('');
    setSummary('');
    setAudience('both');
    setSourceDoc('');
    setHeroImageUrl('');
    setVideoUrl('');
    setContentHtml('<p></p>');
    setContentText('');
  }

  async function saveArticle() {
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    if (!contentText.trim()) {
      setError('Article content is required.');
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');

    try {
      const res = await fetch('/api/master/knowledge-center', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId || undefined,
          title,
          summary,
          audience,
          sourceDoc,
          heroImageUrl,
          videoUrl,
          contentHtml,
        }),
      });

      const payload = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !payload?.ok) {
        throw new Error(payload?.error || 'Unable to save article.');
      }

      setNotice(editingId ? 'Knowledge article updated.' : 'Knowledge article created.');
      resetForm();
      await loadArticles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save article.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteArticle(id: string) {
    const confirmed = window.confirm('Delete this knowledge article?');
    if (!confirmed) return;

    setSaving(true);
    setError('');
    setNotice('');

    try {
      const res = await fetch('/api/master/knowledge-center', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, delete: true }),
      });

      const payload = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !payload?.ok) {
        throw new Error(payload?.error || 'Unable to delete article.');
      }

      if (editingId === id) resetForm();
      setNotice('Knowledge article deleted.');
      await loadArticles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete article.');
    } finally {
      setSaving(false);
    }
  }

  const emptyText = useMemo(() => {
    if (loading) return 'Loading knowledge center...';
    return 'No articles found for this filter.';
  }, [loading]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Support & Operations</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Knowledge Center</h1>
        <p className="mt-2 text-sm text-slate-600">Central how-to guides for internal teams and clients. Internal users can access and manage both internal and client articles.</p>
      </div>

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      {notice ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div> : null}

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-sm font-medium text-slate-700">
            Audience filter
            <select
              value={audienceFilter}
              onChange={(event) => {
                const next = event.target.value as '' | Audience;
                setAudienceFilter(next);
                void loadArticles(next, query);
              }}
              className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">All audiences</option>
              <option value="client">Client</option>
              <option value="internal">Internal</option>
              <option value="both">Both</option>
            </select>
          </label>

          <label className="text-sm font-medium text-slate-700 md:col-span-2">
            Search
            <div className="mt-1 flex gap-2">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search title, summary, content..."
                className="block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => void loadArticles(audienceFilter, query)}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Apply
              </button>
            </div>
          </label>
        </div>
      </section>

      {canEdit ? (
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">{editingId ? 'Edit Article' : 'Create Article'}</h2>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              Title
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={140}
                className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="text-sm font-medium text-slate-700">
              Audience
              <select
                value={audience}
                onChange={(event) => setAudience(event.target.value as Audience)}
                className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="both">Both Internal + Client</option>
                <option value="client">Client only</option>
                <option value="internal">Internal only</option>
              </select>
            </label>
          </div>

          <label className="block text-sm font-medium text-slate-700">
            Summary
            <textarea
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              rows={2}
              maxLength={260}
              className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-sm font-medium text-slate-700">
              Source doc (optional)
              <input
                value={sourceDoc}
                onChange={(event) => setSourceDoc(event.target.value)}
                placeholder="marveo-website/docs/..."
                className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Screenshot/Image URL (optional)
              <input
                value={heroImageUrl}
                onChange={(event) => setHeroImageUrl(event.target.value)}
                placeholder="https://..."
                className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Video link (optional)
              <input
                value={videoUrl}
                onChange={(event) => setVideoUrl(event.target.value)}
                placeholder="https://youtube.com/..."
                className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <div>
            <p className="text-sm font-medium text-slate-700">Article Content</p>
            <div className="mt-1">
              <RichTextEditor
                value={contentHtml}
                placeholder="Write or paste your how-to content here..."
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
              onClick={() => void saveArticle()}
              disabled={saving}
              className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? 'Saving...' : editingId ? 'Update Article' : 'Create Article'}
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
      ) : null}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Articles</h2>
        {loading || articles.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">{emptyText}</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {articles.map((article) => (
              <article key={article.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">{article.title}</h3>
                    <p className="mt-1 text-xs text-slate-500">Updated: {new Date(article.updatedAt).toLocaleString()}</p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Audience: {article.audience}</p>
                  </div>
                </div>

                {article.summary ? <p className="mt-3 text-sm text-slate-600">{article.summary}</p> : null}
                {article.heroImageUrl ? (
                  <Image
                    src={article.heroImageUrl}
                    alt={article.title}
                    width={1200}
                    height={675}
                    unoptimized
                    className="mt-3 max-h-48 w-full rounded-xl border border-slate-200 object-cover"
                  />
                ) : null}
                {article.videoUrl ? (
                  <p className="mt-3 text-xs text-blue-700">
                    Video: <a href={article.videoUrl} target="_blank" rel="noreferrer" className="underline">{article.videoUrl}</a>
                  </p>
                ) : null}
                {article.sourceDoc ? <p className="mt-2 text-[11px] text-slate-400">Source: {article.sourceDoc}</p> : null}

                <div className="prose prose-sm mt-3 max-w-none text-slate-700" dangerouslySetInnerHTML={{ __html: article.contentHtml }} />

                {canEdit ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(article.id);
                        setTitle(article.title);
                        setSummary(article.summary);
                        setAudience(article.audience);
                        setSourceDoc(article.sourceDoc || '');
                        setHeroImageUrl(article.heroImageUrl || '');
                        setVideoUrl(article.videoUrl || '');
                        setContentHtml(article.contentHtml);
                        setContentText(article.contentText);
                      }}
                      className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteArticle(article.id)}
                      className="rounded-full border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-700"
                    >
                      Delete
                    </button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
