'use client';

import { useState } from 'react';
import { Plus, Trash2, Save, Pencil, X, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';

const inputCls = 'w-full h-11 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all';
const labelCls = 'text-sm font-semibold text-gray-700';

interface Doc {
  id?: number;
  title: string;
  file_url: string;
  file_type: string;
  file_size: string;
  pages: string;
  product_id: string | number;
}

const EMPTY: Doc = { title: '', file_url: '', file_type: 'pdf', file_size: '', pages: '', product_id: '' };

export default function DocsClient({ initialDocs }: { initialDocs: Doc[] }) {
  const [docs, setDocs] = useState<Doc[]>(initialDocs);
  const [editing, setEditing] = useState<Doc | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  function showToast(type: 'success' | 'error', msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  }

  function openNew() { setEditing({ ...EMPTY }); setIsNew(true); }
  function openEdit(d: Doc) { setEditing({ ...d }); setIsNew(false); }
  function closeEdit() { setEditing(null); setIsNew(false); }

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    const res = await fetch('/api/docs', {
      method: isNew ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing),
    });
    setSaving(false);
    if (res.ok) {
      const saved = await res.json();
      if (isNew) setDocs(p => [...p, saved]);
      else setDocs(p => p.map(d => d.id === saved.id ? saved : d));
      closeEdit();
      showToast('success', isNew ? 'Document created!' : 'Document updated!');
    } else {
      showToast('error', 'Failed to save document.');
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this document?')) return;
    setDeleting(id);
    const res = await fetch(`/api/docs?id=${id}`, { method: 'DELETE' });
    setDeleting(null);
    if (res.ok) {
      setDocs(p => p.filter(d => d.id !== id));
      showToast('success', 'Document deleted.');
    } else {
      showToast('error', 'Failed to delete.');
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
          <Plus size={16} /> Add Document
        </button>
      </div>

      {editing && (
        <div className="bg-white rounded-2xl border border-sky-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-gray-900">{isNew ? 'New Document' : `Edit: ${editing.title}`}</h2>
            <button onClick={closeEdit} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"><X size={16} /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5 md:col-span-2">
              <label className={labelCls}>Document Title</label>
              <input value={editing.title} onChange={e => setEditing(p => ({ ...p!, title: e.target.value }))} className={inputCls} placeholder="5KWH Battery Datasheet" />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <label className={labelCls}>File URL</label>
              <input value={editing.file_url} onChange={e => setEditing(p => ({ ...p!, file_url: e.target.value }))} className={inputCls} placeholder="https://..." />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>File Type</label>
              <select value={editing.file_type} onChange={e => setEditing(p => ({ ...p!, file_type: e.target.value }))} className={inputCls}>
                <option value="pdf">PDF</option>
                <option value="doc">DOC</option>
                <option value="xlsx">XLSX</option>
                <option value="zip">ZIP</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>File Size</label>
              <input value={editing.file_size} onChange={e => setEditing(p => ({ ...p!, file_size: e.target.value }))} className={inputCls} placeholder="2.4 MB" />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Pages</label>
              <input value={editing.pages} onChange={e => setEditing(p => ({ ...p!, pages: e.target.value }))} className={inputCls} placeholder="12" />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Product ID</label>
              <input value={editing.product_id} onChange={e => setEditing(p => ({ ...p!, product_id: e.target.value }))} className={inputCls} placeholder="WooCommerce product ID" />
              <p className="text-xs text-gray-400">Find the product ID in Products list (shown as #ID).</p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={closeEdit} className="px-4 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-sky-700 text-white rounded-xl text-sm font-semibold hover:bg-sky-800 transition-colors disabled:opacity-60">
              <Save size={15} /> {saving ? 'Saving...' : 'Save Document'}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {docs.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-400 text-sm">No documents yet. Click &quot;Add Document&quot; to create one.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>{['Title', 'Type', 'Size', 'Product ID', 'Actions'].map(h => (
                <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {docs.map(d => (
                <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{d.title}</span>
                      {d.file_url && (
                        <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="text-sky-600 hover:text-sky-700">
                          <ExternalLink size={13} />
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 uppercase">{d.file_type}</span>
                  </td>
                  <td className="px-5 py-4 text-gray-500">{d.file_size || '—'}</td>
                  <td className="px-5 py-4 text-gray-500">{d.product_id || '—'}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(d)} className="p-1.5 text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"><Pencil size={14} /></button>
                      <button onClick={() => d.id && handleDelete(d.id)} disabled={deleting === d.id}
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
