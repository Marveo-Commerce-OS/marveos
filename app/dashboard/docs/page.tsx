export const dynamic = 'force-dynamic';

import DocsClient from './DocsClient';

const WP = `${process.env.NEXT_PUBLIC_WP_API_URL?.replace('/wp-json', '/wp-json/wp/v2') ?? 'https://central.prag.global/wp-json/wp/v2'}`;

async function getDocs() {
  try {
    const res = await fetch(`${WP}/prag_document?per_page=50&_fields=id,title,meta`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return data.map((d: any) => ({
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
