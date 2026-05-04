'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save, CheckCircle2, AlertCircle, Plus, Trash2 } from 'lucide-react';
import Image from 'next/image';

const inputCls = 'w-full h-11 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all';
const labelCls = 'text-sm font-semibold text-gray-700';
const TABS = ['General', 'Description', 'Specifications', 'Images'];

interface Attribute { id: number; name: string; options: string[] }
interface ProductImage { id: number; src: string; alt: string }

export default function EditProductForm({ product }: { product: Record<string, any> }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('General');
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  const [name, setName] = useState(product.name ?? '');
  const [regularPrice, setRegularPrice] = useState(product.regular_price ?? '');
  const [salePrice, setSalePrice] = useState(product.sale_price ?? '');
  const [productStatus, setProductStatus] = useState(product.status ?? 'publish');
  const [featured, setFeatured] = useState(product.featured ?? false);
  const [stockStatus, setStockStatus] = useState(product.stock_status ?? 'instock');
  const [shortDescription, setShortDescription] = useState(product.short_description ?? '');
  const [description, setDescription] = useState(product.description ?? '');
  const [weight, setWeight] = useState(product.weight ?? '');
  const [dimensions, setDimensions] = useState<{ length: string; width: string; height: string }>(product.dimensions ?? { length: '', width: '', height: '' });
  const [attributes, setAttributes] = useState<Attribute[]>(product.attributes ?? []);
  const [images, setImages] = useState<ProductImage[]>(product.images ?? []);
  const [newImageUrl, setNewImageUrl] = useState('');

  function addAttribute() {
    setAttributes(prev => [...prev, { id: Date.now(), name: '', options: [''] }]);
  }

  function removeAttribute(i: number) {
    setAttributes(prev => prev.filter((_, idx) => idx !== i));
  }

  function setAttrName(i: number, val: string) {
    setAttributes(prev => prev.map((a, idx) => idx === i ? { ...a, name: val } : a));
  }

  function setAttrOptions(i: number, val: string) {
    setAttributes(prev => prev.map((a, idx) => idx === i ? { ...a, options: val.split(',').map(s => s.trim()) } : a));
  }

  function addImage() {
    if (!newImageUrl.trim()) return;
    setImages(prev => [...prev, { id: Date.now(), src: newImageUrl.trim(), alt: name }]);
    setNewImageUrl('');
  }

  function removeImage(i: number) {
    setImages(prev => prev.filter((_, idx) => idx !== i));
  }

  async function handleSave() {
    setStatus('saving');
    const payload = {
      id: product.id,
      name,
      regular_price: regularPrice,
      sale_price: salePrice,
      status: productStatus,
      featured,
      stock_status: stockStatus,
      short_description: shortDescription,
      description,
      weight,
      dimensions,
      attributes: attributes.map(a => ({ id: a.id, name: a.name, options: a.options, visible: true })),
      images: images.map(img => ({ src: img.src, alt: img.alt })),
    };

    const res = await fetch('/api/products', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    setStatus(res.ok ? 'success' : 'error');
    if (res.ok) setTimeout(() => { setStatus('idle'); router.refresh(); }, 2000);
    else setTimeout(() => setStatus('idle'), 3000);
  }

  return (
    <div className="space-y-6">
      {status === 'success' && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-100 rounded-xl text-green-700 text-sm">
          <CheckCircle2 size={16} /> Product saved successfully!
        </div>
      )}
      {status === 'error' && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">
          <AlertCircle size={16} /> Failed to save. Please try again.
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {TABS.map(tab => (
          <button key={tab} type="button" onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
              activeTab === tab ? 'border-sky-700 text-sky-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {tab}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">

        {/* ── General ── */}
        {activeTab === 'General' && (
          <div className="space-y-5">
            <div className="space-y-1.5">
              <label className={labelCls}>Product Name</label>
              <input value={name} onChange={e => setName(e.target.value)} className={inputCls} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className={labelCls}>Regular Price (₦)</label>
                <input value={regularPrice} onChange={e => setRegularPrice(e.target.value)} className={inputCls} placeholder="0.00" />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>Sale Price (₦) <span className="text-gray-400 font-normal">optional</span></label>
                <input value={salePrice} onChange={e => setSalePrice(e.target.value)} className={inputCls} placeholder="0.00" />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>Status</label>
                <select value={productStatus} onChange={e => setProductStatus(e.target.value)} className={inputCls}>
                  <option value="publish">Published</option>
                  <option value="draft">Draft</option>
                  <option value="pending">Pending Review</option>
                  <option value="private">Private</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>Stock Status</label>
                <select value={stockStatus} onChange={e => setStockStatus(e.target.value)} className={inputCls}>
                  <option value="instock">In Stock</option>
                  <option value="outofstock">Out of Stock</option>
                  <option value="onbackorder">On Backorder</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setFeatured(f => !f)}
                className={`w-10 h-6 rounded-full transition-colors relative ${featured ? 'bg-sky-700' : 'bg-gray-200'}`}>
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${featured ? 'left-5' : 'left-1'}`} />
              </button>
              <label className={labelCls}>Featured Product</label>
            </div>
          </div>
        )}

        {/* ── Description ── */}
        {activeTab === 'Description' && (
          <div className="space-y-5">
            <div className="space-y-1.5">
              <label className={labelCls}>Short Description</label>
              <textarea value={shortDescription} onChange={e => setShortDescription(e.target.value)} rows={4}
                className="w-full p-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all resize-none"
                placeholder="Brief product summary shown on listing pages..." />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Full Description</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={10}
                className="w-full p-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all resize-none font-mono"
                placeholder="Full product description (HTML supported)..." />
              <p className="text-xs text-gray-400">HTML is supported. Use &lt;p&gt;, &lt;ul&gt;, &lt;strong&gt; etc.</p>
            </div>
          </div>
        )}

        {/* ── Specifications ── */}
        {activeTab === 'Specifications' && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className={labelCls}>Weight (kg)</label>
                <input value={weight} onChange={e => setWeight(e.target.value)} className={inputCls} placeholder="0.00" />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>Length (cm)</label>
                <input value={dimensions.length} onChange={e => setDimensions(d => ({ ...d, length: e.target.value }))} className={inputCls} placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>Width (cm)</label>
                <input value={dimensions.width} onChange={e => setDimensions(d => ({ ...d, width: e.target.value }))} className={inputCls} placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>Height (cm)</label>
                <input value={dimensions.height} onChange={e => setDimensions(d => ({ ...d, height: e.target.value }))} className={inputCls} placeholder="0" />
              </div>
            </div>

            <div className="space-y-3 pt-2 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <label className={labelCls}>Custom Attributes</label>
                <button type="button" onClick={addAttribute}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-700 text-white rounded-lg text-xs font-medium hover:bg-sky-800 transition-colors">
                  <Plus size={13} /> Add Attribute
                </button>
              </div>
              {attributes.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-6 border-2 border-dashed border-gray-200 rounded-xl">No attributes yet. Click "Add Attribute".</p>
              )}
              {attributes.map((attr, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-gray-500">Attribute Name</label>
                      <input value={attr.name} onChange={e => setAttrName(i, e.target.value)}
                        className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                        placeholder="e.g. Capacity, Voltage" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-gray-500">Values (comma separated)</label>
                      <input value={attr.options.join(', ')} onChange={e => setAttrOptions(i, e.target.value)}
                        className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                        placeholder="e.g. 5KWH, 24V" />
                    </div>
                  </div>
                  <button type="button" onClick={() => removeAttribute(i)}
                    className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors mt-5">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Images ── */}
        {activeTab === 'Images' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {images.map((img, i) => (
                <div key={i} className="relative group rounded-xl overflow-hidden border border-gray-200 aspect-square bg-gray-50">
                  <Image src={img.src} alt={img.alt || 'Product'} fill className="object-contain p-2" sizes="150px" />
                  {i === 0 && (
                    <span className="absolute top-1 left-1 bg-sky-700 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">Main</span>
                  )}
                  <button type="button" onClick={() => removeImage(i)}
                    className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 size={11} />
                  </button>
                </div>
              ))}
            </div>
            <div className="space-y-1.5 pt-2 border-t border-gray-100">
              <label className={labelCls}>Add Image by URL</label>
              <div className="flex gap-2">
                <input value={newImageUrl} onChange={e => setNewImageUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addImage())}
                  className={`${inputCls} flex-1`} placeholder="https://..." />
                <button type="button" onClick={addImage}
                  className="px-4 h-11 bg-sky-700 text-white rounded-xl text-sm font-medium hover:bg-sky-800 transition-colors whitespace-nowrap">
                  Add
                </button>
              </div>
              <p className="text-xs text-gray-400">First image is used as the main product image.</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <button type="button" onClick={handleSave} disabled={status === 'saving'}
          className="flex items-center gap-2 px-6 py-3 bg-sky-700 text-white rounded-xl text-sm font-semibold hover:bg-sky-800 transition-colors disabled:opacity-60">
          <Save size={16} />
          {status === 'saving' ? 'Saving...' : 'Save Product'}
        </button>
      </div>
    </div>
  );
}
