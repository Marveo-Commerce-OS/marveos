'use client';

import Image from 'next/image';
import { useState } from 'react';
import { Plus, Trash2, Save, Pencil, X, CheckCircle2, AlertCircle, Database } from 'lucide-react';

const inputCls = 'w-full h-11 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all';
const labelCls = 'text-sm font-semibold text-gray-700';

type StoreType = 'location' | 'online' | 'chain';

interface Store {
  id?: number;
  name: string;
  city: string;
  address: string;
  phone: string;
  map_url: string;
  store_type: StoreType;
  logo_url: string;
  logo_alt: string;
}

const EMPTY: Store = { name: '', city: '', address: '', phone: '', map_url: '', store_type: 'location', logo_url: '', logo_alt: '' };

const SECTION_ORDER: StoreType[] = ['location', 'online', 'chain'];
const TYPE_LABELS: Record<StoreType, string> = { location: 'Locations', online: 'Online Stores', chain: 'Chain Stores' };
const TYPE_HELP: Record<StoreType, string> = {
  location: 'Physical locations with address, phone, and map directions.',
  online: 'Backend-managed marketplace and partner online store logos.',
  chain: 'Backend-managed chain store logos and contact records.',
};

export default function StoresClient({ initialStores }: { initialStores: Store[] }) {
  const [stores, setStores] = useState<Store[]>(initialStores);
  const [editing, setEditing] = useState<Store | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  function showToast(type: 'success' | 'error', msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  }

  function openNew(storeType: StoreType = 'location') { setEditing({ ...EMPTY, store_type: storeType }); setIsNew(true); }
  function openEdit(s: Store) { setEditing({ ...s }); setIsNew(false); }
  function closeEdit() { setEditing(null); setIsNew(false); }

  function updateEditing<K extends keyof Store>(key: K, value: Store[K]) {
    setEditing((current) => current ? { ...current, [key]: value } : current);
  }

  async function handleLogoUpload(file: File) {
    setUploadingLogo(true);
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/media/upload', {
      method: 'POST',
      body: formData,
    });

    setUploadingLogo(false);

    if (!res.ok) {
      showToast('error', 'Logo upload failed.');
      return;
    }

    const media = await res.json() as { source_url?: string };
    updateEditing('logo_url', media.source_url ?? '');
    if (!editing?.logo_alt) updateEditing('logo_alt', file.name.replace(/\.[^.]+$/, ''));
    showToast('success', 'Logo uploaded.');
  }

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    const res = await fetch('/api/stores', {
      method: isNew ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing),
    });
    setSaving(false);
    if (res.ok) {
      const saved = await res.json();
      if (isNew) setStores(p => [...p, saved]);
      else setStores(p => p.map(s => s.id === saved.id ? saved : s));
      closeEdit();
      showToast('success', isNew ? 'Store created!' : 'Store updated!');
    } else {
      showToast('error', 'Failed to save store.');
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this store?')) return;
    setDeleting(id);
    const res = await fetch(`/api/stores?id=${id}`, { method: 'DELETE' });
    setDeleting(null);
    if (res.ok) {
      setStores(p => p.filter(s => s.id !== id));
      showToast('success', 'Store deleted.');
    } else {
      showToast('error', 'Failed to delete store.');
    }
  }

  async function handleImportExisting() {
    setImporting(true);
    const res = await fetch('/api/stores/seed', { method: 'POST' });
    setImporting(false);

    if (!res.ok) {
      showToast('error', 'Failed to import existing stores.');
      return;
    }

    const payload = await res.json() as { stores?: Store[]; created?: number };
    if (payload.stores) setStores(payload.stores);
    showToast('success', payload.created ? `Imported ${payload.created} existing stores.` : 'Existing stores already synced.');
  }

  const storesByType = SECTION_ORDER.reduce<Record<StoreType, Store[]>>((acc, type) => {
    acc[type] = stores.filter((store) => store.store_type === type);
    return acc;
  }, { location: [], online: [], chain: [] });

  const showLocationFields = editing?.store_type === 'location';

  return (
    <div className="space-y-4">
      {toast && (
        <div className={`flex items-center gap-2 p-3 rounded-xl text-sm border ${toast.type === 'success' ? 'bg-green-50 border-green-100 text-green-700' : 'bg-red-50 border-red-100 text-red-600'}`}>
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      <div className="flex flex-col md:flex-row md:justify-end gap-2">
        <button
          onClick={handleImportExisting}
          disabled={importing}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors disabled:opacity-60"
        >
          <Database size={16} /> {importing ? 'Importing...' : 'Import Existing Data'}
        </button>
        <button onClick={() => openNew('location')}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-sky-700 text-white rounded-xl text-sm font-semibold hover:bg-sky-800 transition-colors">
          <Plus size={16} /> Add Location
        </button>
      </div>

      {/* Edit / Create Form */}
      {editing && (
        <div className="bg-white rounded-2xl border border-sky-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-gray-900">{isNew ? 'New Store' : `Edit: ${editing.name}`}</h2>
            <button onClick={closeEdit} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"><X size={16} /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className={labelCls}>Store Name</label>
              <input value={editing.name} onChange={e => updateEditing('name', e.target.value)} className={inputCls} placeholder="Example Store Lagos" />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Store Type</label>
              <select value={editing.store_type} onChange={e => updateEditing('store_type', e.target.value as StoreType)} className={inputCls}>
                <option value="location">Location</option>
                <option value="online">Online Store</option>
                <option value="chain">Chain Store</option>
              </select>
            </div>
            {showLocationFields && (
              <>
                <div className="space-y-1.5">
                  <label className={labelCls}>City</label>
                  <input value={editing.city} onChange={e => updateEditing('city', e.target.value)} className={inputCls} placeholder="Lagos" />
                </div>
                <div className="space-y-1.5">
                  <label className={labelCls}>Phone</label>
                  <input value={editing.phone} onChange={e => updateEditing('phone', e.target.value)} className={inputCls} placeholder="+234..." />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <label className={labelCls}>Address</label>
                  <input value={editing.address} onChange={e => updateEditing('address', e.target.value)} className={inputCls} placeholder="14 Industrial Layout, VI, Lagos" />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <label className={labelCls}>Google Maps URL</label>
                  <input value={editing.map_url} onChange={e => updateEditing('map_url', e.target.value)} className={inputCls} placeholder="https://maps.google.com/..." />
                </div>
              </>
            )}
            {!showLocationFields && (
              <div className="space-y-1.5 md:col-span-2">
                <label className={labelCls}>Store Link URL</label>
                <input value={editing.map_url} onChange={e => updateEditing('map_url', e.target.value)} className={inputCls} placeholder="https://store.example.com" />
              </div>
            )}
            <div className="space-y-1.5 md:col-span-2">
              <label className={labelCls}>Logo</label>
              <div className="flex flex-col gap-3 md:items-start">
                <label className="inline-flex items-center justify-center px-4 h-11 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors">
                  {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      await handleLogoUpload(file);
                      event.target.value = '';
                    }}
                  />
                </label>
              </div>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <label className={labelCls}>Logo Alt Text</label>
              <input value={editing.logo_alt} onChange={e => updateEditing('logo_alt', e.target.value)} className={inputCls} placeholder="Store logo alt text" />
            </div>
            {editing.logo_url && (
              <div className="md:col-span-2 rounded-2xl border border-gray-100 p-4 bg-gray-50">
                <Image src={editing.logo_url} alt={editing.logo_alt || editing.name || 'Store logo preview'} width={128} height={64} unoptimized className="h-16 w-auto object-contain" />
              </div>
            )}
            {!showLocationFields && (
              <div className="md:col-span-2 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Online and chain entries drive storefront logo sections. Add logo, name, and Store Link URL for clickable logos.
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={closeEdit} className="px-4 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-sky-700 text-white rounded-xl text-sm font-semibold hover:bg-sky-800 transition-colors disabled:opacity-60">
              <Save size={15} /> {saving ? 'Saving...' : 'Save Store'}
            </button>
          </div>
        </div>
      )}

      {/* Stores List */}
      <div className="grid grid-cols-1 gap-5">
        {SECTION_ORDER.map((type) => (
          <div key={type} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{TYPE_LABELS[type]}</h3>
                <p className="text-sm text-gray-500">{TYPE_HELP[type]}</p>
              </div>
              <button
                onClick={() => openNew(type)}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-sky-50 text-sky-700 rounded-xl text-sm font-semibold hover:bg-sky-100 transition-colors"
              >
                <Plus size={16} /> Add {TYPE_LABELS[type].slice(0, -1)}
              </button>
            </div>

            {storesByType[type].length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-400 text-sm">No {TYPE_LABELS[type].toLowerCase()} yet.</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {storesByType[type].map((store) => (
                  <div key={store.id} className="px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-14 h-14 rounded-xl border border-gray-100 bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
                        {store.logo_url ? (
                            <Image src={store.logo_url} alt={store.logo_alt || store.name} width={96} height={40} unoptimized className="max-h-10 w-auto object-contain" />
                        ) : (
                          <span className="text-xs font-semibold text-gray-400">No Logo</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">{store.name}</p>
                        <p className="text-sm text-gray-500 truncate">
                          {type === 'location'
                            ? [store.city, store.phone].filter(Boolean).join(' • ') || 'No contact details yet'
                            : store.logo_alt || 'Logo-driven storefront section'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(store)} className="p-1.5 text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"><Pencil size={14} /></button>
                      <button onClick={() => store.id && handleDelete(store.id)} disabled={deleting === store.id}
                        className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
