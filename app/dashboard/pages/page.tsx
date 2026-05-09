"use client";

export const dynamic = 'force-dynamic';

import { Edit2, RefreshCw, Plus } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface RuntimePage {
  id: number;
  title: string;
  slug: string;
  type: string;
  status: string;
}

const FALLBACK_PAGES: RuntimePage[] = [
  { id: 1, title: 'Home', slug: 'home', type: 'home', status: 'publish' },
  { id: 2, title: 'About Us', slug: 'about', type: 'about', status: 'publish' },
  { id: 3, title: 'Contact', slug: 'contact', type: 'contact', status: 'publish' },
  { id: 4, title: 'Services', slug: 'services', type: 'services', status: 'publish' },
  { id: 5, title: 'Blog', slug: 'blog', type: 'blog', status: 'publish' },
  { id: 6, title: 'Shop', slug: 'shop', type: 'shop', status: 'publish' },
];

export default function PagesPage() {
  const [pages, setPages] = useState<RuntimePage[]>(FALLBACK_PAGES);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<string | null>(null);

  const loadPages = useCallback(async (forceSync = false) => {
    try {
      if (forceSync) {
        setSyncing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      const method = forceSync ? 'POST' : 'GET';
      const res = await fetch('/api/pages', {
        method,
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });

      const payload = (await res.json()) as {
        pages?: RuntimePage[];
        syncedAt?: string;
        error?: string;
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
  }, []);

  useEffect(() => {
    loadPages(false);
  }, [loadPages]);

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
          <p className="text-gray-500 text-sm mt-1">Manage page-level content including hero slides, forms, and SEO for each page.</p>
          <p className="text-xs text-gray-400 mt-1">{syncedLabel}</p>
        </div>
        <button
          onClick={() => loadPages(true)}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 bg-sky-700 text-white rounded-lg text-sm font-semibold hover:bg-sky-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} /> {syncing ? 'Syncing...' : 'Sync Pages'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700"><strong>Sync failed:</strong> {error}</p>
        </div>
      )}

      {loading && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-700">Loading pages from WordPress...</p>
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
                  <Link href={`/dashboard/pages/${page.id}`}
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
          <strong>Note:</strong> Use the "Sync Pages" button to fetch the latest pages and content from your WordPress site.
        </p>
      </div>
    </div>
  );
}
