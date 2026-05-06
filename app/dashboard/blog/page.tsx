export const dynamic = 'force-dynamic';

import { getPosts } from '@/lib/api';
import { getSession } from '@/lib/auth';
import Link from 'next/link';
import PostStatusToggle from './PostStatusToggle';

interface Props { searchParams: Promise<{ page?: string; search?: string }> }

function pageHref(page: number, params: { search?: string }) {
  const qs = new URLSearchParams();
  qs.set('page', String(page));
  if (params.search) qs.set('search', params.search);
  return `?${qs.toString()}`;
}

const STATUS_BADGE: Record<string, string> = {
  publish: 'bg-green-100 text-green-700',
  draft: 'bg-gray-100 text-gray-600',
  pending: 'bg-yellow-100 text-yellow-700',
  private: 'bg-purple-100 text-purple-700',
};

export default async function BlogPage({ searchParams }: Props) {
  const sp = await searchParams;
  const session = await getSession();
  const page = Number(sp.page ?? 1);
  const { data: posts, total } = await getPosts(page, sp.search ?? '', session?.token);
  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Blog Posts</h1>
        <p className="text-gray-500 text-sm mt-1">{total} posts in Knowledge Center</p>
        <div className="mt-3">
          <Link href="/dashboard/blog/new" className="px-3 py-1.5 rounded-lg text-xs font-medium bg-sky-700 text-white hover:bg-sky-800 transition-colors">Create Post</Link>
        </div>
      </div>

      <form className="flex flex-col md:flex-row gap-3">
        <input name="search" defaultValue={sp.search} placeholder="Search posts..."
          className="h-10 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 w-full md:w-72" />
        <button type="submit" className="h-10 px-5 bg-sky-700 text-white rounded-xl text-sm font-medium hover:bg-sky-800 transition-colors w-full md:w-auto">Search</button>
      </form>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>{['Title', 'Status', 'Date', 'Action'].map(h => (
                <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {posts.length === 0
                ? <tr><td colSpan={4} className="px-6 py-10 text-center text-gray-400">No posts found</td></tr>
                : posts.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 max-w-sm">
                      <Link href={`/dashboard/blog/${p.id}`} className="font-medium text-sky-700 line-clamp-1 hover:underline" dangerouslySetInnerHTML={{ __html: p.title.rendered }} />
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-1" dangerouslySetInnerHTML={{ __html: p.excerpt.rendered.replace(/<[^>]+>/g, '') }} />
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${STATUS_BADGE[p.status] ?? 'bg-gray-100 text-gray-600'}`}>{p.status}</span>
                    </td>
                    <td className="px-6 py-4 text-gray-500 text-xs">{new Date(p.date).toLocaleDateString('en-GB')}</td>
                    <td className="px-6 py-4">
                      <PostStatusToggle id={p.id} currentStatus={p.status} />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
            <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              {page > 1 && <Link href={pageHref(page - 1, sp)} className="px-4 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-50">← Prev</Link>}
              {page < totalPages && <Link href={pageHref(page + 1, sp)} className="px-4 py-2 text-sm bg-sky-700 text-white rounded-xl hover:bg-sky-800">Next →</Link>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
