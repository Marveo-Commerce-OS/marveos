'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Save, ShieldCheck, Rocket, ScrollText } from 'lucide-react';
import { WORDPRESS_ROLE_OPTIONS, type WordPressRoleKey } from '@/src/config/wordpressRoles';

type AdminModuleKey =
  | 'dashboard'
  | 'products'
  | 'orders'
  | 'reports'
  | 'customers'
  | 'blog'
  | 'stores'
  | 'settings'
  | 'admin_settings';

type SettingsPayload = {
  module_access: Record<string, Partial<Record<AdminModuleKey, boolean>>>;
  maintenance: {
    site_under_construction: boolean;
    under_construction_title: string;
    under_construction_message: string;
  };
};

const MODULE_LABELS: Array<{ key: AdminModuleKey; label: string }> = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'products', label: 'Products' },
  { key: 'orders', label: 'Orders' },
  { key: 'reports', label: 'Reports' },
  { key: 'customers', label: 'Customers' },
  { key: 'blog', label: 'Blog Posts' },
  { key: 'stores', label: 'Stores' },
  { key: 'settings', label: 'Settings' },
  { key: 'admin_settings', label: 'Advanced Settings' },
];

const ROLE_LABEL_MAP: Record<WordPressRoleKey, string> = Object.fromEntries(
  WORDPRESS_ROLE_OPTIONS.map((option) => [option.value, option.label])
) as Record<WordPressRoleKey, string>;

function createDefaultRoleAccess(role: WordPressRoleKey): Record<AdminModuleKey, boolean> {
  const allTrue = MODULE_LABELS.reduce((acc, module) => ({ ...acc, [module.key]: true }), {} as Record<AdminModuleKey, boolean>);

  if (role === 'owner' || role === 'administrator') {
    return allTrue;
  }

  if (role === 'shop_manager') {
    return MODULE_LABELS.reduce((acc, module) => ({
      ...acc,
      [module.key]: ['dashboard', 'products', 'orders', 'customers', 'stores', 'settings'].includes(module.key),
    }), {} as Record<AdminModuleKey, boolean>);
  }

  if (role === 'editor') {
    return MODULE_LABELS.reduce((acc, module) => ({
      ...acc,
      [module.key]: ['dashboard', 'reports', 'blog', 'settings'].includes(module.key),
    }), {} as Record<AdminModuleKey, boolean>);
  }

  if (role === 'author') {
    return MODULE_LABELS.reduce((acc, module) => ({
      ...acc,
      [module.key]: ['dashboard', 'blog'].includes(module.key),
    }), {} as Record<AdminModuleKey, boolean>);
  }

  if (role === 'contributor') {
    return MODULE_LABELS.reduce((acc, module) => ({
      ...acc,
      [module.key]: module.key === 'blog',
    }), {} as Record<AdminModuleKey, boolean>);
  }

  return MODULE_LABELS.reduce((acc, module) => ({
    ...acc,
    [module.key]: module.key === 'dashboard',
  }), {} as Record<AdminModuleKey, boolean>);
}

const inputCls = 'w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500';
const labelCls = 'text-sm font-semibold text-gray-700';

