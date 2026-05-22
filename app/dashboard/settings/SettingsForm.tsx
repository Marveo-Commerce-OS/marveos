'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import type { SiteSettings, TeamMember, ModulePreference, PaymentGateway, Integration } from '@/lib/types';
import { Save, CheckCircle2, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { WORDPRESS_ROLE_OPTIONS } from '@/src/config/wordpressRoles';

const inputCls = 'w-full h-11 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all';
const labelCls = 'text-sm font-semibold text-gray-700';
const sectionCls = 'space-y-4 pt-4 border-t border-gray-100 first:border-0 first:pt-0';

const TABS = ['Branding', 'Socials', 'Payments', 'SEO & Scripts', 'Integrations', 'Users & Team', 'Modules'];

const DEFAULT_INTEGRATIONS: Integration[] = [
  { key: 'google_analytics', name: 'Google Analytics', enabled: false, config: {} },
  { key: 'google_search_console', name: 'Google Search Console', enabled: false, config: {} },
  { key: 'mailchimp', name: 'Mailchimp', enabled: false, config: {}, requiresModules: [] },
  { key: 'zapier', name: 'Zapier', enabled: false, config: {} },
  { key: 'slack', name: 'Slack', enabled: false, config: {} },
  { key: 'meta_pixel', name: 'Meta Pixel', enabled: false, config: {} },
];

const DEFAULT_PAYMENT_GATEWAYS: PaymentGateway[] = [
  { key: 'paystack', name: 'Paystack', enabled: false, testMode: false, requiredFields: { publicKey: '', secretKey: '' } },
  { key: 'stripe', name: 'Stripe', enabled: false, testMode: false, requiredFields: { publicKey: '', secretKey: '' } },
  { key: 'paypal', name: 'PayPal', enabled: false, testMode: false, requiredFields: { clientId: '', clientSecret: '' } },
];

const DEFAULT_TEAM_MEMBER: TeamMember = { name: '', role: '', email: '', phone: '' };
const DEFAULT_MODULES: ModulePreference[] = [
  { key: 'inventory', label: 'Inventory', enabled: true },
  { key: 'crm', label: 'CRM', enabled: false, requiresPayment: true },
  { key: 'analytics', label: 'Analytics', enabled: true },
  { key: 'whatsapp', label: 'WhatsApp', enabled: true },
  { key: 'procurement', label: 'Procurement', enabled: false, requiresPayment: true },
  { key: 'branches', label: 'Branches', enabled: false, requiresPayment: true },
  { key: 'ai_insights', label: 'AI Insights', enabled: false, requiresPayment: true },
];

const DEFAULT_SETTINGS: SiteSettings = {
  logo_url: '',
  favicon_url: '',
  primary_color: '#14B8A6',
  secondary_color: '#A3E635',
  typography: 'Inter',
  socials: {
    facebook: '',
    instagram: '',
    linkedin: '',
    twitter: '',
    whatsapp: '',
  },
  payment_gateways: DEFAULT_PAYMENT_GATEWAYS,
  integrations: DEFAULT_INTEGRATIONS,
  seo_site_title: '',
  seo_meta_description: '',
  seo_keywords: '',
  custom_head_scripts: '',
  custom_body_scripts: '',
  google_analytics_id: '',
  google_search_console_id: '',
  team_members: [],
  wordpress_users: [],
  module_preferences: DEFAULT_MODULES,
  maintenance: {
    site_under_construction: false,
    under_construction_title: 'We are coming back soon',
    under_construction_message: '',
  },
};

function mergeWithDefaults(saved: SiteSettings | null): SiteSettings {
  if (!saved) return DEFAULT_SETTINGS;
  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    socials: { ...DEFAULT_SETTINGS.socials, ...(saved.socials ?? {}) },
    payment_gateways: Array.isArray(saved.payment_gateways) && saved.payment_gateways.length > 0 ? saved.payment_gateways : DEFAULT_PAYMENT_GATEWAYS,
    integrations: Array.isArray(saved.integrations) && saved.integrations.length > 0 ? saved.integrations : DEFAULT_INTEGRATIONS,
    team_members: Array.isArray(saved.team_members) ? saved.team_members : [],
    module_preferences: Array.isArray(saved.module_preferences) && saved.module_preferences.length > 0
      ? saved.module_preferences
      : DEFAULT_MODULES,
  };
}

