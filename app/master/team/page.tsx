'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';

type MarveoRole = string;

type TeamUserRow = {
  id: string;
  name: string;
  username: string;
  email: string;
  avatarUrl?: string;
  rawAuthRole: string | null;
  rawRoles: string[];
  normalizedRole: MarveoRole | null;
  normalizedRoles: MarveoRole[];
  status: 'ACTIVE' | 'INVITED' | 'DISABLED';
  active: boolean;
  assignedWorkspaceId: string | null;
  assignedClientOrganizationId: string | null;
  ticketSignature: string;
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

type UserAction = 'DEACTIVATE' | 'ACTIVATE' | 'RESET_PASSWORD' | 'RESEND_INVITE';

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

  const [inviteRole, setInviteRole] = useState<MarveoRole>('CUSTOMER_SUPPORT');
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteAvatarUrl, setInviteAvatarUrl] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({
    name: '',
    email: '',
    avatarUrl: '',
    ticketSignature: '',
  });

  const rows = useMemo(() => {
    const users = payload?.users ?? [];
    const term = searchTerm.trim().toLowerCase();
    if (!term) return users;
    return users.filter((user) => {
      const blob = [
        user.name,
        user.email,
        user.username,
        user.normalizedRole || '',
        user.status,
        user.source,
      ].join(' ').toLowerCase();
      return blob.includes(term);
    });
  }, [payload?.users, searchTerm]);
  const canManageRoles = Boolean(payload?.safeRoleChangeEnabled);
  const selectableRoles = useMemo(
    () => (payload?.marveoRoles ?? [inviteRole]),
    [payload?.marveoRoles, inviteRole],
  );

  function patchLocalUser(
    userId: string,
    patch: Partial<Pick<TeamUserRow, 'normalizedRole' | 'normalizedRoles' | 'status' | 'active' | 'invitePending'>>,
  ) {
    setPayload((current) => {
      if (!current) return current;
      return {
        ...current,
        users: current.users.map((user) => {
          if (user.id !== userId) return user;
          return {
            ...user,
            ...patch,
          };
        }),
      };
    });
  }

  async function loadUsers(options?: { silent?: boolean; preserveMessage?: boolean }) {
    const silent = Boolean(options?.silent);
    const preserveMessage = Boolean(options?.preserveMessage);
    if (!silent) setLoading(true);
    setError('');
    if (!preserveMessage) setMessage('');

    try {
      const res = await fetch('/api/master/users', { cache: 'no-store' });
      const data = (await res.json().catch(() => null)) as UsersApiResponse | null;
      if (!res.ok || !data) throw new Error(data?.error || 'Failed to load master users.');
      setPayload(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load master users.');
    } finally {
      if (!silent) setLoading(false);
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
    const previousPayload = payload;

    const nextStatus = patch.status;
    const nextRole = patch.masterRole;
    if (nextRole || nextStatus) {
      patchLocalUser(userId, {
        ...(nextRole ? { normalizedRole: nextRole, normalizedRoles: [nextRole] } : {}),
        ...(nextStatus
          ? {
              status: nextStatus,
              active: nextStatus === 'ACTIVE',
              invitePending: nextStatus === 'INVITED',
            }
          : {}),
      });
    }

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
      void loadUsers({ silent: true, preserveMessage: true });
    } catch (err) {
      setPayload(previousPayload);
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusyId(null);
    }
  }

  async function runUserAction(userId: string, action: UserAction) {
    setBusyId(userId);
    setError('');
    setMessage('');
    const previousPayload = payload;

    if (action === 'DEACTIVATE') {
      patchLocalUser(userId, { status: 'DISABLED', active: false, invitePending: false });
    } else if (action === 'ACTIVATE') {
      const current = payload?.users.find((user) => user.id === userId);
      const status = current?.invitePending ? 'INVITED' : 'ACTIVE';
      patchLocalUser(userId, {
        status,
        active: true,
        invitePending: status === 'INVITED',
      });
    } else if (action === 'RESET_PASSWORD' || action === 'RESEND_INVITE') {
      patchLocalUser(userId, { status: 'INVITED', active: true, invitePending: true });
    }

    try {
      const res = await fetch('/api/master/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action }),
      });

      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        emailNotification?: { ok: boolean; skipped: boolean; reason?: string };
      } | null;
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'Action failed');
      }

      if (action === 'RESET_PASSWORD' || action === 'RESEND_INVITE') {
        if (data.emailNotification && !data.emailNotification.ok) {
          setMessage(`${toLabel(action)} completed, but email needs attention: ${data.emailNotification.reason || 'notification_failed'}.`);
        } else {
          setMessage(`${toLabel(action)} completed and email sent.`);
        }
      } else {
        setMessage(`${toLabel(action)} completed.`);
      }
      void loadUsers({ silent: true, preserveMessage: true });
    } catch (err) {
      setPayload(previousPayload);
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusyId(null);
    }
  }

  async function createInvite() {
    setBusyId('invite');
    setError('');
    setMessage('');

    try {
      const name = inviteName.trim();
      const email = inviteEmail.trim();
      if (!name) throw new Error('Name is required.');
      if (!email) throw new Error('Email is required.');

      const res = await fetch('/api/master/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          masterRole: inviteRole,
          name,
          email,
          avatarUrl: inviteAvatarUrl.trim() || undefined,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        inviteId?: string;
        emailNotification?: { ok: boolean; skipped: boolean; reason?: string };
      } | null;
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'User access creation failed');
      }

      if (data.emailNotification && !data.emailNotification.ok) {
        const reason = data.emailNotification.reason || 'notification_failed';
        setMessage(`User access created: ${data.inviteId}. Email notification needs attention: ${reason}`);
      } else {
        setMessage(`User access created: ${data.inviteId}. Access email sent.`);
      }

      if (data.inviteId) {
        const inviteId = data.inviteId;
        setPayload((current) => {
          if (!current) return current;
          const alreadyExists = current.users.some((user) => user.id === inviteId);
          if (alreadyExists) return current;
          const optimisticUser: TeamUserRow = {
            id: inviteId,
            name,
            username: inviteId,
            email,
            avatarUrl: inviteAvatarUrl.trim() || '',
            rawAuthRole: null,
            rawRoles: [],
            normalizedRole: inviteRole,
            normalizedRoles: [inviteRole],
            status: 'INVITED',
            active: false,
            assignedWorkspaceId: null,
            assignedClientOrganizationId: null,
            ticketSignature: '',
            invitePending: true,
            source: 'invite_scaffold',
          };

          return {
            ...current,
            users: [optimisticUser, ...current.users],
          };
        });
      }

      setInviteName('');
      setInviteEmail('');
      setInviteAvatarUrl('');
      void loadUsers({ silent: true, preserveMessage: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'User access creation failed');
    } finally {
      setBusyId(null);
    }
  }

  async function uploadMedia(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/media/upload', { method: 'POST', body: formData });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error || 'Upload failed');
    }
    const media = (await res.json().catch(() => null)) as { source_url?: string } | null;
    if (!media?.source_url) throw new Error('Upload failed');
    return media.source_url;
  }

  async function saveProfile(userId: string) {
    setBusyId(userId);
    setError('');
    setMessage('');

    try {
      const name = editDraft.name.trim();
      const email = editDraft.email.trim();
      if (!name) throw new Error('Name is required.');
      if (!email) throw new Error('Email is required.');

      const res = await fetch('/api/master/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          name,
          email,
          avatarUrl: editDraft.avatarUrl.trim() || undefined,
          ticketSignature: editDraft.ticketSignature,
        }),
      });

      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'Update failed');
      }

      setMessage('User profile updated.');
      setEditUserId(null);
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusyId(null);
    }
  }

  async function deleteUser(userId: string) {
    const confirmed = window.confirm('Delete this user record? This cannot be undone.');
    if (!confirmed) return;

    setBusyId(userId);
    setError('');
    setMessage('');

    try {
      const res = await fetch('/api/master/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Delete failed');

      setMessage('User record deleted.');
      if (editUserId === userId) setEditUserId(null);
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">User Provisioning</h1>
        <p className="mt-2 text-sm text-slate-600">
          Provision and manage internal access. Roles in this table come directly from Roles and Privileges.
        </p>
        {!canManageRoles ? (
          <p className="mt-3 inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-800">
            Super admin required for role creation and role changes
          </p>
        ) : null}
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
            <h2 className="text-lg font-semibold text-slate-900">Create Team Access</h2>
            <p className="mt-1 text-xs text-slate-500">
              Creates an internal user access record and sends an invite email.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              placeholder="Full name"
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              disabled={busyId === 'invite' || !canManageRoles}
            />
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="Email"
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              disabled={busyId === 'invite' || !canManageRoles}
            />
            <label className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={busyId === 'invite' || !canManageRoles}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  void (async () => {
                    try {
                      if (!canManageRoles) return;
                      setBusyId('invite');
                      const url = await uploadMedia(file);
                      setInviteAvatarUrl(url);
                      setMessage('Avatar uploaded.');
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Avatar upload failed');
                    } finally {
                      setBusyId(null);
                    }
                  })();
                }}
              />
              Upload avatar
            </label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as MarveoRole)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              disabled={busyId === 'invite' || !canManageRoles}
            >
              {selectableRoles.map((role) => (
                <option key={role} value={role}>
                  {toLabel(role)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void createInvite()}
              disabled={busyId === 'invite' || !canManageRoles}
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              Create user access
            </button>
          </div>
        </div>
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total users</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{rows.length}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
          <p className="text-xs font-semibold uppercase tracking-wide">Active</p>
          <p className="mt-2 text-2xl font-bold">{rows.filter((user) => user.status === 'ACTIVE').length}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <p className="text-xs font-semibold uppercase tracking-wide">Invited</p>
          <p className="mt-2 text-2xl font-bold">{rows.filter((user) => user.status === 'INVITED').length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Disabled</p>
          <p className="mt-2 text-2xl font-bold">{rows.filter((user) => user.status === 'DISABLED').length}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Filter users</label>
        <input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by name, email, role, status, source"
          className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-slate-600">Loading team directory...</div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-sm text-slate-600">No users found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  {['User', 'Normalized role', 'Status', 'Actions'].map((header) => (
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
                  const editing = editUserId === user.id;

                  return (
                    <Fragment key={user.id}>
                      <tr key={user.id} className="border-b border-slate-100">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-900">{user.name}</p>
                          <p className="text-xs text-slate-500">{user.email || user.username}</p>
                          <p className="text-[11px] text-slate-400">ID: {user.id}</p>
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
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusPill(user.status)}`}>
                            {toLabel(user.status)}
                          </span>
                        </td>
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
                              disabled={busy || !canManageRoles}
                              title="Change Marvéo master role"
                            >
                              <option value="">Unassigned</option>
                              {selectableRoles.map((role) => (
                                <option key={`${user.id}-${role}`} value={role}>
                                  {toLabel(role)}
                                </option>
                              ))}
                            </select>

                            <button
                              type="button"
                              onClick={() => void runUserAction(user.id, user.status === 'DISABLED' ? 'ACTIVATE' : 'DEACTIVATE')}
                              disabled={busy || !canManageRoles}
                              className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-800 disabled:opacity-60"
                              title="Toggle user status"
                            >
                              {user.status === 'DISABLED' ? 'Re-enable' : 'Disable'}
                            </button>

                            <button
                              type="button"
                              onClick={() => void runUserAction(user.id, 'RESET_PASSWORD')}
                              disabled={busy || !canManageRoles}
                              className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-800 disabled:opacity-60"
                              title="Generate a temporary password and email reset details"
                            >
                              Reset password
                            </button>

                            <button
                              type="button"
                              onClick={() => void runUserAction(user.id, 'RESEND_INVITE')}
                              disabled={busy || !canManageRoles || (!user.invitePending && user.status !== 'INVITED')}
                              className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 disabled:opacity-60"
                              title="Resend invite credentials"
                            >
                              Resend invite
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                if (editing) {
                                  setEditUserId(null);
                                  return;
                                }
                                setEditUserId(user.id);
                                setEditDraft({
                                  name: user.name || '',
                                  email: user.email || '',
                                  avatarUrl: user.avatarUrl || '',
                                  ticketSignature: user.ticketSignature || '',
                                });
                              }}
                              disabled={busy || !canManageRoles}
                              className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-800 disabled:opacity-60"
                            >
                              {editing ? 'Close' : 'Edit'}
                            </button>

                            <button
                              type="button"
                              onClick={() => void deleteUser(user.id)}
                              disabled={busy || !canManageRoles}
                              className="rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-60"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                      {editing ? (
                        <tr className="border-b border-slate-100 bg-slate-50/50">
                          <td colSpan={4} className="px-4 py-4">
                            <div className="grid gap-3 md:grid-cols-4">
                              <input
                                value={editDraft.name}
                                onChange={(e) => setEditDraft((prev) => ({ ...prev, name: e.target.value }))}
                                placeholder="Full name"
                                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                                disabled={busy || !canManageRoles}
                              />
                              <input
                                type="email"
                                value={editDraft.email}
                                onChange={(e) => setEditDraft((prev) => ({ ...prev, email: e.target.value }))}
                                placeholder="Email"
                                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                                disabled={busy || !canManageRoles}
                              />
                              <div className="flex items-center gap-2">
                                <label className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600">
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    disabled={busy || !canManageRoles}
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (!file) return;
                                      void (async () => {
                                        try {
                                          setBusyId(user.id);
                                          const url = await uploadMedia(file);
                                          setEditDraft((prev) => ({ ...prev, avatarUrl: url }));
                                          setMessage('Avatar uploaded.');
                                        } catch (err) {
                                          setError(err instanceof Error ? err.message : 'Avatar upload failed');
                                        } finally {
                                          setBusyId(null);
                                        }
                                      })();
                                    }}
                                  />
                                  Avatar
                                </label>
                                <input
                                  value={editDraft.avatarUrl}
                                  onChange={(e) => setEditDraft((prev) => ({ ...prev, avatarUrl: e.target.value }))}
                                  placeholder="Avatar URL"
                                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                                  disabled={busy || !canManageRoles}
                                />
                              </div>
                              <textarea
                                value={editDraft.ticketSignature}
                                onChange={(e) => setEditDraft((prev) => ({ ...prev, ticketSignature: e.target.value }))}
                                placeholder="Ticket signature (auto-appended to outgoing replies)"
                                className="md:col-span-5 rounded-xl border border-slate-300 px-3 py-2 text-sm"
                                rows={4}
                                disabled={busy || !canManageRoles}
                              />
                            </div>
                            <div className="mt-3 flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => void saveProfile(user.id)}
                                disabled={busy || !canManageRoles}
                                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                              >
                                Save profile
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditUserId(null)}
                                disabled={busy || !canManageRoles}
                                className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60"
                              >
                                Cancel
                              </button>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
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
