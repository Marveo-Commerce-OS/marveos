export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import EditProductForm from '../[id]/EditProductForm';
import { getWooCommerceRestBase } from '@/src/lib/endpoints';

const WC = getWooCommerceRestBase();
const AUTH = `consumer_key=${process.env.WC_CONSUMER_KEY}&consumer_secret=${process.env.WC_CONSUMER_SECRET}`;

async function getCategories() {
  try {
    if (!WC) return [];
    const res = await fetch(`${WC}/products/categories?per_page=100&${AUTH}`, { cache: 'no-store' });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

const NEW_PRODUCT = {
  id: 0,
  name: '',
  regular_price: '',
  sale_price: '',
  status: 'draft',
  featured: false,
  stock_status: 'instock',
  short_description: '',
  description: '',
  weight: '',
  dimensions: { length: '', width: '', height: '' },
  attributes: [],
  categories: [],
  images: [],
};

export default async function NewProductPage() {
  const categories = await getCategories();

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/products" className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">
          <ChevronLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Create Product</h1>
          <p className="text-gray-400 text-xs mt-0.5">New WooCommerce product</p>
        </div>
      </div>
      <EditProductForm product={NEW_PRODUCT} categories={categories} isCreateMode />
    </div>
  );
}
