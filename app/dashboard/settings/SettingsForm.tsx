'use client';

import Image from 'next/image';
import { useState } from 'react';
import type { SiteSettings, SlideItem, CategoryItem } from '@/lib/types';
import { Save, CheckCircle2, AlertCircle, Plus, Trash2, GripVertical } from 'lucide-react';

const inputCls = 'w-full h-11 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all';
const labelCls = 'text-sm font-semibold text-gray-700';
const sectionCls = 'space-y-4 pt-4 border-t border-gray-100 first:border-0 first:pt-0';

const TABS = ['Contact', 'Socials', 'Hero Slides', 'Brand Banner', 'Categories', 'Footer', 'Payments'];

const DEFAULT_SLIDE: SlideItem = { title: '', description: '', cta: '', link: '/products', productImage: '', productAlt: '' };
const DEFAULT_CATEGORY: CategoryItem = { name: '', slug: '', image: '' };

const HARDCODED_DEFAULTS: SiteSettings = {
  contact_phone: '+2348032170129',
  contact_email: 'sales@prag.global',
  whatsapp: '+2348032170129',
  address: '14 Industrial Layout, Victoria Island, Lagos, Nigeria',
  business_hours_weekday: 'Mon–Fri: 8:00 AM – 6:00 PM',
  business_hours_saturday: 'Sat: 9:00 AM – 2:00 PM',
  announcement_bar: '',
  site_under_construction: false,
  under_construction_title: 'We are coming back soon',
  under_construction_message: 'We are currently making improvements to serve you better. Please check back shortly.',
  footer_description: "Nigeria's leading power engineering company. We design, supply and install power solutions for homes, businesses and industrial facilities across the country.",
  brand_banner_title: 'No Hype. Just Inverters That Deliver.',
  brand_banner_description: 'Explore stabilizers, inverters, batteries, and complete power solutions designed to keep your home or business running without interruption.',
  brand_banner_cta: 'Buy Inverters Built to Last',
  brand_banner_link: '/products/inverters',
  brand_banner_image: 'https://central.prag.global/wp-content/uploads/2026/04/f80b14a4d9e3fc153ae2e60c3d8d11a58ebe33fe.png',
  hero_background: 'https://central.prag.global/wp-content/uploads/2026/04/421db5e8efbc14b105a33a6db7182652503c3fdd.png',
  socials: {
    facebook: 'https://www.facebook.com/pragpowersolutions',
    instagram: 'https://www.instagram.com/prag_ng/',
    linkedin: 'https://www.linkedin.com/company/prag/',
    twitter: '',
    whatsapp: 'https://wa.me/2348032170129',
  },
  slides: [
    { title: 'No Hype. Just Inverters That Deliver.', description: 'Choose inverters engineered for real-world loads. Shop reliable power systems today.', cta: 'Buy Inverters Built to Last', link: '/products', productImage: 'https://central.prag.global/wp-content/uploads/2026/04/eebd514c0d3e75e4f32cb8fd691c7b3613fd99d5.png', productAlt: 'Heavy Duty Inverter' },
    { title: 'Power Your Home. Power Your Business.', description: 'From residential to industrial applications. Trusted inverters for every power need.', cta: 'Explore Our Range', link: '/products', productImage: 'https://central.prag.global/wp-content/uploads/2026/04/7ee70985fdddba92a39a6e67f80ec4773cbf34fd.png', productAlt: 'Residential Inverter' },
    { title: 'Built Tough. Tested Tougher.', description: 'Heavy-duty inverters designed to handle the toughest loads without compromise.', cta: 'Shop Heavy Duty Inverters', link: '/inverter', productImage: 'https://central.prag.global/wp-content/uploads/2026/04/b5564cf299de3eea9dbe804a547cf74e99bc41a7.png', productAlt: 'Industrial Inverter' },
    { title: 'Reliable Power. Unbeatable Performance.', description: 'Experience consistent power delivery with inverters engineered for excellence.', cta: 'Get Started Today', link: '/products', productImage: 'https://central.prag.global/wp-content/uploads/2026/04/dd4b835690b546ee636b7659added08cd02d9891.png', productAlt: 'Premium Inverter' },
  ],
  categories: [
    { name: 'Voltage Stabilizers', slug: 'voltage-stabilizers', image: 'https://central.prag.global/wp-content/uploads/2026/04/7ee70985fdddba92a39a6e67f80ec4773cbf34fd.png' },
    { name: 'Inverters',           slug: 'inverters',            image: 'https://central.prag.global/wp-content/uploads/2026/04/eebd514c0d3e75e4f32cb8fd691c7b3613fd99d5-1.png' },
    { name: 'Solar Panels',        slug: 'solar',                image: 'https://central.prag.global/wp-content/uploads/2026/04/b5564cf299de3eea9dbe804a547cf74e99bc41a7.png' },
    { name: 'Batteries',           slug: 'batteries',            image: 'https://central.prag.global/wp-content/uploads/2026/04/dd4b835690b546ee636b7659added08cd02d9891.png' },
  ],
  paystack_public_key: '',
};

