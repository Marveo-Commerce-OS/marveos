'use client';

import { useEffect, useMemo, useState } from 'react';

type TemplateStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
type TemplateVisibility = 'INTERNAL' | 'PUBLIC';
type WebsiteType = 'NEW_WEBSITE' | 'EXISTING_WEBSITE' | 'CUSTOM_HEADLESS';
type StackType = 'WORDPRESS_NEXTJS' | 'WORDPRESS_ONLY' | 'NEXTJS' | 'CUSTOM';

type TemplateRecord = {
  templateId: string;
  name: string;
  slug: string;
  businessType: string;
  sector?: string;
  category?: string;
  description: string;
  previewImage: string;
  status: TemplateStatus;
  visibility: TemplateVisibility;
  supportedWebsiteTypes: WebsiteType[];
  supportedStacks: StackType[];
  planAvailability: string[];
  countryAvailability?: string[];
  featureModules: string[];
  requiresSupport: boolean;
  repoSource: 'MARVEO_TEMPLATES' | 'MANUAL' | 'EXTERNAL';
  repoPath?: string;
  version: string;
  artifactStatus: 'MISSING' | 'FOUND' | 'NOT_VALIDATED';
  createdAt: string;
  updatedAt: string;
};

const WEBSITE_TYPE_OPTIONS: WebsiteType[] = ['NEW_WEBSITE', 'EXISTING_WEBSITE', 'CUSTOM_HEADLESS'];
const STACK_OPTIONS: StackType[] = ['WORDPRESS_NEXTJS', 'WORDPRESS_ONLY', 'NEXTJS', 'CUSTOM'];
const PLAN_OPTIONS = ['starter', 'business', 'growth', 'enterprise', 'all'];

