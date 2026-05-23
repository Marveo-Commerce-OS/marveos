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

const ALLOWED_MARVEO_ROLES: NativeRole[] = [
  'SUPER_ADMIN',
  'ADMIN',
  'SUPPORT_OFFICER',
  'DEPLOYMENT_MANAGER',
  'BILLING_MANAGER',
  'CLIENT_OWNER',
  'CLIENT_STAFF',
];

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
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

    return {
      id: identityId,
      name: identity.name,
      username: identity.email,
      email: identity.email,
      rawAuthRole: identity.source === 'WORDPRESS_BRIDGE' ? 'wordpress_bridge' : 'native',
      rawRoles: normalizeRoles(identity.roles),
      normalizedRole: state?.masterRole || inferred[0] || null,
      normalizedRoles: inferred,
      status: deriveStatus(state) || identity.status,
      active: state?.active ?? identity.status === 'ACTIVE',
      portals: state?.portals ?? ['b2c'],
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
      id,
      name: 'Invited user',
      username: id,
      email: '',
      rawAuthRole: state.rawAuthRole || null,
      rawRoles: state.rawAuthRole ? [state.rawAuthRole] : [],
      normalizedRole: state.masterRole || null,
      normalizedRoles: state.masterRole ? [state.masterRole] : [],
      status: deriveStatus(state),
      active: state.active,
      portals: state.portals,
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

  const requestedRole = normalizeMasterRole(body.masterRole);
  if (body.masterRole && !requestedRole) {
    return badRequest('masterRole is invalid');
  }

  const nextStatus = String(body.status || '').trim().toUpperCase();
  const validStatus = nextStatus === 'ACTIVE' || nextStatus === 'INVITED' || nextStatus === 'DISABLED'
    ? (nextStatus as 'ACTIVE' | 'INVITED' | 'DISABLED')
    : undefined;

  const updated = await updateAdminStore((current) => {
    const existing = current.users[userId] ?? { active: true, portals: ['b2c'] as const };

    return {
      ...current,
      users: {
        ...current.users,
        [userId]: {
          ...existing,
          active: validStatus ? validStatus === 'ACTIVE' : (typeof body.active === 'boolean' ? body.active : existing.active),
          status: validStatus ?? existing.status,
          invitePending: validStatus === 'INVITED' ? true : (validStatus === 'ACTIVE' ? false : existing.invitePending),
          portals: Array.isArray(body.portals)
            ? body.portals.filter((item: unknown): item is 'b2c' | 'b2b' => item === 'b2c' || item === 'b2b')
            : existing.portals,
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
    };
  });

  const actor = await getCurrentPlatformUser(auth.session.token);
  await appendAuditLog({
    actorEmail: actor?.email ?? String(auth.session.user?.user_email ?? 'unknown'),
    action: 'master.user.updated',
    target: `user:${userId}`,
    details: `masterRole=${requestedRole || 'unchanged'} status=${validStatus || 'unchanged'}`,
  });

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

  const inviteId = `invite_${Date.now()}`;

  await updateAdminStore((current) => ({
    ...current,
    users: {
      ...current.users,
      [inviteId]: {
        active: false,
        portals: ['b2c'],
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
          email: typeof body.email === 'string' ? body.email.trim() : `${inviteId}@pending.local`,
          name: 'Invited user',
          userType: requestedRole === 'CLIENT_OWNER' || requestedRole === 'CLIENT_STAFF' ? 'CLIENT_USER' : 'INTERNAL_USER',
          status: 'INVITED',
          roles: [requestedRole],
          source: 'NATIVE',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
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

  return NextResponse.json({ ok: true, inviteId, safeRoleChangeEnabled: true }, { status: 201 });
}
