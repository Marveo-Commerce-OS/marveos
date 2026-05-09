export const dynamic = 'force-dynamic';

import DocsClient from './DocsClient';
import { getWordPressRestBase } from '@/src/lib/endpoints';

const WP = getWordPressRestBase();
const DOC_POST_TYPE = process.env.MARVEO_DOCUMENT_POST_TYPE;

interface RawDoc {
  id: number;
  title?: { rendered?: string };
  meta?: {
    file_url?: string;
    file_type?: string;
    file_size?: string;
    pages?: string;
    product_id?: string | number;
  };
}

async function getDocs() {
  try {
    if (!WP || !DOC_POST_TYPE) return [];
    const res = await fetch(`${WP}/${DOC_POST_TYPE}?per_page=50&_fields=id,title,meta`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = (await res.json()) as RawDoc[];
    return data.map((d) => ({
      id: d.id,
      title: d.title?.rendered ?? '',
      file_url: d.meta?.file_url ?? '',
      file_type: d.meta?.file_type ?? '',
      file_size: d.meta?.file_size ?? '',
      pages: d.meta?.pages ?? '',
      product_id: d.meta?.product_id ?? '',
    }));
  } catch { return []; }
}

export default async function DocsPage() {
  const docs = await getDocs();
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Technical Documents</h1>
        <p className="text-gray-500 text-sm mt-1">Manage downloadable documents linked to products (datasheets, manuals, etc.).</p>
      </div>
      <DocsClient initialDocs={docs} />
    </div>
  );
}
