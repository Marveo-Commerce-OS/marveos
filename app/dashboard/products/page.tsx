export const dynamic = 'force-dynamic';

import { getProducts } from '@/lib/api';
import Image from 'next/image';
import Link from 'next/link';
import ProductActions from './ProductActions';

interface Props { searchParams: Promise<{ page?: string; search?: string; status?: string }> }

const STATUS_BADGE: Record<string, string> = {
  publish: 'bg-green-100 text-green-700',
  draft: 'bg-gray-100 text-gray-600',
  pending: 'bg-yellow-100 text-yellow-700',
  private: 'bg-purple-100 text-purple-700',
};

export default async function ProductsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const page = Number(sp.page ?? 1);
  const { data: products, total } = await getProducts(page, sp.search ?? '', sp.status ?? 'any');
  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Products</h1>
        <p className="text-gray-500 text-sm mt-1">{total} total products in WooCommerce</p>
      </div>

      <form className="flex flex-col md:flex-row gap-3">
        <input name="search" defaultValue={sp.search} placeholder="Search products..."
          className="h-10 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 w-full md:w-64" />
        <select name="status" defaultValue={sp.status ?? 'any'}
          className="h-10 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 w-full md:w-auto">
          <option value="any">All Status</option>
          <option value="publish">Published</option>
          <option value="draft">Draft</option>
          <option value="pending">Pending</option>
        </select>
        <button type="submit" className="h-10 px-5 bg-sky-700 text-white rounded-xl text-sm font-medium hover:bg-sky-800 transition-colors w-full md:w-auto">Filter</button>
      </form>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>{['Product', 'Status', 'Stock', 'Price', 'Featured', 'Actions'].map(h => (
                <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {products.length === 0
                ? <tr><td colSpan={6} className="px-6 py-10 text-center text-gray-400">No products found</td></tr>
                : products.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden shrink-0 relative">
                          {p.images?.[0] && <Image src={p.images[0].src} alt={p.name} fill className="object-contain p-1" sizes="40px" />}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 line-clamp-1 max-w-[200px]">{p.name}</p>
                          <p className="text-xs text-gray-400">#{p.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${STATUS_BADGE[p.status] ?? 'bg-gray-100 text-gray-600'}`}>{p.status}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-medium ${p.stock_status === 'instock' ? 'text-green-600' : 'text-red-500'}`}>
                        {p.stock_status === 'instock' ? 'In Stock' : 'Out of Stock'}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {p.price ? `₦${Number(p.price).toLocaleString('en-NG')}` : '—'}
                    </td>
                    <td className="px-6 py-4">
                      <ProductActions id={p.id} field="featured" value={p.featured} label="Featured" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Link href={`/dashboard/products/${p.id}`}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-sky-50 text-sky-700 hover:bg-sky-100 transition-colors">
                          Edit
                        </Link>
                        <ProductActions
                          id={p.id}
                          field="status"
                          value={p.status}
                          label={p.status === 'publish' ? 'Unpublish' : 'Publish'}
                          toggleValue={p.status === 'publish' ? 'draft' : 'publish'}
                          variant="status"
                        />
                      </div>
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
              {page > 1 && <Link href={`?page=${page - 1}&search=${sp.search ?? ''}&status=${sp.status ?? ''}`} className="px-4 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-50">← Prev</Link>}
              {page < totalPages && <Link href={`?page=${page + 1}&search=${sp.search ?? ''}&status=${sp.status ?? ''}`} className="px-4 py-2 text-sm bg-sky-700 text-white rounded-xl hover:bg-sky-800">Next →</Link>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
