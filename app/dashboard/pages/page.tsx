export const dynamic = 'force-dynamic';

import { Edit2, RefreshCw, Plus } from 'lucide-react';
import Link from 'next/link';

// Mock pages from WordPress - in production, fetch from /api/pages
const PAGES = [
  { id: 1, title: 'Home', slug: 'home', type: 'home' },
  { id: 2, title: 'About Us', slug: 'about', type: 'about' },
  { id: 3, title: 'Contact', slug: 'contact', type: 'contact' },
  { id: 4, title: 'Services', slug: 'services', type: 'services' },
  { id: 5, title: 'Blog', slug: 'blog', type: 'blog' },
  { id: 6, title: 'Shop', slug: 'shop', type: 'shop' },
];

export default function PagesPage() {
  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pages</h1>
          <p className="text-gray-500 text-sm mt-1">Manage page-level content including hero slides, forms, and SEO for each page.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-sky-700 text-white rounded-lg text-sm font-semibold hover:bg-sky-800 transition-colors">
          <RefreshCw size={16} /> Synch Pages
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Page Title</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Type</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Slug</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {PAGES.map((page) => (
              <tr key={page.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm font-medium text-gray-900">{page.title}</td>
                <td className="px-6 py-4 text-sm text-gray-500 capitalize">{page.type}</td>
                <td className="px-6 py-4 text-sm text-gray-500">/{page.slug}</td>
                <td className="px-6 py-4 text-right">
                  <Link href={`/dashboard/pages/${page.id}`}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-sky-100 text-sky-700 rounded-lg text-xs font-medium hover:bg-sky-200 transition-colors">
                    <Edit2 size={14} /> Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <p className="text-sm text-amber-800">
          <strong>Note:</strong> Use the "Synch Pages" button to fetch the latest pages and content from your WordPress site.
        </p>
      </div>
    </div>
  );
}
