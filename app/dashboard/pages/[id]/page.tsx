'use client';

export const dynamic = 'force-dynamic';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Save, ArrowLeft, Plus, Trash2, AlertCircle } from 'lucide-react';
import type { SlideItem } from '@/lib/types';

const inputCls = 'w-full h-11 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all';
const labelCls = 'text-sm font-semibold text-gray-700';
const sectionCls = 'space-y-4 pt-4 border-t border-gray-100 first:border-0 first:pt-0';

const PAGES = {
  1: { title: 'Home', slug: 'home', type: 'home' },
  2: { title: 'About Us', slug: 'about', type: 'about' },
  3: { title: 'Contact', slug: 'contact', type: 'contact' },
  4: { title: 'Services', slug: 'services', type: 'services' },
  5: { title: 'Blog', slug: 'blog', type: 'blog' },
  6: { title: 'Shop', slug: 'shop', type: 'shop' },
};

const DEFAULT_SLIDE: SlideItem = { title: '', description: '', cta: '', link: '/products', productImage: '', productAlt: '' };

export default function PageEditorPage() {
  const params = useParams();
  const router = useRouter();
  const pageId = params?.id as string;
  const maybePage = PAGES[Number(pageId) as keyof typeof PAGES];
  const page = maybePage ?? {
    title: `Page ${pageId}`,
    slug: `page-${pageId}`,
    type: 'custom',
  };

  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [activeTab, setActiveTab] = useState<'hero' | 'contact' | 'footer' | 'seo'>('hero');

  const [heroSlides, setHeroSlides] = useState<SlideItem[]>([]);
  const [contactForm, setContactForm] = useState({ email: '', phone: '', address: '' });
  const [footerContent, setFooterContent] = useState('');
  const [seoData, setSeoData] = useState({ title: '', description: '', keywords: '' });

  const addSlide = () => {
    setHeroSlides([...heroSlides, { ...DEFAULT_SLIDE }]);
  };

  const removeSlide = (index: number) => {
    setHeroSlides(heroSlides.filter((_, i) => i !== index));
  };

  const updateSlide = (index: number, key: keyof SlideItem, value: string) => {
    const updated = [...heroSlides];
    updated[index] = { ...updated[index], [key]: value };
    setHeroSlides(updated);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // In production, this would save to an API endpoint
      setStatus('success');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (error) {
      setStatus('error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{page.title}</h1>
            <p className="text-gray-500 text-sm">Edit page-level content and settings</p>
          </div>
        </div>
      </div>

      {status === 'success' && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-100 rounded-lg text-green-700 text-sm">
          ✓ Page saved successfully!
        </div>
      )}
      {status === 'error' && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-sm">
          <AlertCircle size={16} /> Failed to save page.
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        {/* Tabs */}
        <div className="flex gap-4 border-b border-gray-200 mb-6">
          {(['hero', 'contact', 'footer', 'seo'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-6 ${
                activeTab === tab ? 'border-sky-700 text-sky-700' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {tab === 'hero' && 'Hero Slides'}
              {tab === 'contact' && 'Contact Info'}
              {tab === 'footer' && 'Footer'}
              {tab === 'seo' && 'SEO'}
            </button>
          ))}
        </div>

        {/* Hero Slides Tab */}
        {activeTab === 'hero' && (
          <div className="space-y-6 pt-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">Hero Slides for {page.title}</h2>
              <button onClick={addSlide} className="flex items-center gap-2 px-3 py-1.5 bg-sky-700 text-white rounded-lg text-xs font-medium hover:bg-sky-800">
                <Plus size={14} /> Add Slide
              </button>
            </div>

            {heroSlides.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">No slides yet.</p>
            )}

            {heroSlides.map((slide, i) => (
              <div key={i} className="border border-gray-200 rounded-lg p-4 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-gray-700">Slide {i + 1}</span>
                  <button onClick={() => removeSlide(i)} className="p-1 text-red-500 hover:bg-red-50 rounded">
                    <Trash2 size={16} />
                  </button>
                </div>
                <input placeholder="Title" value={slide.title} onChange={(e) => updateSlide(i, 'title', e.target.value)} className={inputCls} />
                <input placeholder="Description" value={slide.description} onChange={(e) => updateSlide(i, 'description', e.target.value)} className={inputCls} />
                <div className="grid grid-cols-2 gap-3">
                  <input placeholder="CTA Text" value={slide.cta} onChange={(e) => updateSlide(i, 'cta', e.target.value)} className={inputCls} />
                  <input placeholder="CTA Link" value={slide.link} onChange={(e) => updateSlide(i, 'link', e.target.value)} className={inputCls} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Contact Info Tab */}
        {activeTab === 'contact' && (
          <div className="space-y-6 pt-4">
            <h2 className="text-base font-semibold text-gray-900">Contact Information</h2>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Email</label>
                <input value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} className={inputCls} placeholder="contact@example.com" />
              </div>
              <div>
                <label className={labelCls}>Phone</label>
                <input value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} className={inputCls} placeholder="+1234567890" />
              </div>
              <div>
                <label className={labelCls}>Address</label>
                <input value={contactForm.address} onChange={(e) => setContactForm({ ...contactForm, address: e.target.value })} className={inputCls} placeholder="123 Main St" />
              </div>
            </div>
          </div>
        )}

        {/* Footer Tab */}
        {activeTab === 'footer' && (
          <div className="space-y-6 pt-4">
            <h2 className="text-base font-semibold text-gray-900">Footer Content</h2>
            <div>
              <label className={labelCls}>Footer Description</label>
              <textarea value={footerContent} onChange={(e) => setFooterContent(e.target.value)} rows={5}
                className="w-full p-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
                placeholder="Add footer content here..." />
            </div>
          </div>
        )}

        {/* SEO Tab */}
        {activeTab === 'seo' && (
          <div className="space-y-6 pt-4">
            <h2 className="text-base font-semibold text-gray-900">SEO Settings</h2>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Page Title</label>
                <input value={seoData.title} onChange={(e) => setSeoData({ ...seoData, title: e.target.value })} className={inputCls} placeholder="Page title for search engines" />
              </div>
              <div>
                <label className={labelCls}>Meta Description</label>
                <textarea value={seoData.description} onChange={(e) => setSeoData({ ...seoData, description: e.target.value })} rows={3}
                  className="w-full p-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
                  placeholder="Meta description for search engines" />
              </div>
              <div>
                <label className={labelCls}>Keywords</label>
                <input value={seoData.keywords} onChange={(e) => setSeoData({ ...seoData, keywords: e.target.value })} className={inputCls} placeholder="keyword1, keyword2, keyword3" />
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-6 border-t border-gray-200 mt-6">
          <button onClick={() => router.back()} className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg text-sm font-semibold hover:bg-gray-200 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-6 py-2 bg-sky-700 text-white rounded-lg text-sm font-semibold hover:bg-sky-800 transition-colors disabled:opacity-60">
            <Save size={16} />
            {saving ? 'Saving...' : 'Save Page'}
          </button>
        </div>
      </div>
    </div>
  );
}
