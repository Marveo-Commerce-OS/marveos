'use client';

export const dynamic = 'force-dynamic';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Save, ArrowLeft, AlertCircle } from 'lucide-react';

type SectionKind = 'heading' | 'paragraph' | 'image' | 'button';

interface EditableSection {
  id: string;
  kind: SectionKind;
  label: string;
  text: string;
  tag?: string;
  src?: string;
  alt?: string;
  href?: string;
}

interface PagePayload {
  sourceType: 'wordpress' | 'nextjs';
  id: string;
  title: string;
  slug: string;
  status: string;
  link: string;
  sections: EditableSection[];
}

const inputCls = 'w-full h-11 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all';
const labelCls = 'text-xs font-semibold uppercase tracking-wide text-gray-500';

export default function PageEditorPage() {
  const params = useParams();
  const router = useRouter();
  const search = useSearchParams();

  const pageId = String(params?.id ?? '');
  const sourceType = search.get('sourceType') === 'nextjs' ? 'nextjs' : 'wordpress';
  const baseUrl = String(search.get('baseUrl') || '').trim();
  const slug = String(search.get('slug') || '').trim();
  const pageUrl = String(search.get('pageUrl') || '').trim();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [page, setPage] = useState<PagePayload | null>(null);

  useEffect(() => {
    const loadPage = async () => {
      if (!pageId || !baseUrl) {
        setError('Missing page context. Go back and resync pages with source URL first.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');
      try {
        const query = new URLSearchParams({
          sourceType,
          baseUrl,
          slug,
          pageUrl,
        });
        const res = await fetch(`/api/pages/${encodeURIComponent(pageId)}?${query.toString()}`, {
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        });
        const data = (await res.json()) as PagePayload & { error?: string };
        if (!res.ok) {
          throw new Error(data?.error || 'Failed to load page sections');
        }

        setPage(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load page sections');
      } finally {
        setLoading(false);
      }
    };

    void loadPage();
  }, [baseUrl, pageId, pageUrl, slug, sourceType]);

  const sectionSummary = useMemo(() => {
    if (!page) return 'No sections loaded yet.';
    const total = page.sections.length;
    const headings = page.sections.filter((item) => item.kind === 'heading').length;
    const paragraphs = page.sections.filter((item) => item.kind === 'paragraph').length;
    const images = page.sections.filter((item) => item.kind === 'image').length;
    return `${total} sections · ${headings} headings · ${paragraphs} text blocks · ${images} images`;
  }, [page]);

  const updateSection = (index: number, updater: (section: EditableSection) => EditableSection) => {
    setPage((current) => {
      if (!current) return current;
      const nextSections = [...current.sections];
      nextSections[index] = updater(nextSections[index]);
      return { ...current, sections: nextSections };
    });
  };

  const handleSave = async () => {
    if (!page) return;

    setSaving(true);
    setStatus('idle');
    setError('');
    setInfo('');

    try {
      const res = await fetch(`/api/pages/${encodeURIComponent(page.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceType,
          baseUrl,
          title: page.title,
          sections: page.sections,
        }),
      });

      const data = (await res.json()) as { success?: boolean; error?: string; message?: string; mode?: string };

      if (!res.ok) {
        throw new Error(data?.error || 'Failed to save page');
      }

      setStatus('success');
      if (data?.message) {
        setInfo(data.message);
      }
      setTimeout(() => setStatus('idle'), 3500);
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Failed to save page');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{page?.title || 'Page Editor'}</h1>
            <p className="text-gray-500 text-sm mt-1">
              Source: <span className="font-medium text-gray-700">{sourceType === 'wordpress' ? 'WordPress' : 'Next.js'}</span> · {sectionSummary}
            </p>
            {page?.link ? <p className="text-xs text-gray-400 mt-1">{page.link}</p> : null}
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving || loading || !page}
          className="flex items-center gap-2 px-5 py-2 bg-sky-700 text-white rounded-lg text-sm font-semibold hover:bg-sky-800 transition-colors disabled:opacity-60"
        >
          <Save size={16} />
          {saving ? 'Saving...' : sourceType === 'wordpress' ? 'Publish to WordPress' : 'Publish Content'}
        </button>
      </div>

      {status === 'success' && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-100 rounded-lg text-green-700 text-sm">
          ✓ Changes saved successfully.
        </div>
      )}

      {(status === 'error' || error) && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-lg text-red-700 text-sm">
          <AlertCircle size={16} className="mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {info && (
        <div className="p-3 rounded-lg border border-blue-200 bg-blue-50 text-blue-800 text-sm">
          {info}
        </div>
      )}

      {sourceType === 'nextjs' && (
        <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-sm">
          Next.js source mode publishes edited sections into Marveo managed content immediately. If a publish webhook is configured, deployment is triggered automatically.
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        {loading ? <p className="text-sm text-gray-500">Loading page sections...</p> : null}

        {!loading && page && page.sections.length === 0 ? (
          <p className="text-sm text-gray-500">No editable sections were detected for this page yet.</p>
        ) : null}

        {!loading && page?.sections.map((section, index) => (
          <div key={section.id} className="border border-gray-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-900">{section.label}</p>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 capitalize">{section.kind}</span>
            </div>

            {(section.kind === 'heading' || section.kind === 'paragraph' || section.kind === 'button') && (
              <div className="space-y-2">
                <label className={labelCls}>Text</label>
                <textarea
                  value={section.text}
                  rows={section.kind === 'paragraph' ? 4 : 2}
                  onChange={(event) =>
                    updateSection(index, (current) => ({
                      ...current,
                      text: event.target.value,
                    }))
                  }
                  className="w-full p-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            )}

            {section.kind === 'heading' && (
              <div className="space-y-2">
                <label className={labelCls}>Heading Level</label>
                <select
                  value={section.tag || 'h2'}
                  onChange={(event) =>
                    updateSection(index, (current) => ({
                      ...current,
                      tag: event.target.value,
                    }))
                  }
                  className={inputCls}
                >
                  <option value="h1">H1</option>
                  <option value="h2">H2</option>
                  <option value="h3">H3</option>
                  <option value="h4">H4</option>
                  <option value="h5">H5</option>
                  <option value="h6">H6</option>
                </select>
              </div>
            )}

            {section.kind === 'image' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className={labelCls}>Image URL</label>
                  <input
                    value={section.src || ''}
                    onChange={(event) =>
                      updateSection(index, (current) => ({
                        ...current,
                        src: event.target.value,
                      }))
                    }
                    className={inputCls}
                    placeholder="https://..."
                  />
                </div>
                <div className="space-y-2">
                  <label className={labelCls}>Alt Text</label>
                  <input
                    value={section.alt || section.text || ''}
                    onChange={(event) =>
                      updateSection(index, (current) => ({
                        ...current,
                        alt: event.target.value,
                        text: event.target.value,
                      }))
                    }
                    className={inputCls}
                    placeholder="Describe the image"
                  />
                </div>
              </div>
            )}

            {section.kind === 'button' && (
              <div className="space-y-2">
                <label className={labelCls}>Link URL</label>
                <input
                  value={section.href || ''}
                  onChange={(event) =>
                    updateSection(index, (current) => ({
                      ...current,
                      href: event.target.value,
                    }))
                  }
                  className={inputCls}
                  placeholder="https://..."
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
