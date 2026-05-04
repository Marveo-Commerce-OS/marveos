'use client';

import { useState } from 'react';
import { Plus, Trash2, Save, Pencil, X, CheckCircle2, AlertCircle } from 'lucide-react';

const inputCls = 'w-full h-11 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all';
const labelCls = 'text-sm font-semibold text-gray-700';

interface Store {
  id?: number;
  name: string;
  city: string;
  address: string;
  phone: string;
  map_url: string;
  store_type: string;
}

const EMPTY: Store = { name: '', city: '', address: '', phone: '', map_url: '', store_type: 'prag' };

const TYPE_LABELS: Record<string, string> = { prag: 'PRAG Store', online: 'Online Store', chain: 'Chain Store' };

export default function StoresClient({ initialStores }: { initialStores: Store[] }) {
  const [stores, setStores] = useState<Store[]>(initialStores);
  const [editing, setEditing] = useState<Store | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  function showToast(type: 'success' | 'error', msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  }

  function openNew() { setEditing({ ...EMPTY }); setIsNew(true); }
  function openEdit(s: Store) { setEditing({ ...s }); setIsNew(false); }
  function closeEdit() { setEditing(null); setIsNew(false); }

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

  return (
    <div className="space-y-4">
      {toast && (
        <div className={`flex items-center gap-2 p-3 rounded-xl text-sm border ${toast.type === 'success' ? 'bg-green-50 border-green-100 text-green-700' : 'bg-red-50 border-red-100 text-red-600'}`}>
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      <div className="flex justify-end">
        <button onClick={openNew}
          className="flex items-center gap-2 px-4 py-2.5 bg-sky-700 text-white rounded-xl text-sm font-semibold hover:bg-sky-800 transition-colors">
          <Plus size={16} /> Add Store
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
              <input value={editing.name} onChange={e => setEditing(p => ({ ...p!, name: e.target.value }))} className={inputCls} placeholder="PRAG Lagos" />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Store Type</label>
              <select value={editing.store_type} onChange={e => setEditing(p => ({ ...p!, store_type: e.target.value }))} className={inputCls}>
                <option value="prag">PRAG Store</option>
                <option value="online">Online Store</option>
                <option value="chain">Chain Store</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>City</label>
              <input value={editing.city} onChange={e => setEditing(p => ({ ...p!, city: e.target.value }))} className={inputCls} placeholder="Lagos" />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Phone</label>
              <input value={editing.phone} onChange={e => setEditing(p => ({ ...p!, phone: e.target.value }))} className={inputCls} placeholder="+234..." />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <label className={labelCls}>Address</label>
              <input value={editing.address} onChange={e => setEditing(p => ({ ...p!, address: e.target.value }))} className={inputCls} placeholder="14 Industrial Layout, VI, Lagos" />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <label className={labelCls}>Google Maps URL</label>
              <input value={editing.map_url} onChange={e => setEditing(p => ({ ...p!, map_url: e.target.value }))} className={inputCls} placeholder="https://maps.google.com/..." />
            </div>
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
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {stores.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-400 text-sm">No stores yet. Click "Add Store" to create one.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>{['Store', 'Type', 'City', 'Phone', 'Actions'].map(h => (
                <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {stores.map(s => (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-4 font-medium text-gray-900">{s.name}</td>
                  <td className="px-5 py-4">
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-sky-50 text-sky-700">{TYPE_LABELS[s.store_type] ?? s.store_type}</span>
                  </td>
                  <td className="px-5 py-4 text-gray-500">{s.city}</td>
                  <td className="px-5 py-4 text-gray-500">{s.phone}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(s)} className="p-1.5 text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"><Pencil size={14} /></button>
                      <button onClick={() => s.id && handleDelete(s.id)} disabled={deleting === s.id}
                        className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