function toLabel(raw: string): string {
  return raw
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function parseCommaList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function MasterTemplatesPage() {
  const [templates, setTemplates] = useState<TemplateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TemplateRecord | null>(null);
  const [createForm, setCreateForm] = useState({
    templateId: '',
    name: '',
    slug: '',
    businessType: 'General',
    sector: '',
    category: '',
    description: '',
    previewImage: '',
    repoPath: '',
    version: '1.0.0',
  });
  const [importJson, setImportJson] = useState('');

  const stats = useMemo(() => {
    return {
      total: templates.length,
      activePublic: templates.filter((item) => item.status === 'ACTIVE' && item.visibility === 'PUBLIC').length,
      internalOnly: templates.filter((item) => item.visibility === 'INTERNAL').length,
      missingArtifacts: templates.filter((item) => item.artifactStatus === 'MISSING').length,
    };
  }, [templates]);

  async function loadTemplates() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/master/templates', { cache: 'no-store' });
      const data = await res.json().catch(() => null) as { ok?: boolean; templates?: TemplateRecord[]; error?: string } | null;
      if (!res.ok || !data?.ok || !Array.isArray(data.templates)) {
        throw new Error(data?.error || 'Failed to load templates.');
      }
      setTemplates(data.templates);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadTemplates();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  function beginEdit(template: TemplateRecord) {
    setEditingId(template.templateId);
    setDraft({ ...template });
    setError('');
    setMessage('');
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
  }

  function toggleSelection<T extends string>(current: T[], value: T): T[] {
    return current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
  }

  async function saveTemplate() {
    if (!draft || !editingId) return;
    setError('');
    setMessage('');

    const payload = {
      ...draft,
      countryAvailability: draft.countryAvailability,
      featureModules: draft.featureModules,
    };

    const res = await fetch(`/api/master/templates/${encodeURIComponent(editingId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => null) as { ok?: boolean; error?: string } | null;
    if (!res.ok || !data?.ok) {
      setError(data?.error || 'Failed to save template.');
      return;
    }

    setMessage(`Template ${editingId} updated.`);
    cancelEdit();
    await loadTemplates();
  }

  async function createTemplate() {
    setError('');
    setMessage('');

    if (!createForm.templateId.trim() || !createForm.name.trim()) {
      setError('Template ID and name are required.');
      return;
    }

    const res = await fetch('/api/master/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createForm),
    });

    const data = await res.json().catch(() => null) as { ok?: boolean; error?: string } | null;
    if (!res.ok || !data?.ok) {
      setError(data?.error || 'Failed to create template.');
      return;
    }

    setCreateForm({
      templateId: '',
      name: '',
      slug: '',
      businessType: 'General',
      sector: '',
      category: '',
      description: '',
      previewImage: '',
      repoPath: '',
      version: '1.0.0',
    });
    setMessage('Template created. Edit it to configure publishing and mapping controls.');
    await loadTemplates();
  }

  async function importTemplateRegistry() {
    setError('');
    setMessage('');

    if (!importJson.trim()) {
      setError('Paste import JSON payload first.');
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(importJson);
    } catch {
      setError('Import JSON is not valid.');
      return;
    }

    const payload = Array.isArray(parsed) ? { templates: parsed } : parsed;

    const res = await fetch('/api/master/templates/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => null) as { ok?: boolean; error?: string; imported?: number } | null;
    if (!res.ok || !data?.ok) {
      setError(data?.error || 'Failed to import template registry.');
      return;
    }

    setMessage(`Template registry import completed. Imported ${data.imported || 0} record(s).`);
    await loadTemplates();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Templates</h1>
        <p className="mt-2 text-sm text-slate-600">Master is the source of truth for template metadata used by public website and setup onboarding.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total templates</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{stats.total}</p>
          <p className="mt-2 text-xs text-slate-500">Live data</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
          <p className="text-xs font-semibold uppercase tracking-wide">Active and public</p>
          <p className="mt-2 text-2xl font-bold">{stats.activePublic}</p>
          <p className="mt-2 text-xs">Visible to website and setup flow</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <p className="text-xs font-semibold uppercase tracking-wide">Missing artifacts</p>
          <p className="mt-2 text-2xl font-bold">{stats.missingArtifacts}</p>
          <p className="mt-2 text-xs">Cannot publish publicly unless support/manual is allowed</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Internal only</p>
          <p className="mt-2 text-2xl font-bold">{stats.internalOnly}</p>
          <p className="mt-2 text-xs text-slate-500">Read-only scaffold for advanced media/content editing can wait</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-slate-900">Create template metadata</h2>
        <p className="mt-1 text-xs text-slate-500">Safe metadata CRUD is enabled. Full design builder and media pipeline are intentionally deferred.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <input value={createForm.templateId} onChange={(e) => setCreateForm((prev) => ({ ...prev, templateId: e.target.value }))} placeholder="Template ID (example: template-makeup-pro)" className="rounded-xl border border-slate-300 px-3 py-2 text-sm" />
          <input value={createForm.name} onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Template name" className="rounded-xl border border-slate-300 px-3 py-2 text-sm" />
          <input value={createForm.slug} onChange={(e) => setCreateForm((prev) => ({ ...prev, slug: e.target.value }))} placeholder="Slug (optional)" className="rounded-xl border border-slate-300 px-3 py-2 text-sm" />
          <input value={createForm.businessType} onChange={(e) => setCreateForm((prev) => ({ ...prev, businessType: e.target.value }))} placeholder="Business type" className="rounded-xl border border-slate-300 px-3 py-2 text-sm" />
          <input value={createForm.sector} onChange={(e) => setCreateForm((prev) => ({ ...prev, sector: e.target.value }))} placeholder="Sector" className="rounded-xl border border-slate-300 px-3 py-2 text-sm" />
          <input value={createForm.category} onChange={(e) => setCreateForm((prev) => ({ ...prev, category: e.target.value }))} placeholder="Category" className="rounded-xl border border-slate-300 px-3 py-2 text-sm" />
          <input value={createForm.repoPath} onChange={(e) => setCreateForm((prev) => ({ ...prev, repoPath: e.target.value }))} placeholder="Repo path (example: beauty/makeup-artist/template.json)" className="rounded-xl border border-slate-300 px-3 py-2 text-sm md:col-span-2" />
          <input value={createForm.version} onChange={(e) => setCreateForm((prev) => ({ ...prev, version: e.target.value }))} placeholder="Version" className="rounded-xl border border-slate-300 px-3 py-2 text-sm" />
          <input value={createForm.previewImage} onChange={(e) => setCreateForm((prev) => ({ ...prev, previewImage: e.target.value }))} placeholder="Preview image URL or path" className="rounded-xl border border-slate-300 px-3 py-2 text-sm md:col-span-2" />
          <textarea value={createForm.description} onChange={(e) => setCreateForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="Description" className="rounded-xl border border-slate-300 px-3 py-2 text-sm md:col-span-2" rows={3} />
        </div>
        <button type="button" onClick={createTemplate} className="mt-4 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Create template</button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-slate-900">Manual import or sync</h2>
        <p className="mt-1 text-xs text-slate-500">Runtime filesystem scanning across repositories is not guaranteed in production. Use JSON import from marveo-templates metadata export.</p>
        <textarea
          value={importJson}
          onChange={(e) => setImportJson(e.target.value)}
          placeholder='{"templates":[{"templateId":"template-makeup-artist","name":"Makeup Artist Template","repoPath":"beauty/makeup-artist/template.json","status":"ACTIVE","visibility":"PUBLIC"}]}'
          className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
          rows={5}
        />
        <button type="button" onClick={importTemplateRegistry} className="mt-3 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Import registry JSON</button>
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-slate-600">Loading templates...</div>
        ) : templates.length === 0 ? (
          <div className="p-6 text-sm text-slate-600">No templates found yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px]">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  {['Template', 'Status', 'Visibility', 'Website types', 'Stacks', 'Plans', 'Repo path', 'Version', 'Artifact', 'Updated', 'Actions'].map((header) => (
                    <th key={header} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {templates.map((template) => (
                  <tr key={template.templateId} className="border-b border-slate-100 align-top">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{template.name}</p>
                      <p className="text-xs text-slate-500">{template.templateId}</p>
                      <p className="mt-1 text-xs text-slate-500">{template.businessType}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{toLabel(template.status)}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{toLabel(template.visibility)}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{template.supportedWebsiteTypes.map((item) => toLabel(item)).join(', ')}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{template.supportedStacks.map((item) => toLabel(item)).join(', ')}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{template.planAvailability.join(', ')}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{template.repoPath || (template.requiresSupport ? 'Support/manual path' : 'Missing')}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{template.version}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${template.artifactStatus === 'FOUND' ? 'bg-emerald-100 text-emerald-700' : template.artifactStatus === 'MISSING' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                        {toLabel(template.artifactStatus)}
                      </span>
                      {template.status === 'ACTIVE' && template.visibility === 'PUBLIC' && !template.requiresSupport && template.artifactStatus !== 'FOUND' ? (
                        <p className="mt-1 text-xs text-red-600">Cannot publish until template artifact is mapped.</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{new Date(template.updatedAt).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => beginEdit(template)} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-200">Edit metadata</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {draft && editingId && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">Edit template: {editingId}</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <input value={draft.name} onChange={(e) => setDraft((prev) => (prev ? { ...prev, name: e.target.value } : prev))} placeholder="Name" className="rounded-xl border border-slate-300 px-3 py-2 text-sm" />
            <input value={draft.slug} onChange={(e) => setDraft((prev) => (prev ? { ...prev, slug: e.target.value } : prev))} placeholder="Slug" className="rounded-xl border border-slate-300 px-3 py-2 text-sm" />
            <input value={draft.businessType} onChange={(e) => setDraft((prev) => (prev ? { ...prev, businessType: e.target.value } : prev))} placeholder="Business type" className="rounded-xl border border-slate-300 px-3 py-2 text-sm" />
            <input value={draft.sector || ''} onChange={(e) => setDraft((prev) => (prev ? { ...prev, sector: e.target.value } : prev))} placeholder="Sector" className="rounded-xl border border-slate-300 px-3 py-2 text-sm" />
            <input value={draft.category || ''} onChange={(e) => setDraft((prev) => (prev ? { ...prev, category: e.target.value } : prev))} placeholder="Category" className="rounded-xl border border-slate-300 px-3 py-2 text-sm" />
            <input value={draft.previewImage} onChange={(e) => setDraft((prev) => (prev ? { ...prev, previewImage: e.target.value } : prev))} placeholder="Preview image" className="rounded-xl border border-slate-300 px-3 py-2 text-sm" />
            <select value={draft.status} onChange={(e) => setDraft((prev) => (prev ? { ...prev, status: e.target.value as TemplateStatus } : prev))} className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Active</option>
              <option value="ARCHIVED">Archived</option>
            </select>
            <select value={draft.visibility} onChange={(e) => setDraft((prev) => (prev ? { ...prev, visibility: e.target.value as TemplateVisibility } : prev))} className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
              <option value="INTERNAL">Internal</option>
              <option value="PUBLIC">Public</option>
            </select>
            <textarea value={draft.description} onChange={(e) => setDraft((prev) => (prev ? { ...prev, description: e.target.value } : prev))} className="rounded-xl border border-slate-300 px-3 py-2 text-sm md:col-span-2" rows={3} placeholder="Description" />
            <input value={draft.repoPath || ''} onChange={(e) => setDraft((prev) => (prev ? { ...prev, repoPath: e.target.value } : prev))} placeholder="Repo path (example: beauty/makeup-artist/template.json)" className="rounded-xl border border-slate-300 px-3 py-2 text-sm md:col-span-2" />
            <input value={draft.version} onChange={(e) => setDraft((prev) => (prev ? { ...prev, version: e.target.value } : prev))} placeholder="Version" className="rounded-xl border border-slate-300 px-3 py-2 text-sm" />
            <select value={draft.repoSource} onChange={(e) => setDraft((prev) => (prev ? { ...prev, repoSource: e.target.value as TemplateRecord['repoSource'] } : prev))} className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
              <option value="MARVEO_TEMPLATES">Marveo Templates Repo</option>
              <option value="MANUAL">Manual</option>
              <option value="EXTERNAL">External</option>
            </select>
            <select value={draft.artifactStatus} onChange={(e) => setDraft((prev) => (prev ? { ...prev, artifactStatus: e.target.value as TemplateRecord['artifactStatus'] } : prev))} className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
              <option value="FOUND">Found</option>
              <option value="NOT_VALIDATED">Not validated</option>
              <option value="MISSING">Missing</option>
            </select>
            <input value={(draft.featureModules || []).join(', ')} onChange={(e) => setDraft((prev) => (prev ? { ...prev, featureModules: parseCommaList(e.target.value) } : prev))} placeholder="Feature modules (comma separated)" className="rounded-xl border border-slate-300 px-3 py-2 text-sm md:col-span-2" />
            <input value={(draft.countryAvailability || []).join(', ')} onChange={(e) => setDraft((prev) => (prev ? { ...prev, countryAvailability: parseCommaList(e.target.value) } : prev))} placeholder="Country availability (optional, comma separated country codes)" className="rounded-xl border border-slate-300 px-3 py-2 text-sm md:col-span-2" />
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Supported website types</p>
              <div className="mt-2 space-y-2">
                {WEBSITE_TYPE_OPTIONS.map((option) => (
                  <label key={option} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={draft.supportedWebsiteTypes.includes(option)}
                      onChange={() => setDraft((prev) => (prev ? { ...prev, supportedWebsiteTypes: toggleSelection(prev.supportedWebsiteTypes, option) } : prev))}
                    />
                    {toLabel(option)}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Supported stacks</p>
              <div className="mt-2 space-y-2">
                {STACK_OPTIONS.map((option) => (
                  <label key={option} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={draft.supportedStacks.includes(option)}
                      onChange={() => setDraft((prev) => (prev ? { ...prev, supportedStacks: toggleSelection(prev.supportedStacks, option) } : prev))}
                    />
                    {toLabel(option)}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Plan availability</p>
              <div className="mt-2 space-y-2">
                {PLAN_OPTIONS.map((option) => (
                  <label key={option} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={draft.planAvailability.includes(option)}
                      onChange={() => setDraft((prev) => (prev ? { ...prev, planAvailability: toggleSelection(prev.planAvailability, option) } : prev))}
                    />
                    {option}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <label className="mt-4 inline-flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={draft.requiresSupport} onChange={(e) => setDraft((prev) => (prev ? { ...prev, requiresSupport: e.target.checked } : prev))} />
            Requires support for onboarding
          </label>

          {draft.status === 'ACTIVE' && draft.visibility === 'PUBLIC' && !draft.requiresSupport && draft.artifactStatus !== 'FOUND' ? (
            <p className="mt-3 text-sm text-red-700">Cannot publish until template artifact is mapped.</p>
          ) : null}

          <div className="mt-5 flex gap-2">
            <button type="button" onClick={saveTemplate} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Save changes</button>
            <button type="button" onClick={cancelEdit} className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-800">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
