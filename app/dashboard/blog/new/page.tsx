export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import BlogEditor from '../BlogEditor';

export default function NewBlogPage() {
  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/blog" className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">
          <ChevronLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Create Blog Post</h1>
          <p className="text-xs text-gray-500 mt-0.5">blog content</p>
        </div>
      </div>
      <BlogEditor mode="create" />
    </div>
  );
}