export default function SettingsForm({ initialSettings }: { initialSettings: SiteSettings | null }) {
  const [form, setForm] = useState<SiteSettings>(() => mergeWithDefaults(initialSettings));
  const [activeTab, setActiveTab] = useState('Branding');
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  useEffect(() => {
    const loadWordPressUsers = async () => {
      try {
        const res = await fetch('/api/admin/users', { cache: 'no-store' });
        if (!res.ok) {
          return;
        }

        const data = await res.json();
        const users = Array.isArray(data?.users)
          ? data.users.map((user: Record<string, unknown>) => ({
              username: String(user.username ?? ''),
              display_name: String(user.name ?? ''),
              email: String(user.email ?? ''),
              role: Array.isArray(user.roles) && user.roles.length > 0 ? String(user.roles[0]) : 'customer',
              active: Boolean(user.active ?? true),
            }))
          : [];

        setForm((prev) => ({
          ...prev,
          wordpress_users: users,
        }));
      } catch {
        // Keep form interactive even if user import fails.
      }
    };

    void loadWordPressUsers();
  }, []);

  function setField(field: keyof SiteSettings, value: unknown) {
    setForm(p => ({ ...p, [field]: value }));
  }

  function setSocial(key: keyof SiteSettings['socials'], value: string) {
    setForm(p => ({ ...p, socials: { ...p.socials, [key]: value } }));
  }

  function setPaymentGateway(index: number, key: keyof PaymentGateway, value: unknown) {
    const gateways = [...form.payment_gateways];
    gateways[index] = { ...gateways[index], [key]: value };
    setField('payment_gateways', gateways);
  }

  function setIntegration(index: number, key: keyof Integration, value: unknown) {
    const integrations = [...form.integrations];
    integrations[index] = { ...integrations[index], [key]: value };
    setField('integrations', integrations);
  }

  function setTeamMember(index: number, key: keyof TeamMember, value: string) {
    const members = [...form.team_members];
    members[index] = { ...members[index], [key]: value };
    setField('team_members', members);
  }

  function addTeamMember() {
    setField('team_members', [...form.team_members, { ...DEFAULT_TEAM_MEMBER }]);
  }

  function removeTeamMember(index: number) {
    setField('team_members', form.team_members.filter((_, idx) => idx !== index));
  }

  function toggleModule(index: number) {
    const modules = [...form.module_preferences];
    modules[index] = { ...modules[index], enabled: !modules[index].enabled };
    setField('module_preferences', modules);
  }

  function setWordPressUserRole(index: number, role: string) {
    const users = Array.isArray(form.wordpress_users) ? [...form.wordpress_users] : [];
    if (!users[index]) return;
    users[index] = { ...users[index], role };
    setField('wordpress_users', users);
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

      {/* Branding Tab */}
      {activeTab === 'Branding' && (
        <div className="space-y-5">
          <div className={sectionCls}>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Brand Identity</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className={labelCls}>Logo URL</label>
                <input value={form.logo_url} onChange={e => setField('logo_url', e.target.value)} className={inputCls} placeholder="https://.../logo.svg" />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>Favicon URL</label>
                <input value={form.favicon_url} onChange={e => setField('favicon_url', e.target.value)} className={inputCls} placeholder="https://.../favicon.ico" />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>Primary Color</label>
                <input type="color" value={form.primary_color} onChange={e => setField('primary_color', e.target.value)} className="w-full h-11 px-2 rounded-xl border border-gray-200 cursor-pointer" />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>Secondary Color</label>
                <input type="color" value={form.secondary_color} onChange={e => setField('secondary_color', e.target.value)} className="w-full h-11 px-2 rounded-xl border border-gray-200 cursor-pointer" />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <label className={labelCls}>Typography Font Family</label>
                <input value={form.typography} onChange={e => setField('typography', e.target.value)} className={inputCls} placeholder="Inter, Arial, etc." />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Socials Tab */}
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

      {/* Payments Tab */}
      {activeTab === 'Payments' && (
        <div className="space-y-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Payment Gateways</p>
          {form.payment_gateways.map((gateway, i) => (
            <div key={gateway.key} className="border border-gray-200 rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={gateway.enabled} onChange={(e) => setPaymentGateway(i, 'enabled', e.target.checked)} className="w-5 h-5 rounded border-gray-300" />
                  <span className="font-semibold text-gray-700">{gateway.name}</span>
                </label>
                <label className="text-xs flex items-center gap-2">
                  <input type="checkbox" checked={gateway.testMode} onChange={(e) => setPaymentGateway(i, 'testMode', e.target.checked)} />
                  Test Mode
                </label>
              </div>
              {gateway.enabled && gateway.requiredFields && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {Object.entries(gateway.requiredFields).map(([fieldKey, value]) => (
                    <input key={fieldKey} type="password" placeholder={fieldKey.replace(/([A-Z])/g, ' $1').trim()} className={inputCls}
                      value={typeof value === 'string' ? value : ''} onChange={(e) => setPaymentGateway(i, 'requiredFields', { ...gateway.requiredFields, [fieldKey]: e.target.value })} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* SEO & Scripts Tab */}
      {activeTab === 'SEO & Scripts' && (
        <div className="space-y-5">
          <div className={sectionCls}>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">SEO Basics</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input value={form.seo_site_title} onChange={e => setField('seo_site_title', e.target.value)} className={inputCls} placeholder="Site Title" />
              <input value={form.seo_keywords} onChange={e => setField('seo_keywords', e.target.value)} className={inputCls} placeholder="Keywords (comma separated)" />
              <textarea value={form.seo_meta_description} onChange={e => setField('seo_meta_description', e.target.value)} rows={3}
                className="w-full p-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all resize-none md:col-span-2"
                placeholder="Meta description" />
              <input value={form.google_analytics_id} onChange={e => setField('google_analytics_id', e.target.value)} className={inputCls} placeholder="GA Measurement ID (G-XXXXXXXXXX)" />
              <input value={form.google_search_console_id} onChange={e => setField('google_search_console_id', e.target.value)} className={inputCls} placeholder="Search Console Verification" />
            </div>
          </div>
          <div className={sectionCls}>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Custom Scripts</p>
            <textarea className="w-full p-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all resize-none" rows={4} value={form.custom_head_scripts} onChange={e => setField('custom_head_scripts', e.target.value)} placeholder="Scripts for <head>" />
            <textarea className="w-full p-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all resize-none mt-4" rows={4} value={form.custom_body_scripts} onChange={e => setField('custom_body_scripts', e.target.value)} placeholder="Scripts before </body>" />
          </div>
        </div>
      )}

      {/* Integrations Tab */}
      {activeTab === 'Integrations' && (
        <div className="space-y-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Third-Party Integrations</p>
          <div className="space-y-4">
            {form.integrations.map((integration, i) => (
              <div key={integration.key} className="border border-gray-200 rounded-xl p-4 space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={integration.enabled} onChange={(e) => setIntegration(i, 'enabled', e.target.checked)} className="w-5 h-5 rounded border-gray-300" />
                  <div className="flex flex-col">
                    <span className="font-semibold text-gray-700">{integration.name}</span>
                    {integration.requiresModules && integration.requiresModules.length > 0 && (
                      <span className="text-xs text-gray-400">Requires: {integration.requiresModules.join(', ')}</span>
                    )}
                  </div>
                </label>
                
                {integration.enabled && (
                  <div className="pl-8 space-y-3 border-t border-gray-100 pt-3">
                    {integration.key === 'google_analytics' && (
                      <div>
                        <label className={labelCls}>Measurement ID</label>
                        <input type="text" placeholder="G-XXXXXXXXXX" className={inputCls}
                          value={(integration.config?.measurement_id as string) || ''} 
                          onChange={(e) => setIntegration(i, 'config', { ...integration.config, measurement_id: e.target.value })} />
                        <p className="text-xs text-gray-400 mt-1">Found in Google Analytics → Admin → Property Settings</p>
                      </div>
                    )}
                    
                    {integration.key === 'google_search_console' && (
                      <div>
                        <label className={labelCls}>Verification Code</label>
                        <input type="text" placeholder="abc123xyz..." className={inputCls}
                          value={(integration.config?.verification_code as string) || ''} 
                          onChange={(e) => setIntegration(i, 'config', { ...integration.config, verification_code: e.target.value })} />
                        <p className="text-xs text-gray-400 mt-1">HTML tag from Google Search Console</p>
                      </div>
                    )}
                    
                    {integration.key === 'mailchimp' && (
                      <div>
                        <label className={labelCls}>API Key</label>
                        <input type="password" placeholder="Enter Mailchimp API key" className={inputCls}
                          value={(integration.config?.api_key as string) || ''} 
                          onChange={(e) => setIntegration(i, 'config', { ...integration.config, api_key: e.target.value })} />
                        <p className="text-xs text-gray-400 mt-1">Found in Mailchimp Account → Extras → API Keys</p>
                      </div>
                    )}
                    
                    {integration.key === 'zapier' && (
                      <div>
                        <label className={labelCls}>Zapier Webhook URL</label>
                        <input type="text" placeholder="https://hooks.zapier.com/..." className={inputCls}
                          value={(integration.config?.webhook_url as string) || ''} 
                          onChange={(e) => setIntegration(i, 'config', { ...integration.config, webhook_url: e.target.value })} />
                        <p className="text-xs text-gray-400 mt-1">Webhook URL from your Zapier Zap</p>
                      </div>
                    )}
                    
                    {integration.key === 'slack' && (
                      <div>
                        <label className={labelCls}>Slack Webhook URL</label>
                        <input type="password" placeholder="https://hooks.slack.com/services/..." className={inputCls}
                          value={(integration.config?.webhook_url as string) || ''} 
                          onChange={(e) => setIntegration(i, 'config', { ...integration.config, webhook_url: e.target.value })} />
                        <p className="text-xs text-gray-400 mt-1">Create incoming webhook in Slack workspace</p>
                      </div>
                    )}
                    
                    {integration.key === 'meta_pixel' && (
                      <div>
                        <label className={labelCls}>Pixel ID</label>
                        <input type="text" placeholder="123456789..." className={inputCls}
                          value={(integration.config?.pixel_id as string) || ''} 
                          onChange={(e) => setIntegration(i, 'config', { ...integration.config, pixel_id: e.target.value })} />
                        <p className="text-xs text-gray-400 mt-1">Found in Meta Business Suite → Events Manager</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Users & Team Tab */}
      {activeTab === 'Users & Team' && (
        <div className="space-y-8">
          <div className="flex items-start justify-between gap-4 rounded-2xl border border-gray-200 bg-gradient-to-r from-slate-50 to-white p-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">WordPress users</p>
              <h3 className="mt-1 text-lg font-semibold text-gray-900">Manage roles, access, and account status</h3>
              <p className="mt-1 text-sm text-gray-500">Owner / Super Admin stays locked. Roles follow the native WordPress account model.</p>
            </div>
            <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
              Clean backend view
            </span>
          </div>

          {/* Create New Admin User Section */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Create New Admin User</h3>
                <p className="text-sm text-gray-500">Create a WordPress account with the correct role from the start.</p>
              </div>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">Owner protected</span>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <input className={inputCls} placeholder="Username" value={form.team_members[0]?.name || ''} onChange={(e) => {
                if (form.team_members.length === 0) addTeamMember();
                setTeamMember(0, 'name', e.target.value);
              }} />
              <input className={inputCls} placeholder="Display Name" value={form.team_members[0]?.role || ''} onChange={(e) => {
                if (form.team_members.length === 0) addTeamMember();
                setTeamMember(0, 'role', e.target.value);
              }} />
              <input type="email" className={inputCls} placeholder="Email" value={form.team_members[0]?.email || ''} onChange={(e) => {
                if (form.team_members.length === 0) addTeamMember();
                setTeamMember(0, 'email', e.target.value);
              }} />
              <input type="password" className={inputCls} placeholder="Temporary Password" value={form.team_members[0]?.phone || ''} onChange={(e) => {
                if (form.team_members.length === 0) addTeamMember();
                setTeamMember(0, 'phone', e.target.value);
              }} />
            </div>

            <div className="grid gap-4 md:grid-cols-[1fr_220px] md:items-end">
              <div>
                <label className={labelCls}>Role</label>
                <select className={inputCls} defaultValue="administrator">
                  {WORDPRESS_ROLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value} disabled={option.locked}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-400">Choose the WordPress role that matches the level of access required.</p>
              </div>
              <button type="button" className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-700 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-sky-800">
                <Plus size={16} /> Create User
              </button>
            </div>
          </div>

          {/* Existing WordPress Users Section */}
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-gray-100 bg-gray-50/80 p-5 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Existing WordPress Users</h3>
                <p className="text-sm text-gray-500">Review accounts, change roles, and reset credentials.</p>
              </div>
              <div className="flex items-center gap-2">
                <select className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm">
                <option>All Roles</option>
                {WORDPRESS_ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-white border-b border-gray-100">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Name</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Email</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Role</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {form.wordpress_users && form.wordpress_users.length > 0 ? (
                    form.wordpress_users.map((user, i) => (
                      <tr key={i} className="border-b border-gray-100 hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-4 font-medium text-gray-900">
                          <div className="flex flex-col">
                            <span>{user.display_name}</span>
                            <span className="text-xs text-gray-400">{user.username}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-gray-600">{user.email}</td>
                        <td className="px-5 py-4">
                          <select
                            value={user.role}
                            onChange={(event) => setWordPressUserRole(i, event.target.value)}
                            className="h-9 rounded-lg border border-gray-200 bg-white px-2.5 text-sm disabled:bg-gray-100"
                            disabled={user.role === 'owner'}
                          >
                                {WORDPRESS_ROLE_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value} disabled={option.locked}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${user.active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-700'}`}>
                            {user.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <button className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-100">
                            Reset Password
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-500 text-sm">
                        No users selected. Showing 0 user(s).
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modules Tab */}
      {activeTab === 'Modules' && (
        <div className="space-y-5">
          <div className={sectionCls}>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Module Preferences</p>
            <p className="text-xs text-gray-500 mb-4">Premium modules require activation and payment.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {form.module_preferences.map((module, index) => (
                <label key={module.key} className="flex items-center justify-between border border-gray-200 rounded-xl px-4 py-3 cursor-pointer hover:bg-gray-50">
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-gray-700">{module.label}</span>
                    {module.requiresPayment && <span className="text-xs text-amber-600">Premium</span>}
                  </div>
                  <input type="checkbox" checked={module.enabled} onChange={() => toggleModule(index)} disabled={module.requiresPayment && !module.enabled} className="w-5 h-5 rounded border-gray-300" />
                </label>
              ))}
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
