'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { labelForControlCenterModule, labelForMasterRole } from '@/lib/master/roleDashboard';
import type { ControlCenterModuleKey } from '@/lib/adminStore';
import type { MasterPermissionAction } from '@/lib/master/permissions';

type AccessControlResponse = {
  roles: string[];
  modules: ControlCenterModuleKey[];
  actions: MasterPermissionAction[];
  roleModuleVisibility: Record<string, Record<ControlCenterModuleKey, boolean>>;
  roleActionPermissions: Record<
    string,
    Record<ControlCenterModuleKey, Record<MasterPermissionAction, boolean>>
  >;
  ok?: boolean;
  error?: string;
};

export default function RolePrivilegesClient() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [payload, setPayload] = useState<AccessControlResponse | null>(null);
  const [newRoleKey, setNewRoleKey] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const res = await fetch('/api/master/access-control', { cache: 'no-store' });
        const body = (await res.json().catch(() => null)) as AccessControlResponse | null;
        if (!res.ok || !body) {
          throw new Error(body?.error || 'Failed to load role privileges matrix.');
        }
        if (!cancelled) setPayload(body);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load role privileges matrix.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const sortedModules = useMemo(() => {
    if (!payload) return [] as ControlCenterModuleKey[];
    return [...payload.modules].sort((a, b) => labelForControlCenterModule(a).localeCompare(labelForControlCenterModule(b)));
  }, [payload]);

  const sortedActions = useMemo(() => {
    if (!payload) return [] as MasterPermissionAction[];
    const preferred: MasterPermissionAction[] = ['view', 'create', 'update', 'assign', 'approve', 'export', 'delete'];
    return preferred.filter((action) => payload.actions.includes(action));
  }, [payload]);

  const sortedRoles = useMemo(() => {
    if (!payload) return [] as string[];
    const priority = ['SUPER_ADMIN', 'ADMIN', 'CUSTOMER_SUPPORT', 'TECHNICAL_SUPPORT', 'DEPLOYMENT_MANAGER', 'BILLING_MANAGER'];
    const preferred = priority.filter((role) => payload.roles.includes(role));
    const rest = payload.roles.filter((role) => !priority.includes(role));
    return [...preferred, ...rest];
  }, [payload]);

  function setActionPermission(
    role: string,
    moduleKey: ControlCenterModuleKey,
    action: MasterPermissionAction,
    enabled: boolean,
  ) {
    setPayload((prev) => {
      if (!prev) return prev;

      const nextActionMap = {
        ...prev.roleActionPermissions,
        [role]: {
          ...prev.roleActionPermissions[role],
          [moduleKey]: {
            ...prev.roleActionPermissions[role][moduleKey],
            [action]: enabled,
          },
        },
      };

      const nextModuleVisibility = {
        ...prev.roleModuleVisibility,
        [role]: {
          ...prev.roleModuleVisibility[role],
          [moduleKey]: Boolean(nextActionMap[role][moduleKey].view),
        },
      };

      return {
        ...prev,
        roleActionPermissions: nextActionMap,
        roleModuleVisibility: nextModuleVisibility,
      };
    });
  }

  async function save() {
    if (!payload) return;
    setSaving(true);
    setError('');
    setNotice('');

    try {
      const res = await fetch('/api/master/access-control', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roleModuleVisibility: payload.roleModuleVisibility,
          roleActionPermissions: payload.roleActionPermissions,
        }),
      });
      const body = (await res.json().catch(() => null)) as AccessControlResponse | null;
      if (!res.ok || !body?.ok) {
        throw new Error(body?.error || 'Failed to save role privileges.');
      }

      setPayload({
        roles: body.roles,
        modules: body.modules,
        actions: body.actions,
        roleModuleVisibility: body.roleModuleVisibility,
        roleActionPermissions: body.roleActionPermissions,
      });
      setNotice('Role privileges updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save role privileges.');
    } finally {
      setSaving(false);
    }
  }

  async function createRole() {
    if (!payload) return;
    const normalized = newRoleKey.trim().toUpperCase().replace(/\s+/g, '_');
    if (!normalized) {
      setError('Enter a role key, for example PARTNER_SUPPORT.');
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');

    try {
      const res = await fetch('/api/master/access-control', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          createRole: normalized,
          roleModuleVisibility: payload.roleModuleVisibility,
          roleActionPermissions: payload.roleActionPermissions,
        }),
      });
      const body = (await res.json().catch(() => null)) as AccessControlResponse | null;
      if (!res.ok || !body?.ok) {
        throw new Error(body?.error || 'Failed to create role.');
      }

      setPayload({
        roles: body.roles,
        modules: body.modules,
        actions: body.actions,
        roleModuleVisibility: body.roleModuleVisibility,
        roleActionPermissions: body.roleActionPermissions,
      });
      setNewRoleKey('');
      setNotice(`Role ${normalized} created and added to the privileges matrix.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create role.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Marvéo Master Platform</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Role Privileges</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Controls module visibility and action-level route/API access for internal Master roles.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/master/team"
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            User provisioning
          </Link>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || !payload}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-base font-semibold text-slate-900">Add role</h2>
        <p className="mt-1 text-xs text-slate-500">
          Create additional operational roles without code changes. Use uppercase with underscores.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={newRoleKey}
            onChange={(e) => setNewRoleKey(e.target.value)}
            placeholder="PARTNER_SUPPORT"
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            disabled={saving || !payload}
          />
          <button
            type="button"
            onClick={() => void createRole()}
            disabled={saving || !payload}
            className="rounded-full bg-indigo-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            Create role
          </button>
        </div>
      </div>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
      {notice ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{notice}</div> : null}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading privileges…</div>
      ) : !payload ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">No role privileges loaded.</div>
      ) : (
        <div className="space-y-6">
          {sortedRoles.map((role) => (
            <div key={role} className="rounded-2xl border border-slate-200 bg-white p-4">
              <h2 className="text-lg font-semibold text-slate-900">{labelForMasterRole(role)}</h2>
              {role === 'SUPER_ADMIN' ? (
                <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-indigo-700">
                  Locked: full platform access.
                </p>
              ) : null}
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-[980px] w-full">
                  <thead className="bg-slate-50">
                    <tr className="border-b border-slate-200">
                      <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Module</th>
                      {sortedActions.map((action) => (
                        <th key={`${role}-${action}`} className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {action}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedModules.map((moduleKey) => (
                      <tr key={`${role}-${moduleKey}`} className="border-b border-slate-100">
                        <td className="px-3 py-2 text-sm font-medium text-slate-800">{labelForControlCenterModule(moduleKey)}</td>
                        {sortedActions.map((action) => (
                          <td key={`${role}-${moduleKey}-${action}`} className="px-3 py-2 text-center text-sm text-slate-700">
                            <input
                              type="checkbox"
                              checked={Boolean(payload.roleActionPermissions[role]?.[moduleKey]?.[action])}
                              disabled={role === 'SUPER_ADMIN'}
                              onChange={(e) => setActionPermission(role, moduleKey, action, e.target.checked)}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
