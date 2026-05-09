"use client";

export const dynamic = 'force-dynamic';

import { Edit2, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';

interface RuntimePage {
  id: string;
  originId?: number;
  title: string;
  slug: string;
  type: string;
  status: string;
  sourceType: 'wordpress' | 'nextjs';
  url: string;
}

const FALLBACK_PAGES: RuntimePage[] = [
  { id: '1', originId: 1, title: 'Home', slug: 'home', type: 'home', status: 'publish', sourceType: 'wordpress', url: '' },
  { id: '2', originId: 2, title: 'About Us', slug: 'about', type: 'about', status: 'publish', sourceType: 'wordpress', url: '' },
  { id: '3', originId: 3, title: 'Contact', slug: 'contact', type: 'contact', status: 'publish', sourceType: 'wordpress', url: '' },
];

export default function PagesPage() {
  const [pages, setPages] = useState<RuntimePage[]>(FALLBACK_PAGES);
  const [sourceType, setSourceType] = useState<'wordpress' | 'nextjs'>('wordpress');
  const [baseUrl, setBaseUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<string | null>(null);

  const loadPages = useCallback(async (forceSync = false) => {
    if (!baseUrl.trim()) {
      setError('Set a source URL before syncing pages.');
      setLoading(false);
      setSyncing(false);
      return;
    }

    try {
      if (forceSync) {
        setSyncing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      const method = forceSync ? 'POST' : 'GET';
      const query = new URLSearchParams({ sourceType, baseUrl: baseUrl.trim() });
      const res = await fetch(`/api/pages?${query.toString()}`, {
        method,
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });

      const payload = (await res.json()) as {
        pages?: RuntimePage[];
        syncedAt?: string;
        error?: string;
        sourceType?: string;
        baseUrl?: string;
      };

      if (!res.ok) {
        throw new Error(payload?.error || 'Failed to sync pages');
      }

      const remotePages = Array.isArray(payload.pages) ? payload.pages : [];
      if (remotePages.length > 0) {
        setPages(remotePages);
      }

      setLastSynced(payload.syncedAt ?? new Date().toISOString());
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sync pages';
      setError(message);
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, [baseUrl, sourceType]);

  const syncedLabel = useMemo(() => {
    if (!lastSynced) return 'Not synced yet';
    const date = new Date(lastSynced);
    return Number.isNaN(date.getTime()) ? 'Synced just now' : `Last synced ${date.toLocaleString()}`;
  }, [lastSynced]);

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pages</h1>
          <p className="text-gray-500 text-sm mt-1">Discover live pages, break them into editable sections, and update content without touching code.</p>
          <p className="text-xs text-gray-400 mt-1">{syncedLabel}</p>
        </div>
        <div className="flex flex-col md:flex-row gap-2 md:items-center">
          <select
            value={sourceType}
            onChange={(event) => setSourceType(event.target.value === 'nextjs' ? 'nextjs' : 'wordpress')}
            className="h-10 px-3 rounded-lg border border-gray-200 text-sm"
          >
            <option value="wordpress">WordPress source</option>
            <option value="nextjs">Next.js source</option>
          </select>

          <input
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
            placeholder={sourceType === 'wordpress' ? 'https://site.com/wp-json' : 'https://site.com'}
            className="h-10 w-72 px-3 rounded-lg border border-gray-200 text-sm"
          />

          <button
            onClick={() => loadPages(true)}
            disabled={syncing}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-sky-700 text-white rounded-lg text-sm font-semibold hover:bg-sky-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} /> {syncing ? 'Syncing...' : 'Sync Pages'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700"><strong>Sync failed:</strong> {error}</p>
        </div>
      )}

      {loading && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-700">Loading pages from {sourceType === 'wordpress' ? 'WordPress' : 'Next.js'}...</p>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Page Title</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Type</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Slug</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {pages.map((page) => (
              <tr key={page.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm font-medium text-gray-900">{page.title}</td>
                <td className="px-6 py-4 text-sm text-gray-500 capitalize">{page.type}</td>
                <td className="px-6 py-4 text-sm text-gray-500">/{page.slug}</td>
                <td className="px-6 py-4 text-sm text-gray-500 capitalize">{page.status}</td>
                <td className="px-6 py-4 text-right">
                  <Link href={`/dashboard/pages/${page.id}?sourceType=${encodeURIComponent(sourceType)}&baseUrl=${encodeURIComponent(baseUrl)}&slug=${encodeURIComponent(page.slug)}&pageUrl=${encodeURIComponent(page.url || '')}`}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-sky-100 text-sky-700 rounded-lg text-xs font-medium hover:bg-sky-200 transition-colors">
                    <Edit2 size={14} /> Edit
                  </Link>
                </td>
              </tr>
            ))}
            {!loading && pages.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-sm text-center text-gray-500">No pages were returned from WordPress.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <p className="text-sm text-amber-800">
          <strong>Note:</strong> First choose the source platform, then sync. WordPress pages can be written back directly from Marveo. Next.js pages are discovered dynamically and edited as managed content blocks.
        </p>
      </div>
    </div>
  );
}