function mergeWithDefaults(saved: SiteSettings | null): SiteSettings {
  if (!saved) return HARDCODED_DEFAULTS;
  return {
    ...HARDCODED_DEFAULTS,
    ...saved,
    socials: { ...HARDCODED_DEFAULTS.socials, ...(saved.socials ?? {}) },
    slides: Array.isArray(saved.slides) && saved.slides.length > 0 ? saved.slides : HARDCODED_DEFAULTS.slides,
    categories: Array.isArray(saved.categories) && saved.categories.length > 0 ? saved.categories : HARDCODED_DEFAULTS.categories,
    paystack_public_key: saved.paystack_public_key ?? '',
  };
}

export default function SettingsForm({ initialSettings }: { initialSettings: SiteSettings | null }) {
  const [form, setForm] = useState<SiteSettings>(() => mergeWithDefaults(initialSettings));
  const [activeTab, setActiveTab] = useState('Contact');
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  function setField(field: keyof SiteSettings, value: unknown) {
    setForm(p => ({ ...p, [field]: value }));
  }

  function setSocial(key: keyof SiteSettings['socials'], value: string) {
    setForm(p => ({ ...p, socials: { ...p.socials, [key]: value } }));
  }

  function setSlide(index: number, key: keyof SlideItem, value: string) {
    const slides = [...form.slides];
    slides[index] = { ...slides[index], [key]: value };
    setField('slides', slides);
  }

  function addSlide() { setField('slides', [...form.slides, { ...DEFAULT_SLIDE }]); }
  function removeSlide(i: number) { setField('slides', form.slides.filter((_, idx) => idx !== i)); }

  function setCategory(index: number, key: keyof CategoryItem, value: string) {
    const cats = [...form.categories];
    cats[index] = { ...cats[index], [key]: value };
    setField('categories', cats);
  }

  function addCategory() { setField('categories', [...form.categories, { ...DEFAULT_CATEGORY }]); }
  function removeCategory(i: number) { setField('categories', form.categories.filter((_, idx) => idx !== i)); }

  async function uploadMedia(file: File, fieldKey: string) {
    setUploadingField(fieldKey);
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/media/upload', {
      method: 'POST',
      body: formData,
    });

    setUploadingField(null);
    if (!res.ok) {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
      return null;
    }

    const media = await res.json() as { source_url?: string };
    return media.source_url ?? null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('saving');
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setStatus(res.ok ? 'success' : 'error');
    setTimeout(() => setStatus('idle'), 3000);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {status === 'success' && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-100 rounded-xl text-green-700 text-sm">
          <CheckCircle2 size={16} /> Settings saved successfully!
        </div>
      )}
      {status === 'error' && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">
          <AlertCircle size={16} /> Failed to save. Check your connection.
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

      {/* ── Contact ── */}
      {activeTab === 'Contact' && (
        <div className="space-y-5">
          <div className={sectionCls}>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Contact Info</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className={labelCls}>Phone Number</label>
                <input value={form.contact_phone} onChange={e => setField('contact_phone', e.target.value)} className={inputCls} placeholder="+2348032170129" />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>Email Address</label>
                <input type="email" value={form.contact_email} onChange={e => setField('contact_email', e.target.value)} className={inputCls} placeholder="sales@prag.global" />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>WhatsApp Number</label>
                <input value={form.whatsapp} onChange={e => setField('whatsapp', e.target.value)} className={inputCls} placeholder="+2348032170129" />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>Business Address</label>
                <input value={form.address} onChange={e => setField('address', e.target.value)} className={inputCls} placeholder="14 Industrial Layout, VI, Lagos" />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>Weekday Hours</label>
                <input value={form.business_hours_weekday} onChange={e => setField('business_hours_weekday', e.target.value)} className={inputCls} placeholder="Mon–Fri: 8:00 AM – 6:00 PM" />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>Saturday Hours</label>
                <input value={form.business_hours_saturday} onChange={e => setField('business_hours_saturday', e.target.value)} className={inputCls} placeholder="Sat: 9:00 AM – 2:00 PM" />
              </div>
            </div>
          </div>
          <div className={sectionCls}>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Announcement Bar</p>
            <div className="space-y-1.5">
              <label className={labelCls}>Announcement Text</label>
              <input value={form.announcement_bar} onChange={e => setField('announcement_bar', e.target.value)} className={inputCls} placeholder="Free shipping on orders over ₦500,000!" />
              <p className="text-xs text-gray-400">Leave empty to hide the announcement bar.</p>
            </div>
          </div>
        </div>
      )}


      {/* ── Socials ── */}
      {activeTab === 'Socials' && (
        <div className="space-y-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Social Media Links</p>
          {(['facebook', 'instagram', 'linkedin', 'twitter', 'whatsapp'] as const).map(key => (
            <div key={key} className="space-y-1.5">
              <label className={labelCls}>{key.charAt(0).toUpperCase() + key.slice(1)} URL</label>
              <input value={form.socials?.[key] ?? ''} onChange={e => setSocial(key, e.target.value)} className={inputCls} placeholder={`https://${key}.com/...`} />
            </div>
          ))}
        </div>
      )}

      {/* ── Hero Slides ── */}
      {activeTab === 'Hero Slides' && (
        <div className="space-y-6">
          {/* Background Image */}
          <div className="border border-gray-200 rounded-xl p-4 space-y-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Hero Background Image</p>
            <div className="space-y-2">
              <label className={labelCls}>Image URL</label>
              <div className="flex gap-2 items-start">
                <input
                  value={form.hero_background}
                  onChange={e => setField('hero_background', e.target.value)}
                  className={inputCls}
                  placeholder="https://... or /images/hero-bg.jpg"
                />
                <label className="shrink-0 inline-flex items-center justify-center px-4 h-11 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors whitespace-nowrap">
                  {uploadingField === 'hero-bg' ? 'Uploading...' : 'Upload Image'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      const url = await uploadMedia(file, 'hero-bg');
                      if (url) setField('hero_background', url);
                      event.target.value = '';
                    }}
                  />
                </label>
              </div>
              {form.hero_background && (
                <Image src={form.hero_background} alt="Hero background preview" width={400} height={120} unoptimized
                  className="w-full h-28 object-cover rounded-xl border border-gray-100 mt-1" />
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Slides ({form.slides.length})</p>
            <button type="button" onClick={addSlide}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-700 text-white rounded-lg text-xs font-medium hover:bg-sky-800 transition-colors">
              <Plus size={14} /> Add Slide
            </button>
          </div>

          {form.slides.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8 border-2 border-dashed border-gray-200 rounded-xl">No slides yet. Click &quot;Add Slide&quot; to create one.</p>
          )}

          {form.slides.map((slide, i) => (
            <div key={i} className="border border-gray-200 rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GripVertical size={16} className="text-gray-300" />
                  <span className="text-sm font-semibold text-gray-700">Slide {i + 1}</span>
                </div>
                <button type="button" onClick={() => removeSlide(i)}
                  className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5 md:col-span-2">
                  <label className={labelCls}>Title</label>
                  <input value={slide.title} onChange={e => setSlide(i, 'title', e.target.value)} className={inputCls} placeholder="No Hype. Just Inverters That Deliver." />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <label className={labelCls}>Description</label>
                  <input value={slide.description} onChange={e => setSlide(i, 'description', e.target.value)} className={inputCls} placeholder="Short description..." />
                </div>
                <div className="space-y-1.5">
                  <label className={labelCls}>CTA Button Text</label>
                  <input value={slide.cta} onChange={e => setSlide(i, 'cta', e.target.value)} className={inputCls} placeholder="Buy Inverters Built to Last" />
                </div>
                <div className="space-y-1.5">
                  <label className={labelCls}>CTA Link</label>
                  <input value={slide.link} onChange={e => setSlide(i, 'link', e.target.value)} className={inputCls} placeholder="/products" />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <label className={labelCls}>Product Image</label>
                  <label className="inline-flex items-center justify-center px-4 h-11 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors">
                    {uploadingField === `slide-${i}` ? 'Uploading...' : 'Upload Image'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        const url = await uploadMedia(file, `slide-${i}`);
                        if (url) setSlide(i, 'productImage', url);
                        event.target.value = '';
                      }}
                    />
                  </label>
                  {slide.productImage && (
                    <Image src={slide.productImage} alt="preview" width={160} height={80} unoptimized className="h-20 w-auto object-contain rounded-lg border border-gray-100 mt-1" />
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className={labelCls}>Product Image Alt Text</label>
                  <input value={slide.productAlt} onChange={e => setSlide(i, 'productAlt', e.target.value)} className={inputCls} placeholder="Heavy Duty Inverter" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Brand Banner ── */}
      {activeTab === 'Brand Banner' && (
        <div className="space-y-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Mid-page Banner Section</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5 md:col-span-2">
              <label className={labelCls}>Title</label>
              <input value={form.brand_banner_title} onChange={e => setField('brand_banner_title', e.target.value)} className={inputCls} placeholder="No Hype. Just Inverters That Deliver." />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <label className={labelCls}>Description</label>
              <textarea value={form.brand_banner_description} onChange={e => setField('brand_banner_description', e.target.value)} rows={3}
                className="w-full p-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all resize-none"
                placeholder="Explore stabilizers, inverters..." />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>CTA Button Text</label>
              <input value={form.brand_banner_cta} onChange={e => setField('brand_banner_cta', e.target.value)} className={inputCls} placeholder="Buy Inverters Built to Last" />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>CTA Link</label>
              <input value={form.brand_banner_link} onChange={e => setField('brand_banner_link', e.target.value)} className={inputCls} placeholder="/products/inverters" />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <label className={labelCls}>Product Image</label>
              <label className="inline-flex items-center justify-center px-4 h-11 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors">
                {uploadingField === 'brand-banner' ? 'Uploading...' : 'Upload Image'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    const url = await uploadMedia(file, 'brand-banner');
                    if (url) setField('brand_banner_image', url);
                    event.target.value = '';
                  }}
                />
              </label>
              {form.brand_banner_image && (
                <Image src={form.brand_banner_image} alt="preview" width={192} height={96} unoptimized className="h-24 w-auto object-contain rounded-lg border border-gray-100 mt-1" />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Categories ── */}
      {activeTab === 'Categories' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Category Grid ({form.categories.length})</p>
            <button type="button" onClick={addCategory}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-700 text-white rounded-lg text-xs font-medium hover:bg-sky-800 transition-colors">
              <Plus size={14} /> Add Category
            </button>
          </div>

          {form.categories.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8 border-2 border-dashed border-gray-200 rounded-xl">No categories yet.</p>
          )}

          {form.categories.map((cat, i) => (
            <div key={i} className="border border-gray-200 rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">Category {i + 1}</span>
                <button type="button" onClick={() => removeCategory(i)}
                  className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className={labelCls}>Display Name</label>
                  <input value={cat.name} onChange={e => setCategory(i, 'name', e.target.value)} className={inputCls} placeholder="Voltage Stabilizers" />
                </div>
                <div className="space-y-1.5">
                  <label className={labelCls}>URL Slug</label>
                  <input value={cat.slug} onChange={e => setCategory(i, 'slug', e.target.value)} className={inputCls} placeholder="voltage-stabilizers" />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <label className={labelCls}>Image</label>
                  <label className="inline-flex items-center justify-center px-4 h-11 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors">
                    {uploadingField === `category-${i}` ? 'Uploading...' : 'Upload Image'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        const url = await uploadMedia(file, `category-${i}`);
                        if (url) setCategory(i, 'image', url);
                        event.target.value = '';
                      }}
                    />
                  </label>
                  {cat.image && (
                    <Image src={cat.image} alt="preview" width={128} height={64} unoptimized className="h-16 w-auto object-contain rounded-lg border border-gray-100 mt-1" />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Footer ── */}
      {activeTab === 'Footer' && (
        <div className="space-y-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Footer Content</p>
          <div className="space-y-1.5">
            <label className={labelCls}>Company Description</label>
            <textarea value={form.footer_description} onChange={e => setField('footer_description', e.target.value)} rows={4}
              className="w-full p-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all resize-none"
              placeholder="Nigeria's leading power engineering company..." />
          </div>
        </div>
      )}

      {activeTab === 'Payments' && (
        <div className="space-y-5">
          <div className={sectionCls}>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Paystack</p>
            <div className="space-y-1.5">
              <label className={labelCls}>Paystack Public Key</label>
              <input
                value={form.paystack_public_key}
                onChange={e => setField('paystack_public_key', e.target.value)}
                className={inputCls}
                placeholder="pk_live_xxxxxxxxxxxxxxxxxxxxxxxx"
              />
              <p className="text-xs text-gray-400">
                Your Paystack public key — safe to expose on the frontend. Find it in your{' '}
                <a href="https://dashboard.paystack.com/#/settings/developer" target="_blank" rel="noreferrer" className="text-sky-600 underline">
                  Paystack dashboard → Settings → API Keys
                </a>.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end pt-2 border-t border-gray-100">
        <button type="submit" disabled={status === 'saving'}
          className="flex items-center gap-2 px-6 py-3 bg-sky-700 text-white rounded-xl text-sm font-semibold hover:bg-sky-800 transition-colors disabled:opacity-60">
          <Save size={16} />
          {status === 'saving' ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </form>
  );
}
