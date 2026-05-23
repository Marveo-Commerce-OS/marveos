'use client';

import { useEffect, useMemo, useState } from 'react';

type PortalAccess = 'b2c' | 'b2b';

type MarveoRole =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'SUPPORT_OFFICER'
  | 'DEPLOYMENT_MANAGER'
  | 'BILLING_MANAGER'
  | 'CLIENT_OWNER'
  | 'CLIENT_STAFF';

type TeamUserRow = {
  id: string;
  name: string;
  username: string;
  email: string;
  rawAuthRole: string | null;
  rawRoles: string[];
  normalizedRole: MarveoRole | null;
  normalizedRoles: MarveoRole[];
  status: 'ACTIVE' | 'INVITED' | 'DISABLED';
  active: boolean;
  portals: PortalAccess[];
  assignedWorkspaceId: string | null;
  assignedClientOrganizationId: string | null;
  invitePending: boolean;
  source: 'native' | 'wordpress_bridge' | 'invite_scaffold';
};

type UsersApiResponse = {
  safeRoleChangeEnabled: boolean;
  users: TeamUserRow[];
  marveoRoles: MarveoRole[];
  warnings?: string[];
  error?: string;
};

function toLabel(raw: string): string {
  return raw
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function statusPill(status: string) {
  const key = status.toLowerCase();
  if (key.includes('active')) return 'bg-emerald-100 text-emerald-700';
  if (key.includes('invited')) return 'bg-amber-100 text-amber-800';
  return 'bg-slate-100 text-slate-700';
}

export default function MasterTeamPage() {
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [payload, setPayload] = useState<UsersApiResponse | null>(null);

  const [inviteRole, setInviteRole] = useState<MarveoRole>('SUPPORT_OFFICER');

  const rows = useMemo(() => payload?.users ?? [], [payload]);

  async function loadUsers() {
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const res = await fetch('/api/master/users', { cache: 'no-store' });
      const data = (await res.json().catch(() => null)) as UsersApiResponse | null;
      if (!res.ok || !data) throw new Error(data?.error || 'Failed to load master users.');
      setPayload(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load master users.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadUsers();
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  async function updateUser(userId: string, patch: { masterRole?: MarveoRole | null; status?: 'ACTIVE' | 'INVITED' | 'DISABLED' }) {
    setBusyId(userId);
    setError('');
    setMessage('');

    try {
      const res = await fetch('/api/master/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          ...(patch.masterRole ? { masterRole: patch.masterRole } : {}),
          ...(patch.status ? { status: patch.status } : {}),
        }),
      });

      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'Update failed');
      }

      setMessage('User record updated.');
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusyId(null);
    }
  }

  async function createInvite() {
    setBusyId('invite');
    setError('');
    setMessage('');

    try {
      const res = await fetch('/api/master/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ masterRole: inviteRole }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; inviteId?: string } | null;
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'Invite scaffold failed');
      }

      setMessage(`Invite scaffold created: ${data.inviteId}`);
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invite scaffold failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Team</h1>
        <p className="mt-2 text-sm text-slate-600">
          Master user directory for internal Marveo roles. WordPress roles are treated as compatibility inputs only.
        </p>
        <p className="mt-3 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-800">
          Platform-native mutations enabled
        </p>
      </div>

      {payload?.warnings?.length ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <p className="text-sm font-semibold">Warnings</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {payload.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Invite scaffold</h2>
            <p className="mt-1 text-xs text-slate-500">
              Creates a persisted platform identity for future provisioning.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as MarveoRole)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              disabled={busyId === 'invite'}
            >
              {(payload?.marveoRoles ?? [inviteRole]).map((role) => (
                <option key={role} value={role}>
                  {toLabel(role)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void createInvite()}
              disabled={busyId === 'invite'}
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              Create invite scaffold
            </button>
          </div>
        </div>
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-slate-600">Loading team directory...</div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-sm text-slate-600">No users found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px]">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  {['User', 'Normalized role', 'Raw auth role', 'Status', 'Workspace', 'Client org', 'Actions'].map((header) => (
                    <th
                      key={header}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((user) => {
                  const busy = busyId === user.id;
                  const normalized = user.normalizedRole;

                  return (
                    <tr key={user.id} className="border-b border-slate-100">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">{user.name}</p>
                        <p className="text-xs text-slate-500">{user.email || user.username}</p>
                                                <p className="text-[11px] text-slate-400">ID: {user.id} · Source: {toLabel(user.source)}</p>

                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {normalized ? (
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-800">
                            {toLabel(normalized)}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500">Unassigned</span>
                        )}
                        {user.normalizedRoles.length > 1 ? (
                          <p className="mt-2 text-xs text-slate-500">All roles: {user.normalizedRoles.map(toLabel).join(', ')}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {user.rawAuthRole ? toLabel(user.rawAuthRole) : <span className="text-xs text-slate-500">n/a</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusPill(user.status)}`}>
                          {toLabel(user.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">{user.assignedWorkspaceId || '—'}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{user.assignedClientOrganizationId || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            value={normalized || ''}
                            onChange={(e) => {
                              const next = e.target.value as MarveoRole;
                              if (!next) return;
                              void updateUser(user.id, { masterRole: next });
                            }}
                            className="rounded-xl border border-slate-300 px-2 py-1 text-xs"
                            disabled={busy}
                            title="Change Marvéo master role"
                          >
                            <option value="">Unassigned</option>
                            {(payload?.marveoRoles ?? []).map((role) => (
                              <option key={`${user.id}-${role}`} value={role}>
                                {toLabel(role)}
                              </option>
                            ))}
                          </select>

                          <button
                            type="button"
                            onClick={() => void updateUser(user.id, { status: user.status === 'DISABLED' ? 'ACTIVE' : 'DISABLED' })}
                            disabled={busy}
                            className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-800 disabled:opacity-60"
                            title="Toggle user status"
                          >
                            {user.status === 'DISABLED' ? 'Re-enable' : 'Disable'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
