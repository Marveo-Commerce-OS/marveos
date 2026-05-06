'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, AlertCircle, Save, Plus, FileSpreadsheet, FileText, Trash2, Power } from 'lucide-react';

type Portal = 'b2c' | 'b2b';

type ManagedUser = {
  id: number;
  name: string;
  username: string;
  email: string;
  roles: string[];
  active: boolean;
  portals: Portal[];
};

type FormRule = {
  formKey: string;
  formName: string;
  fromEmail: string;
  senderName: string;
  recipients: string[];
};

type AdminModuleKey =
  | 'dashboard'
  | 'products'
  | 'orders'
  | 'reports'
  | 'customers'
  | 'blog'
  | 'stores'
  | 'siteSettings'
  | 'adminSettings';

type SettingsPayload = {
  tracking: {
    ecommerceDomain: string;
    googleAnalyticsId: string;
    googleTagManagerId: string;
    googleSearchConsoleVerification: string;
    metaPixelId: string;
    tiktokPixelId: string;
    customHeadScripts: string;
    customBodyScripts: string;
    customFooterScripts: string;
  };
  smtp: {
    provider: 'microsoft365';
    host: string;
    port: number;
    secure: boolean;
    username: string;
    password: string;
    fromEmail: string;
    fromName: string;
  };
  forms: FormRule[];
  accessControl: {
    roleModuleVisibility: Record<string, Partial<Record<AdminModuleKey, boolean>>>;
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
  { key: 'siteSettings', label: 'Site Settings' },
  { key: 'adminSettings', label: 'Admin Settings' },
];

type AuditLog = {
  id: string;
  at: string;
  actorEmail: string;
  action: string;
  target: string;
  details?: string;
};

type TestEmailStatus = 'idle' | 'sending' | 'sent' | 'failed';

type MaintenanceSettings = {
  site_under_construction: boolean;
  under_construction_title: string;
  under_construction_message: string;
};

const inputCls = 'w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500';
const areaCls = 'w-full min-h-24 p-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500';

export default function AdminSettingsClient() {
  const [activeTab, setActiveTab] = useState<'users' | 'access' | 'launch' | 'tracking' | 'smtp' | 'forms' | 'audit'>('users');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingMaintenance, setSavingMaintenance] = useState(false);
  const [creating, setCreating] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [auditActionLoading, setAuditActionLoading] = useState<'pdf' | 'excel' | 'clear' | null>(null);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [maintenance, setMaintenance] = useState<MaintenanceSettings>({
    site_under_construction: false,
    under_construction_title: 'We are coming back soon',
    under_construction_message: 'We are currently making improvements to serve you better. Please check back shortly.',
  });
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [testEmail, setTestEmail] = useState('');
  const [testEmailStatus, setTestEmailStatus] = useState<TestEmailStatus>('idle');
  const [testEmailMessage, setTestEmailMessage] = useState('');

  const [newUser, setNewUser] = useState({
    username: '',
    name: '',
    email: '',
    password: '',
    role: 'shop_manager',
    portals: ['b2c'] as Portal[],
  });

  const tabs = useMemo(
    () => [
      { key: 'users', label: 'User Access' },
      { key: 'access', label: 'Backend Access' },
      { key: 'launch', label: 'Launch Control' },
      { key: 'tracking', label: 'Ecommerce Scripts' },
      { key: 'smtp', label: 'SMTP (Microsoft 365)' },
      { key: 'forms', label: 'Forms Routing' },
      { key: 'audit', label: 'Audit Trail' },
    ],
    [],
  );

  const filteredUsers = useMemo(() => {
    if (roleFilter === 'all') return users;
    return users.filter((user) => (user.roles[0] ?? 'customer') === roleFilter);
  }, [users, roleFilter]);

  const allVisibleUsersSelected = useMemo(
    () => filteredUsers.length > 0 && filteredUsers.every((user) => selectedUserIds.includes(user.id)),
    [filteredUsers, selectedUserIds],
  );

  const selectedVisibleCount = useMemo(
    () => filteredUsers.filter((user) => selectedUserIds.includes(user.id)).length,
    [filteredUsers, selectedUserIds],
  );

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [usersRes, settingsRes, auditRes, siteSettingsRes] = await Promise.all([
        fetch('/api/admin/users', { cache: 'no-store' }),
        fetch('/api/admin/settings', { cache: 'no-store' }),
        fetch('/api/admin/audit', { cache: 'no-store' }),
        fetch('/api/settings', { cache: 'no-store' }),
      ]);

      const usersJson = usersRes.ok ? await usersRes.json() : { users: [], roles: [] };
      const settingsJson = settingsRes.ok ? await settingsRes.json() : null;
      const auditJson = auditRes.ok ? await auditRes.json() : { logs: [] };
      const siteJson = siteSettingsRes.ok ? await siteSettingsRes.json() : null;

      setUsers(usersJson.users ?? []);
      setSelectedUserIds([]);
      setRoles(usersJson.roles ?? []);
      setSettings(settingsJson
        ? {
            ...settingsJson,
            accessControl: {
              roleModuleVisibility: settingsJson.accessControl?.roleModuleVisibility ?? {},
            },
          }
        : null);
      setAuditLogs(auditJson.logs ?? []);
      if (siteJson) {
        setMaintenance({
          site_under_construction: siteJson.site_under_construction ?? false,
          under_construction_title: siteJson.under_construction_title ?? 'We are coming back soon',
          under_construction_message: siteJson.under_construction_message ?? 'We are currently making improvements to serve you better. Please check back shortly.',
        });
      }
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings() {
    if (!settings) return;
    setSaving(true);
    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    setSaving(false);
    setStatus(res.ok ? 'success' : 'error');
    setTimeout(() => setStatus('idle'), 2200);
    if (res.ok) {
      await loadData();
    }
  }

  async function saveMaintenance() {
    setSavingMaintenance(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(maintenance),
      });
      setSavingMaintenance(false);
      setStatus(res.ok ? 'success' : 'error');
      setTimeout(() => setStatus('idle'), 2200);
      if (res.ok) {
        await loadData();
      }
    } catch (err) {
      console.error('Save maintenance failed:', err);
      setSavingMaintenance(false);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 2200);
    }
  }

  async function sendTestEmail() {
    if (!testEmail.trim()) {
      setTestEmailStatus('failed');
      setTestEmailMessage('Enter a recipient email first.');
      return;
    }

    setTestEmailStatus('sending');
    setTestEmailMessage('');

    const res = await fetch('/api/admin/smtp-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: testEmail.trim() }),
    });

    const data = await res.json().catch(() => ({ error: 'SMTP test failed.' }));
    setTestEmailStatus(res.ok ? 'sent' : 'failed');
    setTestEmailMessage(res.ok ? (data.message ?? 'Test email sent successfully.') : (data.error ?? 'SMTP test failed.'));
  }

  async function createUser() {
    setCreating(true);
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newUser),
    });
    setCreating(false);
    setStatus(res.ok ? 'success' : 'error');
    setTimeout(() => setStatus('idle'), 2200);
    if (res.ok) {
      setNewUser({ username: '', name: '', email: '', password: '', role: 'shop_manager', portals: ['b2c'] });
      await loadData();
    }
  }

  async function updateUser(user: ManagedUser, updates: Partial<ManagedUser> & { role?: string }) {
    const res = await fetch('/api/admin/users', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        role: updates.role,
        active: typeof updates.active === 'boolean' ? updates.active : user.active,
        portals: updates.portals ?? user.portals,
      }),
    });
    setStatus(res.ok ? 'success' : 'error');
    setTimeout(() => setStatus('idle'), 2200);
    if (res.ok) {
      setUsers((prev) => prev.map((existing) => {
        if (existing.id !== user.id) return existing;
        return {
          ...existing,
          active: typeof updates.active === 'boolean' ? updates.active : existing.active,
          portals: updates.portals ?? existing.portals,
          roles: updates.role ? [updates.role] : existing.roles,
        };
      }));
    }
  }

  function toggleSelectUser(userId: number) {
    setSelectedUserIds((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));
  }

  function toggleSelectAllUsers() {
    setSelectedUserIds((prev) => {
      const visibleIds = filteredUsers.map((user) => user.id);
      if (visibleIds.length === 0) return prev;

      if (allVisibleUsersSelected) {
        return prev.filter((id) => !visibleIds.includes(id));
      }

      return Array.from(new Set([...prev, ...visibleIds]));
    });
  }

  async function runBulkAccessUpdate(active: boolean) {
    if (selectedUserIds.length === 0) return;
    setBulkLoading(true);
    const res = await fetch('/api/admin/users', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userIds: selectedUserIds, active }),
    });
    setBulkLoading(false);
    setStatus(res.ok ? 'success' : 'error');
    setTimeout(() => setStatus('idle'), 2200);
    if (res.ok) {
      const updated = await res.json().catch(() => ({ updated: [] as Array<{ userId: number; active: boolean; portals: Portal[] }> }));
      const updatesById = new Map<number, { active: boolean; portals: Portal[] }>(
        (updated.updated ?? []).map((item: { userId: number; active: boolean; portals: Portal[] }) => [item.userId, { active: item.active, portals: item.portals }]),
      );
      setUsers((prev) => prev.map((user) => {
        const next = updatesById.get(user.id);
        if (!next) return user;
        return { ...user, active: next.active, portals: next.portals };
      }));
    }
  }

  async function runBulkPortalUpdate(portals: Portal[]) {
    if (selectedUserIds.length === 0) return;
    setBulkLoading(true);
    const res = await fetch('/api/admin/users', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userIds: selectedUserIds, portals }),
    });
    setBulkLoading(false);
    setStatus(res.ok ? 'success' : 'error');
    setTimeout(() => setStatus('idle'), 2200);
    if (res.ok) {
      const updated = await res.json().catch(() => ({ updated: [] as Array<{ userId: number; active: boolean; portals: Portal[] }> }));
      const updatesById = new Map<number, { active: boolean; portals: Portal[] }>(
        (updated.updated ?? []).map((item: { userId: number; active: boolean; portals: Portal[] }) => [item.userId, { active: item.active, portals: item.portals }]),
      );
      setUsers((prev) => prev.map((user) => {
        const next = updatesById.get(user.id);
        if (!next) return user;
        return { ...user, active: next.active, portals: next.portals };
      }));
    }
  }

  async function downloadAudit(format: 'pdf' | 'excel') {
    setAuditActionLoading(format);
    const res = await fetch(`/api/admin/audit/export?format=${format}`);
    setAuditActionLoading(null);
    if (!res.ok) {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 2200);
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `audit-backup-${Date.now()}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  async function clearAuditLogs() {
    if (!confirm('Clear all audit logs? This action cannot be undone.')) return;
    setAuditActionLoading('clear');
    const res = await fetch('/api/admin/audit', { method: 'DELETE' });
    setAuditActionLoading(null);
    setStatus(res.ok ? 'success' : 'error');
    setTimeout(() => setStatus('idle'), 2200);
    if (res.ok) {
      await loadData();
    }
  }

  function togglePortal(list: Portal[], portal: Portal) {
    return list.includes(portal) ? list.filter((p) => p !== portal) : [...list, portal];
  }

  function toggleRoleModule(role: string, moduleKey: AdminModuleKey) {
    setSettings((prev) => {
      if (!prev) return prev;
      const currentForRole = prev.accessControl.roleModuleVisibility[role] ?? {};
      return {
        ...prev,
        accessControl: {
          ...prev.accessControl,
          roleModuleVisibility: {
            ...prev.accessControl.roleModuleVisibility,
            [role]: {
              ...currentForRole,
              [moduleKey]: !Boolean(currentForRole[moduleKey]),
            },
          },
        },
      };
    });
  }

  if (loading || !settings) {
    return <div className="bg-white rounded-2xl border border-gray-100 p-8 text-sm text-gray-500">Loading admin settings...</div>;
  }

  return (
    <div className="space-y-5">
      {status === 'success' && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-100 rounded-xl text-green-700 text-sm">
          <CheckCircle2 size={16} /> Changes saved successfully.
        </div>
      )}
      {status === 'error' && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">
          <AlertCircle size={16} /> Something failed. Please retry.
        </div>
      )}

      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px ${
              activeTab === tab.key ? 'border-sky-700 text-sky-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 md:p-6 space-y-5">
        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="space-y-3">
              <h2 className="text-base font-semibold text-gray-900">Create New Admin User</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input className={inputCls} placeholder="Username" value={newUser.username} onChange={(e) => setNewUser((p) => ({ ...p, username: e.target.value }))} />
                <input className={inputCls} placeholder="Display Name" value={newUser.name} onChange={(e) => setNewUser((p) => ({ ...p, name: e.target.value }))} />
                <input className={inputCls} placeholder="Email" type="email" value={newUser.email} onChange={(e) => setNewUser((p) => ({ ...p, email: e.target.value }))} />
                <input className={inputCls} placeholder="Temporary Password" value={newUser.password} onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))} />
                <select className={inputCls} value={newUser.role} onChange={(e) => setNewUser((p) => ({ ...p, role: e.target.value }))}>
                  {roles.map((role) => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
                <div className="flex items-center gap-3 text-sm text-gray-700">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={newUser.portals.includes('b2c')} onChange={() => setNewUser((p) => ({ ...p, portals: togglePortal(p.portals, 'b2c') }))} /> B2C</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={newUser.portals.includes('b2b')} onChange={() => setNewUser((p) => ({ ...p, portals: togglePortal(p.portals, 'b2b') }))} /> B2B</label>
                </div>
              </div>
              <button type="button" onClick={createUser} disabled={creating} className="inline-flex items-center gap-2 px-4 py-2 bg-sky-700 text-white rounded-lg text-sm font-medium hover:bg-sky-800 disabled:opacity-60">
                <Plus size={14} /> {creating ? 'Creating...' : 'Create User'}
              </button>
            </div>

            <div className="pt-4 border-t border-gray-100">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
                <h3 className="text-base font-semibold text-gray-900">Existing WordPress Users</h3>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Role:</span>
                    <select
                      className="h-9 px-2 rounded-lg border border-gray-200 text-xs text-gray-700 bg-white"
                      value={roleFilter}
                      onChange={(e) => setRoleFilter(e.target.value)}
                    >
                      <option value="all">All Roles</option>
                      {roles.map((role) => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => runBulkAccessUpdate(true)}
                    disabled={bulkLoading || selectedUserIds.length === 0}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-green-200 text-green-700 bg-green-50 hover:bg-green-100 disabled:opacity-50"
                  >
                    Activate Selected
                  </button>
                  <button
                    type="button"
                    onClick={() => runBulkAccessUpdate(false)}
                    disabled={bulkLoading || selectedUserIds.length === 0}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-50"
                  >
                    Deactivate Selected
                  </button>
                  <button
                    type="button"
                    onClick={() => runBulkPortalUpdate(['b2c'])}
                    disabled={bulkLoading || selectedUserIds.length === 0}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    B2C Only
                  </button>
                  <button
                    type="button"
                    onClick={() => runBulkPortalUpdate(['b2b'])}
                    disabled={bulkLoading || selectedUserIds.length === 0}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    B2B Only
                  </button>
                  <button
                    type="button"
                    onClick={() => runBulkPortalUpdate(['b2c', 'b2b'])}
                    disabled={bulkLoading || selectedUserIds.length === 0}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Both Portals
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-500 mb-3">
                {selectedUserIds.length === 0
                  ? `No users selected. Showing ${filteredUsers.length} user(s).`
                  : `${selectedVisibleCount} selected in view (${selectedUserIds.length} total selected).`}
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        <input
                          type="checkbox"
                          checked={allVisibleUsersSelected}
                          onChange={toggleSelectAllUsers}
                          aria-label="Select all users"
                        />
                      </th>
                      {['Name', 'Email', 'Role', 'Portal Access', 'Active', 'Actions'].map((h) => (
                        <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-3 py-6 text-center text-gray-400">No users found for the selected role filter.</td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => (
                        <tr key={u.id}>
                          <td className="px-3 py-3">
                            <input
                              type="checkbox"
                              checked={selectedUserIds.includes(u.id)}
                              onChange={() => toggleSelectUser(u.id)}
                            />
                          </td>
                          <td className="px-3 py-3 text-gray-900 font-medium">{u.name || u.username}</td>
                          <td className="px-3 py-3 text-gray-600">{u.email}</td>
                          <td className="px-3 py-3">
                            <select className="h-9 px-2 rounded border border-gray-200 text-sm" value={u.roles[0] ?? 'customer'} onChange={(e) => updateUser(u, { role: e.target.value })}>
                              {roles.map((role) => (
                                <option key={role} value={role}>{role}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-3 text-xs">
                              <label className="flex items-center gap-1.5"><input type="checkbox" checked={u.portals.includes('b2c')} onChange={() => updateUser(u, { portals: togglePortal(u.portals, 'b2c') })} />B2C</label>
                              <label className="flex items-center gap-1.5"><input type="checkbox" checked={u.portals.includes('b2b')} onChange={() => updateUser(u, { portals: togglePortal(u.portals, 'b2b') })} />B2B</label>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <button
                              type="button"
                              onClick={() => updateUser(u, { active: !u.active })}
                              className={`px-2.5 py-1 rounded text-xs font-medium ${u.active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}
                            >
                              {u.active ? 'Active' : 'Deactivated'}
                            </button>
                          </td>
                          <td className="px-3 py-3 text-xs text-gray-500">WP privileges follow assigned role.</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'access' && (
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-gray-900">Backend Module Visibility By Role</h2>
            <p className="text-xs text-gray-500">Control what each WordPress role can see in the admin menu. Administrators should normally keep full access.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</th>
                    {MODULE_LABELS.map((module) => (
                      <th key={module.key} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{module.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {roles.length === 0 ? (
                    <tr><td colSpan={MODULE_LABELS.length + 1} className="px-3 py-6 text-center text-gray-400">No roles available.</td></tr>
                  ) : roles.map((role) => (
                    <tr key={role}>
                      <td className="px-3 py-2 font-medium text-gray-900">{role}</td>
                      {MODULE_LABELS.map((module) => {
                        const checked = Boolean(settings.accessControl.roleModuleVisibility[role]?.[module.key]);
                        return (
                          <td key={`${role}-${module.key}`} className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleRoleModule(role, module.key)}
                              disabled={role === 'administrator'}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'launch' && (
          <div className="space-y-5">
            <div className="flex items-center gap-2">
              <Power size={16} className="text-sky-700" />
              <h2 className="text-base font-semibold text-gray-900">B2C Storefront Launch Control</h2>
            </div>
            <p className="text-xs text-gray-500">Toggle the under-construction mode to temporarily hide the B2C storefront from the public while you make changes.</p>

            <div className="rounded-xl border border-gray-200 p-4 bg-gray-50 space-y-3">
              <label className="flex items-center gap-3 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={maintenance.site_under_construction}
                  onChange={(e) => setMaintenance((p) => ({ ...p, site_under_construction: e.target.checked }))}
                  className="w-4 h-4 accent-sky-700"
                />
                <span className="font-medium">Enable Under Construction Mode</span>
              </label>
              <p className="text-xs text-gray-500 pl-7">When enabled, visitors to the B2C site will see the coming soon page instead of the storefront.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-gray-700">Coming Soon Title</label>
              <input
                className={inputCls}
                value={maintenance.under_construction_title}
                onChange={(e) => setMaintenance((p) => ({ ...p, under_construction_title: e.target.value }))}
                placeholder="We are coming back soon"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-gray-700">Coming Soon Message</label>
              <textarea
                className={areaCls}
                rows={4}
                value={maintenance.under_construction_message}
                onChange={(e) => setMaintenance((p) => ({ ...p, under_construction_message: e.target.value }))}
                placeholder="We are currently making improvements to serve you better."
              />
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={saveMaintenance}
                disabled={savingMaintenance}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-sky-700 text-white rounded-xl text-sm font-semibold hover:bg-sky-800 disabled:opacity-60"
              >
                <Save size={15} /> {savingMaintenance ? 'Saving...' : 'Save Launch Control'}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'tracking' && (
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-gray-900">Ecommerce Domain Script Settings</h2>
            <p className="text-xs text-gray-500">These values are for ecommerce domain integration only (e.g. shop.prag.global), not the admin domain.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input className={inputCls} value={settings.tracking.ecommerceDomain} onChange={(e) => setSettings((p) => p ? { ...p, tracking: { ...p.tracking, ecommerceDomain: e.target.value } } : p)} placeholder="shop.prag.global" />
              <input className={inputCls} value={settings.tracking.googleAnalyticsId} onChange={(e) => setSettings((p) => p ? { ...p, tracking: { ...p.tracking, googleAnalyticsId: e.target.value } } : p)} placeholder="GA4 Measurement ID" />
              <input className={inputCls} value={settings.tracking.googleTagManagerId} onChange={(e) => setSettings((p) => p ? { ...p, tracking: { ...p.tracking, googleTagManagerId: e.target.value } } : p)} placeholder="Google Tag Manager ID" />
              <input className={inputCls} value={settings.tracking.googleSearchConsoleVerification} onChange={(e) => setSettings((p) => p ? { ...p, tracking: { ...p.tracking, googleSearchConsoleVerification: e.target.value } } : p)} placeholder="Search Console verification token" />
              <input className={inputCls} value={settings.tracking.metaPixelId} onChange={(e) => setSettings((p) => p ? { ...p, tracking: { ...p.tracking, metaPixelId: e.target.value } } : p)} placeholder="Meta Pixel ID" />
              <input className={inputCls} value={settings.tracking.tiktokPixelId} onChange={(e) => setSettings((p) => p ? { ...p, tracking: { ...p.tracking, tiktokPixelId: e.target.value } } : p)} placeholder="TikTok Pixel ID" />
            </div>
            <textarea className={areaCls} value={settings.tracking.customHeadScripts} onChange={(e) => setSettings((p) => p ? { ...p, tracking: { ...p.tracking, customHeadScripts: e.target.value } } : p)} placeholder="Custom scripts for <head>" />
            <textarea className={areaCls} value={settings.tracking.customBodyScripts} onChange={(e) => setSettings((p) => p ? { ...p, tracking: { ...p.tracking, customBodyScripts: e.target.value } } : p)} placeholder="Custom scripts after opening <body>" />
            <textarea className={areaCls} value={settings.tracking.customFooterScripts} onChange={(e) => setSettings((p) => p ? { ...p, tracking: { ...p.tracking, customFooterScripts: e.target.value } } : p)} placeholder="Custom scripts before </body>" />
          </div>
        )}

        {activeTab === 'smtp' && (
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-gray-900">Microsoft 365 SMTP</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input className={inputCls} value={settings.smtp.host} onChange={(e) => setSettings((p) => p ? { ...p, smtp: { ...p.smtp, host: e.target.value } } : p)} placeholder="smtp.office365.com" />
              <input className={inputCls} value={settings.smtp.port} onChange={(e) => setSettings((p) => p ? { ...p, smtp: { ...p.smtp, port: Number(e.target.value) || 587 } } : p)} placeholder="587" />
              <input className={inputCls} value={settings.smtp.username} onChange={(e) => setSettings((p) => p ? { ...p, smtp: { ...p.smtp, username: e.target.value } } : p)} placeholder="SMTP Username" />
              <input className={inputCls} type="password" value={settings.smtp.password} onChange={(e) => setSettings((p) => p ? { ...p, smtp: { ...p.smtp, password: e.target.value } } : p)} placeholder="SMTP Password" />
              <input className={inputCls} value={settings.smtp.fromEmail} onChange={(e) => setSettings((p) => p ? { ...p, smtp: { ...p.smtp, fromEmail: e.target.value } } : p)} placeholder="From Email" />
              <input className={inputCls} value={settings.smtp.fromName} onChange={(e) => setSettings((p) => p ? { ...p, smtp: { ...p.smtp, fromName: e.target.value } } : p)} placeholder="Sender Name" />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={settings.smtp.secure} onChange={(e) => setSettings((p) => p ? { ...p, smtp: { ...p.smtp, secure: e.target.checked } } : p)} /> Use secure TLS
            </label>
            <div className="pt-4 border-t border-gray-100 space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Test Email Deliverability</h3>
                <p className="text-xs text-gray-500 mt-1">Save the SMTP settings first, then send a test message to confirm delivery.</p>
              </div>
              <div className="flex flex-col md:flex-row gap-3">
                <input
                  className={inputCls}
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="recipient@example.com"
                />
                <button
                  type="button"
                  onClick={sendTestEmail}
                  disabled={testEmailStatus === 'sending'}
                  className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-black disabled:opacity-60"
                >
                  {testEmailStatus === 'sending' ? 'Sending...' : 'Send Test Email'}
                </button>
              </div>
              {testEmailMessage && (
                <p className={`text-sm ${testEmailStatus === 'sent' ? 'text-green-700' : 'text-red-600'}`}>{testEmailMessage}</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'forms' && (
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-gray-900">Forms Delivery Routing</h2>
            <p className="text-xs text-gray-500">Configure sender and recipients per form to deliver each form to separate mailbox lists.</p>
            {settings.forms.map((rule, idx) => (
              <div key={rule.formKey} className="p-4 border border-gray-200 rounded-xl space-y-3">
                <p className="text-sm font-semibold text-gray-900">{rule.formName}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input className={inputCls} value={rule.fromEmail} onChange={(e) => setSettings((p) => {
                    if (!p) return p;
                    const forms = [...p.forms];
                    forms[idx] = { ...forms[idx], fromEmail: e.target.value };
                    return { ...p, forms };
                  })} placeholder="From Email" />
                  <input className={inputCls} value={rule.senderName} onChange={(e) => setSettings((p) => {
                    if (!p) return p;
                    const forms = [...p.forms];
                    forms[idx] = { ...forms[idx], senderName: e.target.value };
                    return { ...p, forms };
                  })} placeholder="Sender Name" />
                </div>
                <textarea className={areaCls} value={rule.recipients.join(', ')} onChange={(e) => setSettings((p) => {
                  if (!p) return p;
                  const forms = [...p.forms];
                  forms[idx] = { ...forms[idx], recipients: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) };
                  return { ...p, forms };
                })} placeholder="Recipients separated by comma" />
              </div>
            ))}
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="space-y-3">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <h2 className="text-base font-semibold text-gray-900">Audit Trail</h2>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => downloadAudit('pdf')}
                  disabled={auditActionLoading !== null}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  <FileText size={13} /> {auditActionLoading === 'pdf' ? 'Exporting...' : 'Backup PDF'}
                </button>
                <button
                  type="button"
                  onClick={() => downloadAudit('excel')}
                  disabled={auditActionLoading !== null}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  <FileSpreadsheet size={13} /> {auditActionLoading === 'excel' ? 'Exporting...' : 'Backup Excel'}
                </button>
                <button
                  type="button"
                  onClick={clearAuditLogs}
                  disabled={auditActionLoading !== null}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-50"
                >
                  <Trash2 size={13} /> {auditActionLoading === 'clear' ? 'Clearing...' : 'Clear Logs'}
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Date', 'Actor', 'Action', 'Target', 'Details'].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {auditLogs.length === 0 ? (
                    <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-400">No audit records yet.</td></tr>
                  ) : auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="px-3 py-2 text-gray-600 text-xs">{new Date(log.at).toLocaleString('en-GB')}</td>
                      <td className="px-3 py-2 text-gray-900">{log.actorEmail}</td>
                      <td className="px-3 py-2 text-gray-700">{log.action}</td>
                      <td className="px-3 py-2 text-gray-700">{log.target}</td>
                      <td className="px-3 py-2 text-gray-500">{log.details || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {activeTab !== 'audit' && activeTab !== 'launch' && (
        <div className="flex justify-end">
          <button type="button" onClick={saveSettings} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2.5 bg-sky-700 text-white rounded-xl text-sm font-semibold hover:bg-sky-800 disabled:opacity-60">
            <Save size={15} /> {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )}
    </div>
  );
}