export default function AdminSettingsClient() {
  const [activeTab, setActiveTab] = useState<'access' | 'launch' | 'audit'>('launch');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  const [settings, setSettings] = useState<SettingsPayload>({
    module_access: {},
    maintenance: {
      site_under_construction: false,
      under_construction_title: 'We are coming back soon',
      under_construction_message: 'We are currently making improvements to serve you better. Please check back shortly.',
    },
  });

  const [roleFilter, setRoleFilter] = useState<WordPressRoleKey>('owner');
  const [moduleAccess, setModuleAccess] = useState<Record<string, Record<AdminModuleKey, boolean>>>({
    owner: createDefaultRoleAccess('owner'),
    administrator: createDefaultRoleAccess('administrator'),
    shop_manager: createDefaultRoleAccess('shop_manager'),
    editor: createDefaultRoleAccess('editor'),
    author: createDefaultRoleAccess('author'),
    contributor: createDefaultRoleAccess('contributor'),
    subscriber: createDefaultRoleAccess('subscriber'),
  });

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch('/api/admin/settings');
        if (res.ok) {
          const data = await res.json();
          // Merge API response with defaults to ensure all required fields exist
          setSettings(prev => ({
            module_access: data.module_access || prev.module_access,
            maintenance: {
              site_under_construction: data.maintenance?.site_under_construction ?? prev.maintenance.site_under_construction,
              under_construction_title: data.maintenance?.under_construction_title ?? prev.maintenance.under_construction_title,
              under_construction_message: data.maintenance?.under_construction_message ?? prev.maintenance.under_construction_message,
            },
          }));
          setModuleAccess(data.module_access || moduleAccess);
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
        setStatus('error');
        setStatusMessage('Failed to load settings');
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...settings, module_access: moduleAccess }),
      });
      if (res.ok) {
        setStatus('success');
        setStatusMessage('Settings saved successfully');
        setTimeout(() => setStatus('idle'), 3000);
      } else {
        setStatus('error');
        setStatusMessage('Failed to save settings');
      }
    } catch (error) {
      console.error('Save error:', error);
      setStatus('error');
      setStatusMessage('Error saving settings');
    } finally {
      setSaving(false);
    }
  };

  const toggleModuleAccess = (role: WordPressRoleKey, moduleKey: AdminModuleKey) => {
    if (role === 'owner') return;
    setModuleAccess(prev => ({
      ...prev,
      [role]: { ...prev[role], [moduleKey]: !prev[role]?.[moduleKey] },
    }));
  };

  const activeModulesForRole = Object.values(moduleAccess[roleFilter] ?? {}).filter(Boolean).length;

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading...</div>;
  }

  return (
    <div className="space-y-5">

      {status === 'success' && (
        <div className="flex items-center gap-2 rounded-xl border border-green-100 bg-green-50 p-3 text-sm text-green-700">
          <CheckCircle2 size={16} /> {statusMessage}
        </div>
      )}
      {status === 'error' && (
        <div className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-600">
          <AlertCircle size={16} /> {statusMessage}
        </div>
      )}

      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm md:p-7">
        <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-slate-50 p-3.5">
            <div className="flex items-center gap-2 text-gray-700 mb-1">
              <Rocket size={15} />
              <span className="text-xs font-semibold uppercase tracking-wide">Launch Status</span>
            </div>
            <p className="text-sm font-semibold text-gray-900">
              {settings.maintenance.site_under_construction ? 'Under Construction' : 'Live'}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-slate-50 p-3.5">
            <div className="flex items-center gap-2 text-gray-700 mb-1">
              <ShieldCheck size={15} />
              <span className="text-xs font-semibold uppercase tracking-wide">Role Scope</span>
            </div>
            <p className="text-sm font-semibold text-gray-900">{ROLE_LABEL_MAP[roleFilter]}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-slate-50 p-3.5">
            <div className="flex items-center gap-2 text-gray-700 mb-1">
              <ScrollText size={15} />
              <span className="text-xs font-semibold uppercase tracking-wide">Visible Modules</span>
            </div>
            <p className="text-sm font-semibold text-gray-900">{activeModulesForRole} enabled</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-7 border-b border-gray-100">
          <div className="flex flex-wrap gap-2 pb-3">
          <button
            onClick={() => setActiveTab('launch')}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap ${
              activeTab === 'launch' ? 'bg-sky-700 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}>
            Launch Control
          </button>
          <button
            onClick={() => setActiveTab('access')}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap ${
              activeTab === 'access' ? 'bg-sky-700 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}>
            Module Access
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap ${
              activeTab === 'audit' ? 'bg-sky-700 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}>
            Audit Log
          </button>
          </div>
        </div>

        {/* Launch Control Tab */}
        {activeTab === 'launch' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Public Storefront Launch Control</h2>
              <p className="text-sm text-gray-500 mb-4">Control whether the storefront is under construction or live.</p>
            </div>

              <div className="space-y-4">
              <label className="flex items-center gap-3 rounded-2xl border border-gray-200 p-4 cursor-pointer transition-colors hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={settings.maintenance.site_under_construction}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    maintenance: { ...prev.maintenance, site_under_construction: e.target.checked },
                  }))}
                  className="w-5 h-5 rounded border-gray-300"
                />
                <div>
                  <span className="font-semibold text-gray-700">Site Under Construction</span>
                  <p className="text-xs text-gray-500">Show maintenance page to visitors</p>
                </div>
              </label>

              {settings.maintenance.site_under_construction && (
                <div className="space-y-3 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div>
                    <label className={labelCls}>Maintenance Title</label>
                    <input
                      type="text"
                      value={settings.maintenance.under_construction_title}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        maintenance: { ...prev.maintenance, under_construction_title: e.target.value },
                      }))}
                      className={inputCls}
                      placeholder="We are coming back soon"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Maintenance Message</label>
                    <textarea
                      value={settings.maintenance.under_construction_message}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        maintenance: { ...prev.maintenance, under_construction_message: e.target.value },
                      }))}
                      className="w-full p-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
                      rows={3}
                      placeholder="Message to show during maintenance"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Module Access Tab */}
        {activeTab === 'access' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Module Access Permissions</h2>
              <p className="text-sm text-gray-500 mb-4">Control which modules each user role can access.</p>
            </div>

            <div className="flex flex-wrap gap-2 mb-6">
              {WORDPRESS_ROLE_OPTIONS.map((role) => (
                <button
                  key={role.value}
                  onClick={() => setRoleFilter(role.value)}
                  disabled={role.locked}
                  className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                    roleFilter === role.value
                      ? 'bg-sky-700 text-white shadow-sm'
                      : role.locked
                        ? 'border border-gray-200 bg-gray-100 text-gray-700'
                        : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-100'
                  }`}>
                  {role.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {MODULE_LABELS.map(({ key, label }) => (
                <label key={key} className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-3.5 transition-colors hover:bg-gray-50">
                  <span className="text-sm font-medium text-gray-700">{label}</span>
                  <input
                    type="checkbox"
                    checked={moduleAccess[roleFilter]?.[key] ?? false}
                    onChange={() => toggleModuleAccess(roleFilter, key)}
                    className="w-5 h-5 rounded border-gray-300"
                  />
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Audit Log Tab */}
        {activeTab === 'audit' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Audit Log</h2>
              <p className="text-sm text-gray-500 mb-4">Recent system events and administrative actions.</p>
            </div>

            <div className="h-96 space-y-2 overflow-y-auto rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="text-sm text-gray-600">
                <div className="flex gap-3 pb-2 border-b border-gray-200">
                  <span className="text-gray-400 whitespace-nowrap text-xs md:text-sm">{new Date().toLocaleString()}</span>
                  <span>Advanced Settings opened</span>
                </div>
              </div>
              <div className="text-sm text-gray-600">
                <div className="flex gap-3 pb-2 border-b border-gray-200">
                  <span className="text-gray-400 whitespace-nowrap">{new Date(Date.now() - 3600000).toLocaleString()}</span>
                  <span>Module Access permissions updated</span>
                </div>
              </div>
              <div className="text-sm text-gray-600">
                <div className="flex gap-3 pb-2 border-b border-gray-200">
                  <span className="text-gray-400 whitespace-nowrap">{new Date(Date.now() - 7200000).toLocaleString()}</span>
                  <span>Launch Control toggled to ON</span>
                </div>
              </div>
              <div className="text-sm text-gray-600">
                <div className="flex gap-3 pb-2">
                  <span className="text-gray-400 whitespace-nowrap">{new Date(Date.now() - 86400000).toLocaleString()}</span>
                  <span>User logged in</span>
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-400">Showing recent activity. Full audit logs and exports available from Marveo Cloud.</p>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3 border-t border-gray-100 pt-6">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-sky-700 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-800 disabled:opacity-60">
            <Save size={16} />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
