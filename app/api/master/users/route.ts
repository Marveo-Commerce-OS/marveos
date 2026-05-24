import { NextRequest, NextResponse } from 'next/server';
import {
  appendAuditLog,
  readAdminStore,
  updateAdminStore,
  type ManagedUserState,
  type NativeRole,
} from '@/lib/adminStore';
import {
  getCurrentPlatformUser,
  getSession,
  isAdmin,
  isSuperAdmin,
  normalizeRoles,
} from '@/lib/auth';
import { sendPlatformEmailNotification } from '@/lib/emailNotifications';
import { generateTempPassword, upsertPasswordEntries } from '@/lib/nativePasswords';

const ALLOWED_MARVEO_ROLES: NativeRole[] = [
  'SUPER_ADMIN',
  'ADMIN',
  'SUPPORT_OFFICER',
  'DEPLOYMENT_MANAGER',
  'BILLING_MANAGER',
];

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function roleToLabel(role: string): string {
  return role
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function statusToLabel(status: string): string {
  return roleToLabel(status);
}

function normalizeName(value: unknown): string | null {
  const name = String(value || '').trim();
  if (!name) return null;
  return name;
}

function normalizeEmail(value: unknown): string | null {
  const email = String(value || '').trim().toLowerCase();
  if (!email) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function normalizeAvatarUrl(value: unknown): string | null {
  const url = String(value || '').trim();
  if (!url) return '';
  if (!/^https?:\/\//i.test(url) && !url.startsWith('/')) return null;
  return url;
}

function normalizeMasterRole(value: unknown): NativeRole | undefined {
  const upper = String(value || '').trim().toUpperCase();
  if (!upper) return undefined;
  if (ALLOWED_MARVEO_ROLES.includes(upper as NativeRole)) return upper as NativeRole;
  return undefined;
}

async function ensureAdmin() {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const allowed = await isAdmin(session.token);
  if (!allowed) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };

  return { session };
}

function deriveStatus(state: ManagedUserState | undefined): 'ACTIVE' | 'INVITED' | 'DISABLED' {
  if (!state) return 'ACTIVE';
  if (state.status === 'INVITED' || state.invitePending) return 'INVITED';
  if (!state.active || state.status === 'DISABLED') return 'DISABLED';
  return 'ACTIVE';
}

function toNativeRole(value: unknown): NativeRole | null {
  const role = String(value || '').trim().toUpperCase();
  if (!role || role.startsWith('CONNECTED_')) return null;
  return ALLOWED_MARVEO_ROLES.includes(role as NativeRole) ? (role as NativeRole) : null;
}

function resolveConfiguredAppBaseUrl(req: NextRequest, store: Awaited<ReturnType<typeof readAdminStore>>) {
  const configured = String(store.platformSettings.email.appBaseUrl || process.env.MARVEO_APP_BASE_URL || '').trim();
  return configured || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
}

function resolveUserAccessLinks(
  req: NextRequest,
  store: Awaited<ReturnType<typeof readAdminStore>>,
  identity: { userType: 'INTERNAL_USER' | 'CLIENT_USER' },
) {
  const appBaseUrl = resolveConfiguredAppBaseUrl(req, store);
  const surface = identity.userType === 'CLIENT_USER' ? 'portal' : 'master';
  const loginPath = surface === 'master' ? '/master-login' : '/login';

  return {
    appBaseUrl,
    surface,
    loginUrl: new URL(loginPath, appBaseUrl).toString(),
    changePasswordUrl: new URL(`/password/change?surface=${surface}&firstLogin=1`, appBaseUrl).toString(),
  };
}

export async function GET() {
  const auth = await ensureAdmin();
  if ('error' in auth) return auth.error;

  const store = await readAdminStore();

  const nativeRows = Object.entries(store.nativeAuth.identities).map(([identityId, identity]) => {
    const state = store.users[identityId];
    const normalizedMasterRole = toNativeRole(state?.masterRole);
    const inferred = Array.from(new Set<NativeRole>([
      ...identity.roles,
      ...(normalizedMasterRole ? [normalizedMasterRole] : []),
    ]));
    const effectiveRole = (state?.masterRole || inferred[0] || null) as NativeRole | null;
    const controlCenterModules = effectiveRole
      ? Object.entries(store.controlCenterRoleVisibility[effectiveRole] || {})
          .filter(([, enabled]) => Boolean(enabled))
          .map(([module]) => module)
      : [];

    return {
      id: identityId,
      name: identity.name,
      username: identity.email,
      email: identity.email,
      avatarUrl: identity.avatarUrl || '',
      rawAuthRole: identity.source === 'WORDPRESS_BRIDGE' ? 'wordpress_bridge' : 'native',
      rawRoles: normalizeRoles(identity.roles),
      normalizedRole: state?.masterRole || inferred[0] || null,
      normalizedRoles: inferred,
      controlCenterAccess: inferred.some((role) => ['SUPER_ADMIN', 'ADMIN', 'SUPPORT_OFFICER', 'DEPLOYMENT_MANAGER', 'BILLING_MANAGER'].includes(role)),
      controlCenterModules,
      status: deriveStatus(state) || identity.status,
      active: state?.active ?? identity.status === 'ACTIVE',
      assignedWorkspaceId: state?.assignedWorkspaceId || null,
      assignedClientOrganizationId: state?.assignedClientOrganizationId || null,
      invitePending: Boolean(state?.invitePending),
      source: identity.source === 'WORDPRESS_BRIDGE' ? 'wordpress_bridge' : 'native',
    };
  });

  const inviteOnlyRows = Object.entries(store.users)
    .filter(([id]) => !nativeRows.some((row) => row.id === id))
    .filter(([, state]) => Boolean(state.invitePending || state.status === 'INVITED'))
    .map(([id, state]) => ({
      controlCenterModules: state.masterRole
        ? Object.entries(store.controlCenterRoleVisibility[state.masterRole] || {})
            .filter(([, enabled]) => Boolean(enabled))
            .map(([module]) => module)
        : [],
      id,
      name: 'Invited user',
      username: id,
      email: '',
      avatarUrl: store.nativeAuth.identities[id]?.avatarUrl || '',
      rawAuthRole: state.rawAuthRole || null,
      rawRoles: state.rawAuthRole ? [state.rawAuthRole] : [],
      normalizedRole: state.masterRole || null,
      normalizedRoles: state.masterRole ? [state.masterRole] : [],
      controlCenterAccess: Boolean(state.masterRole && ['SUPER_ADMIN', 'ADMIN', 'SUPPORT_OFFICER', 'DEPLOYMENT_MANAGER', 'BILLING_MANAGER'].includes(state.masterRole)),
      status: deriveStatus(state),
      active: state.active,
      assignedWorkspaceId: state.assignedWorkspaceId || null,
      assignedClientOrganizationId: state.assignedClientOrganizationId || null,
      invitePending: Boolean(state.invitePending),
      source: 'invite_scaffold',
    }));

  return NextResponse.json({
    safeRoleChangeEnabled: true,
    users: [...nativeRows, ...inviteOnlyRows],
    marveoRoles: ALLOWED_MARVEO_ROLES,
    warnings: [],
  });
}

export async function PATCH(req: NextRequest) {
  const auth = await ensureAdmin();
  if ('error' in auth) return auth.error;

  const canMutate = await isSuperAdmin(auth.session.token);
  if (!canMutate) {
    return NextResponse.json({ error: 'Only super admins can mutate team records.' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return badRequest('Invalid JSON body');

  const userId = String(body.userId || '').trim();
  if (!userId) return badRequest('userId is required');

  const requestedAction = String((body as { action?: unknown }).action || '').trim().toUpperCase();
  if (requestedAction) {
    const store = await readAdminStore();
    const identity = store.nativeAuth.identities[userId];
    if (!identity) return badRequest('User not found');

    if (requestedAction === 'DEACTIVATE' || requestedAction === 'ACTIVATE') {
      const isActivate = requestedAction === 'ACTIVATE';
      const nowIso = new Date().toISOString();

      const updated = await updateAdminStore((current) => ({
        ...current,
        users: {
          ...current.users,
          [userId]: {
            ...(current.users[userId] ?? { active: true, portals: [] }),
            active: isActivate,
            status: isActivate
              ? ((current.users[userId]?.invitePending ?? false) ? 'INVITED' : 'ACTIVE')
              : 'DISABLED',
            invitePending: isActivate ? (current.users[userId]?.invitePending ?? false) : false,
          },
        },
        nativeAuth: {
          ...current.nativeAuth,
          identities: {
            ...current.nativeAuth.identities,
            [userId]: {
              ...current.nativeAuth.identities[userId],
              status: isActivate
                ? ((current.users[userId]?.invitePending ?? false) ? 'INVITED' : 'ACTIVE')
                : 'DISABLED',
              updatedAt: nowIso,
            },
          },
        },
      }));

      const actor = await getCurrentPlatformUser(auth.session.token);
      await appendAuditLog({
        actorEmail: actor?.email ?? String(auth.session.user?.user_email ?? 'unknown'),
        action: isActivate ? 'master.user.activated' : 'master.user.deactivated',
        target: `user:${userId}`,
        details: isActivate ? 'status=ACTIVE|INVITED' : 'status=DISABLED',
      });

      const targetEmail = updated.nativeAuth.identities[userId]?.email?.trim().toLowerCase();
      if (targetEmail) {
        await sendPlatformEmailNotification({
          templateKey: 'USER_STATUS_CHANGED',
          to: targetEmail,
          variables: {
            userName: updated.nativeAuth.identities[userId]?.name || targetEmail,
            status: statusToLabel(updated.users[userId]?.status || 'ACTIVE'),
            roleName: updated.users[userId]?.masterRole ? roleToLabel(updated.users[userId].masterRole) : 'Unassigned',
          },
        });
      }

      return NextResponse.json({ ok: true, userId, action: requestedAction, state: updated.users[userId] });
    }

    if (requestedAction === 'RESET_PASSWORD' || requestedAction === 'RESEND_INVITE') {
      const tempPassword = generateTempPassword();
      const nowIso = new Date().toISOString();

      const updated = await updateAdminStore((current) => ({
        ...current,
        users: {
          ...current.users,
          [userId]: {
            ...(current.users[userId] ?? { active: true, portals: [] }),
            active: true,
            status: 'INVITED',
            invitePending: true,
          },
        },
        nativeAuth: {
          ...current.nativeAuth,
          identities: {
            ...current.nativeAuth.identities,
            [userId]: {
              ...current.nativeAuth.identities[userId],
              status: 'INVITED',
              updatedAt: nowIso,
            },
          },
          permissions: {
            ...current.nativeAuth.permissions,
            [userId]: upsertPasswordEntries(current.nativeAuth.permissions[userId], tempPassword),
          },
        },
      }));

      const actor = await getCurrentPlatformUser(auth.session.token);
      await appendAuditLog({
        actorEmail: actor?.email ?? String(auth.session.user?.user_email ?? 'unknown'),
        action: requestedAction === 'RESET_PASSWORD' ? 'master.user.password_reset' : 'master.user.invite_resent',
        target: `user:${userId}`,
        details: `email=${updated.nativeAuth.identities[userId]?.email || 'n/a'}`,
      });

      const links = resolveUserAccessLinks(req, store, identity);
      const targetEmail = updated.nativeAuth.identities[userId]?.email?.trim().toLowerCase();
      const roleName = updated.users[userId]?.masterRole ? roleToLabel(updated.users[userId].masterRole) : 'Unassigned';

      const emailNotification = targetEmail
        ? await sendPlatformEmailNotification({
            templateKey: requestedAction === 'RESET_PASSWORD' ? 'PASSWORD_RESET_REQUESTED' : 'USER_INVITE',
            to: targetEmail,
            variables: {
              userName: updated.nativeAuth.identities[userId]?.name || targetEmail,
              roleName,
              appBaseUrl: links.appBaseUrl,
              loginUrl: links.loginUrl,
              changePasswordUrl: links.changePasswordUrl,
              tempPassword,
            },
          })
        : { ok: false as const, skipped: true as const, reason: 'missing-user-email' };

      return NextResponse.json({
        ok: true,
        userId,
        action: requestedAction,
        state: updated.users[userId],
        emailNotification,
      });
    }

    return badRequest('action is invalid');
  }

  const requestedName = Object.prototype.hasOwnProperty.call(body, 'name') ? normalizeName((body as { name?: unknown }).name) : undefined;
  if (requestedName === null) return badRequest('name is required');

  const requestedEmail = Object.prototype.hasOwnProperty.call(body, 'email') ? normalizeEmail((body as { email?: unknown }).email) : undefined;
  if (requestedEmail === null) return badRequest('email is required and must be valid');

  const requestedAvatarUrl = Object.prototype.hasOwnProperty.call(body, 'avatarUrl')
    ? normalizeAvatarUrl((body as { avatarUrl?: unknown }).avatarUrl)
    : undefined;
  if (requestedAvatarUrl === null) return badRequest('avatarUrl must be a valid URL');

  const requestedRole = normalizeMasterRole(body.masterRole);
  if (body.masterRole && !requestedRole) {
    return badRequest('masterRole is invalid');
  }

  const nextStatus = String(body.status || '').trim().toUpperCase();
  const validStatus = nextStatus === 'ACTIVE' || nextStatus === 'INVITED' || nextStatus === 'DISABLED'
    ? (nextStatus as 'ACTIVE' | 'INVITED' | 'DISABLED')
    : undefined;

  const store = await readAdminStore();
  const identity = store.nativeAuth.identities[userId];
  if ((requestedName !== undefined || requestedEmail !== undefined) && identity?.source === 'WORDPRESS_BRIDGE') {
    return badRequest('Cannot edit name/email for WordPress bridge users.');
  }

  if (requestedEmail !== undefined) {
    const conflict = Object.values(store.nativeAuth.identities).some((row) =>
      row.id !== userId && row.email.trim().toLowerCase() === requestedEmail,
    );
    if (conflict) return badRequest('email is already in use by another identity');
  }

  const updated = await updateAdminStore((current) => {
    const existing = current.users[userId] ?? { active: true, portals: [] as const };
    const currentIdentity = current.nativeAuth.identities[userId];
    const canEditIdentity = Boolean(currentIdentity && currentIdentity.source !== 'WORDPRESS_BRIDGE');

    return {
      ...current,
      users: {
        ...current.users,
        [userId]: {
          ...existing,
          active: validStatus ? validStatus === 'ACTIVE' : (typeof body.active === 'boolean' ? body.active : existing.active),
          status: validStatus ?? existing.status,
          invitePending: validStatus === 'INVITED'
            ? true
            : (validStatus === 'ACTIVE'
              ? false
              : (validStatus === 'DISABLED' ? false : existing.invitePending)),
          portals: existing.portals,
          masterRole: requestedRole ?? existing.masterRole,
          rawAuthRole: typeof body.rawAuthRole === 'string' ? body.rawAuthRole.trim() : existing.rawAuthRole,
          assignedWorkspaceId: typeof body.assignedWorkspaceId === 'string'
            ? body.assignedWorkspaceId.trim() || undefined
            : existing.assignedWorkspaceId,
          assignedClientOrganizationId: typeof body.assignedClientOrganizationId === 'string'
            ? body.assignedClientOrganizationId.trim() || undefined
            : existing.assignedClientOrganizationId,
        },
      },
      nativeAuth: (requestedName !== undefined || requestedEmail !== undefined || requestedAvatarUrl !== undefined || validStatus !== undefined) && canEditIdentity ? {
        ...current.nativeAuth,
        identities: {
          ...current.nativeAuth.identities,
          [userId]: {
            ...currentIdentity,
            name: requestedName ?? currentIdentity.name,
            email: requestedEmail ?? currentIdentity.email,
            avatarUrl: requestedAvatarUrl === '' ? undefined : (requestedAvatarUrl ?? currentIdentity.avatarUrl),
            status: validStatus ?? currentIdentity.status,
            updatedAt: new Date().toISOString(),
          },
        },
      } : current.nativeAuth,
    };
  });

  const actor = await getCurrentPlatformUser(auth.session.token);
  await appendAuditLog({
    actorEmail: actor?.email ?? String(auth.session.user?.user_email ?? 'unknown'),
    action: 'master.user.updated',
    target: `user:${userId}`,
    details: `masterRole=${requestedRole || 'unchanged'} status=${validStatus || 'unchanged'} name=${requestedName ? 'updated' : 'unchanged'} email=${requestedEmail ? 'updated' : 'unchanged'}`,
  });

  const targetEmail = updated.nativeAuth.identities[userId]?.email?.trim().toLowerCase();
  const nextState = updated.users[userId];
  if (targetEmail) {
    await sendPlatformEmailNotification({
      templateKey: 'USER_STATUS_CHANGED',
      to: targetEmail,
      variables: {
        userName: updated.nativeAuth.identities[userId]?.name || targetEmail,
        status: statusToLabel(nextState?.status || 'ACTIVE'),
        roleName: nextState?.masterRole ? roleToLabel(nextState.masterRole) : 'Unassigned',
      },
    });
  }

  return NextResponse.json({
    ok: true,
    userId,
    state: updated.users[userId],
    safeRoleChangeEnabled: true,
  });
}

export async function POST(req: NextRequest) {
  const auth = await ensureAdmin();
  if ('error' in auth) return auth.error;

  const canMutate = await isSuperAdmin(auth.session.token);
  if (!canMutate) {
    return NextResponse.json({ error: 'Only super admins can create invite scaffolds.' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return badRequest('Invalid JSON body');

  const requestedRole = normalizeMasterRole(body.masterRole);
  if (!requestedRole) return badRequest('masterRole is required for invite scaffold');

  const requestedName = normalizeName((body as { name?: unknown }).name);
  if (!requestedName) return badRequest('name is required');

  const requestedEmail = normalizeEmail((body as { email?: unknown }).email);
  if (!requestedEmail) return badRequest('email is required and must be valid');

  const requestedAvatarUrl = normalizeAvatarUrl((body as { avatarUrl?: unknown }).avatarUrl);
  if (requestedAvatarUrl === null) return badRequest('avatarUrl must be a valid URL');

  const store = await readAdminStore();
  const conflict = Object.values(store.nativeAuth.identities).some((row) => row.email.trim().toLowerCase() === requestedEmail);
  if (conflict) return badRequest('email is already in use by another identity');

  const inviteId = `invite_${Date.now()}`;
  const tempPassword = generateTempPassword();

  await updateAdminStore((current) => ({
    ...current,
    users: {
      ...current.users,
      [inviteId]: {
        active: false,
        portals: [],
        status: 'INVITED',
        invitePending: true,
        masterRole: requestedRole,
        rawAuthRole: typeof body.rawAuthRole === 'string' ? body.rawAuthRole.trim() || undefined : undefined,
        assignedWorkspaceId: typeof body.assignedWorkspaceId === 'string' ? body.assignedWorkspaceId.trim() || undefined : undefined,
        assignedClientOrganizationId: typeof body.assignedClientOrganizationId === 'string'
          ? body.assignedClientOrganizationId.trim() || undefined
          : undefined,
      },
    },
    nativeAuth: {
      ...current.nativeAuth,
      identities: {
        ...current.nativeAuth.identities,
        [inviteId]: {
          id: inviteId,
          email: requestedEmail,
          name: requestedName,
          avatarUrl: requestedAvatarUrl || undefined,
          userType: requestedRole === 'CLIENT_OWNER' || requestedRole === 'CLIENT_STAFF' ? 'CLIENT_USER' : 'INTERNAL_USER',
          status: 'INVITED',
          roles: [requestedRole],
          source: 'NATIVE',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
      permissions: {
        ...current.nativeAuth.permissions,
        [inviteId]: upsertPasswordEntries(current.nativeAuth.permissions[inviteId], tempPassword),
      },
    },
  }));

  const actor = await getCurrentPlatformUser(auth.session.token);
  await appendAuditLog({
    actorEmail: actor?.email ?? String(auth.session.user?.user_email ?? 'unknown'),
    action: 'master.user.invited',
    target: `user:${inviteId}`,
    details: `masterRole=${requestedRole}`,
  });

  const appBaseUrl = resolveConfiguredAppBaseUrl(req, store);
  const loginUrl = new URL('/master-login', appBaseUrl).toString();
  const changePasswordUrl = new URL('/master/profile', appBaseUrl).toString();

  const inviteEmailResult = await sendPlatformEmailNotification({
    templateKey: 'USER_INVITE',
    to: requestedEmail,
    variables: {
      userName: requestedName,
      roleName: roleToLabel(requestedRole),
      appBaseUrl,
      loginUrl,
      changePasswordUrl,
      tempPassword,
    },
  });

  return NextResponse.json({
    ok: true,
    inviteId,
    safeRoleChangeEnabled: true,
    emailNotification: inviteEmailResult,
  }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const auth = await ensureAdmin();
  if ('error' in auth) return auth.error;

  const canMutate = await isSuperAdmin(auth.session.token);
  if (!canMutate) {
    return NextResponse.json({ error: 'Only super admins can delete team records.' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return badRequest('Invalid JSON body');

  const userId = String((body as { userId?: unknown }).userId || '').trim();
  if (!userId) return badRequest('userId is required');

  const actorId = auth.session.user?.id != null ? String(auth.session.user.id) : '';
  if (actorId && actorId === userId) return badRequest('Cannot delete your own account.');

  const store = await readAdminStore();
  const identity = store.nativeAuth.identities[userId];
  if (identity?.source === 'WORDPRESS_BRIDGE') {
    return badRequest('Cannot delete WordPress bridge users.');
  }

  const existed = Boolean(store.users[userId] || store.nativeAuth.identities[userId]);
  if (!existed) return badRequest('User not found');

  await updateAdminStore((current) => {
    const nextUsers = { ...current.users };
    delete nextUsers[userId];

    const nextIdentities = { ...current.nativeAuth.identities };
    delete nextIdentities[userId];

    const nextSessions = { ...current.nativeAuth.sessions };
    for (const [sessionId, session] of Object.entries(nextSessions)) {
      if (session.userId === userId) delete nextSessions[sessionId];
    }

    return {
      ...current,
      users: nextUsers,
      nativeAuth: {
        ...current.nativeAuth,
        identities: nextIdentities,
        sessions: nextSessions,
      },
    };
  });

  const actor = await getCurrentPlatformUser(auth.session.token);
  await appendAuditLog({
    actorEmail: actor?.email ?? String(auth.session.user?.user_email ?? 'unknown'),
    action: 'master.user.deleted',
    target: `user:${userId}`,
    details: 'deleted',
  });

  return NextResponse.json({ ok: true, userId });
}
