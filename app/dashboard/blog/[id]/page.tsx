export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import BlogEditor from '../BlogEditor';
import { getSession } from '@/lib/auth';

import { getConfig } from '@/src/config/client';

const getWpApiUrl = () => {
  const config = getConfig();
  return config.wordpressApiUrl || 'https://localhost/wp-json';
};

interface Props {
  params: Promise<{ id: string }>;
}

async function getPost(id: string, token: string) {
  const WP = `${getWpApiUrl()}/wp/v2`;
  try {
    const res = await fetch(`${WP}/posts/${id}?context=edit`, {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default async function EditBlogPage({ params }: Props) {
  const WP = `${getWpApiUrl()}/wp/v2`;
  const { id } = await params;
  const session = await getSession();
  const post = await getPost(id, session?.token ?? '');

  if (!post) notFound();

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/blog" className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">
          <ChevronLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Edit Blog Post</h1>
          <p className="text-xs text-gray-500 mt-0.5">Post #{post.id}</p>
        </div>
      </div>
      <BlogEditor mode="edit" initialPost={post} />
    </div>
  );
}
