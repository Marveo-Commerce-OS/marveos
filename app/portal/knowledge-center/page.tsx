'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

type KnowledgeArticle = {
  id: string;
  title: string;
  summary: string;
  audience: 'internal' | 'client' | 'both';
  sourceDoc?: string;
  heroImageUrl?: string;
  videoUrl?: string;
  contentHtml: string;
  updatedAt: string;
};

export default function PortalKnowledgeCenterPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const res = await fetch('/api/master/knowledge-center?audience=client', { cache: 'no-store' });
        const payload = (await res.json().catch(() => null)) as {
          ok?: boolean;
          error?: string;
          articles?: KnowledgeArticle[];
        } | null;
        if (!res.ok || !payload?.ok) {
          throw new Error(payload?.error || 'Unable to load knowledge center.');
        }
        if (cancelled) return;
        setArticles(Array.isArray(payload.articles) ? payload.articles : []);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Unable to load knowledge center.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 md:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Client Help</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Knowledge Center</h1>
          <p className="mt-2 text-sm text-slate-600">How-to guides for setup, connection, verification, and support workflows.</p>
        </div>

        {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading knowledge articles...</div>
        ) : articles.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">No client-facing articles available yet.</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {articles.map((article) => (
              <article key={article.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <h2 className="text-base font-semibold text-slate-900">{article.title}</h2>
                <p className="mt-1 text-xs text-slate-500">Updated {new Date(article.updatedAt).toLocaleString()}</p>
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
                    Video guide: <a href={article.videoUrl} target="_blank" rel="noreferrer" className="underline">{article.videoUrl}</a>
                  </p>
                ) : null}
                <div className="prose prose-sm mt-3 max-w-none text-slate-700" dangerouslySetInnerHTML={{ __html: article.contentHtml }} />
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
