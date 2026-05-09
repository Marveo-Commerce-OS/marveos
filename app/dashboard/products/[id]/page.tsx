export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import EditProductForm from './EditProductForm';
import { getWooCommerceRestBase } from '@/src/lib/endpoints';

const WC = getWooCommerceRestBase();
const AUTH = `consumer_key=${process.env.WC_CONSUMER_KEY}&consumer_secret=${process.env.WC_CONSUMER_SECRET}`;

async function getProduct(id: string) {
  try {
    if (!WC) return null;
    const res = await fetch(`${WC}/products/${id}?${AUTH}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

async function getCategories() {
  try {
    const res = await fetch(`${WC}/products/categories?per_page=100&${AUTH}`, { cache: 'no-store' });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

interface Props { params: Promise<{ id: string }> }

export default async function EditProductPage({ params }: Props) {
  const { id } = await params;
  const [product, categories] = await Promise.all([getProduct(id), getCategories()]);
  if (!product) notFound();

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/products" className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">
          <ChevronLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900 line-clamp-1">{product.name}</h1>
          <p className="text-gray-400 text-xs mt-0.5">Product #{product.id}</p>
        </div>
      </div>
      <EditProductForm product={product} categories={categories} />
    </div>
  );
}
