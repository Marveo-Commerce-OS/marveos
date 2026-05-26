import { NextRequest, NextResponse } from 'next/server';
import {
  CONTROL_CENTER_MODULE_KEYS,
  MASTER_PERMISSION_ACTION_KEYS,
  appendAuditLog,
  readAdminStore,
  updateAdminStore,
} from '@/lib/adminStore';
import { getCurrentPlatformUser, isSuperAdmin } from '@/lib/auth';
import { requireActionPermission } from '@/lib/master/permissions/guards';
import { MASTER_PERMISSION_ACTIONS } from '@/lib/master/permissions/actions';
import { resolveModuleActionPermissions } from '@/lib/master/permissions/resolver';

const DEFAULT_INTERNAL_ROLES = [
  'SUPER_ADMIN',
  'ADMIN',
  'CUSTOMER_SUPPORT',
  'TECHNICAL_SUPPORT',
  'DEPLOYMENT_MANAGER',
  'BILLING_MANAGER',
] as const;
const ROLE_ORDER_PRIORITY = [...DEFAULT_INTERNAL_ROLES] as const;
const INTERNAL_ROLE_SET = new Set<string>(DEFAULT_INTERNAL_ROLES);

type ModuleKey = (typeof CONTROL_CENTER_MODULE_KEYS)[number];
type ActionKey = (typeof MASTER_PERMISSION_ACTION_KEYS)[number];

type RoleModuleVisibilityPayload = Partial<Record<string, Partial<Record<ModuleKey, boolean>>>>;
type RoleActionPermissionPayload = Partial<
  Record<string, Partial<Record<ModuleKey, Partial<Record<ActionKey, boolean>>>>>
>;

function normalizeRoleKey(value: unknown): string {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, '_');
}

function listConfiguredRoles(store: Awaited<ReturnType<typeof readAdminStore>>): string[] {
  const roleSet = new Set<string>(DEFAULT_INTERNAL_ROLES);
  for (const role of Object.keys(store.controlCenterRoleVisibility || {})) {
    const normalized = normalizeRoleKey(role);
    if (normalized) roleSet.add(normalized);
  }
  for (const role of Object.keys(store.controlCenterRoleActionPermissions || {})) {
    const normalized = normalizeRoleKey(role);
    if (normalized) roleSet.add(normalized);
  }
  for (const user of Object.values(store.users || {})) {
    const normalized = normalizeRoleKey(user.masterRole);
    if (normalized) roleSet.add(normalized);
  }

  const preferred = ROLE_ORDER_PRIORITY.filter((role) => roleSet.has(role));
  const custom = Array.from(roleSet)
    .filter((role) => !ROLE_ORDER_PRIORITY.includes(role as (typeof ROLE_ORDER_PRIORITY)[number]))
    .sort();
  return [...preferred, ...custom];
}

function sanitizeRoleModuleVisibility(input: unknown, roles: string[]) {
  const payload = (input && typeof input === 'object')
    ? (input as RoleModuleVisibilityPayload)
    : {};

  return Object.fromEntries(
    roles.map((role) => [
      role,
      Object.fromEntries(
        CONTROL_CENTER_MODULE_KEYS.map((moduleKey) => [moduleKey, Boolean(payload[role]?.[moduleKey])]),
      ),
    ]),
  );
}

function sanitizeRoleActionPermissions(input: unknown, roles: string[]) {
  const payload = (input && typeof input === 'object')
    ? (input as RoleActionPermissionPayload)
    : {};

  return Object.fromEntries(
    roles.map((role) => [
      role,
      Object.fromEntries(
        CONTROL_CENTER_MODULE_KEYS.map((moduleKey) => [
          moduleKey,
          Object.fromEntries(
            MASTER_PERMISSION_ACTIONS.map((action) => [
              action,
              Boolean(payload[role]?.[moduleKey]?.[action]),
            ]),
          ),
        ]),
      ),
    ]),
  );
}

function resolveRoleModuleActionPermissions(
  store: Awaited<ReturnType<typeof readAdminStore>>,
  role: string,
  moduleKey: ModuleKey,
): Record<ActionKey, boolean> {
  if (role === 'SUPER_ADMIN') {
    return {
      view: true,
      create: true,
      update: true,
      delete: true,
      assign: true,
      approve: true,
      export: true,
    };
  }

  if (INTERNAL_ROLE_SET.has(role)) {
    return resolveModuleActionPermissions({
      role: role as (typeof DEFAULT_INTERNAL_ROLES)[number],
      moduleKey,
      moduleVisibility: Boolean(store.controlCenterRoleVisibility[role]?.[moduleKey]),
      storedActionPermissions: store.controlCenterRoleActionPermissions[role]?.[moduleKey],
    }) as Record<ActionKey, boolean>;
  }

  const stored = store.controlCenterRoleActionPermissions[role]?.[moduleKey];
  if (stored && typeof stored === 'object') {
    return Object.fromEntries(
      MASTER_PERMISSION_ACTIONS.map((action) => [action, Boolean(stored[action])]),
    ) as Record<ActionKey, boolean>;
  }

  const canView = Boolean(store.controlCenterRoleVisibility[role]?.[moduleKey]);
  return {
    view: canView,
    create: false,
    update: false,
    delete: false,
    assign: false,
    approve: false,
    export: false,
  };
}

function buildResolvedActionPermissions(store: Awaited<ReturnType<typeof readAdminStore>>, roles: string[]) {
  return Object.fromEntries(
    roles.map((role) => [
      role,
      Object.fromEntries(
        CONTROL_CENTER_MODULE_KEYS.map((moduleKey) => [
          moduleKey,
          resolveRoleModuleActionPermissions(store, role, moduleKey),
        ]),
      ),
    ]),
  );
}

export async function GET() {
  const auth = await requireActionPermission('rolePrivileges', 'view');
  if ('error' in auth) return auth.error;

  const store = await readAdminStore();
  const roles = listConfiguredRoles(store);
  const roleModuleVisibility = Object.fromEntries(
    roles.map((role) => [
      role,
      Object.fromEntries(
        CONTROL_CENTER_MODULE_KEYS.map((moduleKey) => [moduleKey, Boolean(store.controlCenterRoleVisibility[role]?.[moduleKey])]),
      ),
    ]),
  );

  return NextResponse.json({
    roles,
    modules: CONTROL_CENTER_MODULE_KEYS,
    actions: MASTER_PERMISSION_ACTIONS,
    roleModuleVisibility,
    roleActionPermissions: buildResolvedActionPermissions(store, roles),
  });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireActionPermission('rolePrivileges', 'update');
  if ('error' in auth) return auth.error;

  const canEdit = await isSuperAdmin(auth.session.token);
  if (!canEdit) {
    return NextResponse.json({ error: 'Only super admins can update access control.' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const store = await readAdminStore();
  const requestedRole = normalizeRoleKey((body as { createRole?: unknown }).createRole);
  const roles = requestedRole
    ? Array.from(new Set([...listConfiguredRoles(store), requestedRole]))
    : listConfiguredRoles(store);

  if ((body as { createRole?: unknown }).createRole !== undefined && !requestedRole) {
    return NextResponse.json({ error: 'createRole must be a non-empty role key.' }, { status: 400 });
  }

  const roleModuleVisibility = (body as { roleModuleVisibility?: unknown }).roleModuleVisibility === undefined
    ? Object.fromEntries(
        roles.map((role) => [
          role,
          Object.fromEntries(
            CONTROL_CENTER_MODULE_KEYS.map((moduleKey) => [moduleKey, Boolean(store.controlCenterRoleVisibility[role]?.[moduleKey])]),
          ),
        ]),
      )
    : sanitizeRoleModuleVisibility((body as { roleModuleVisibility?: unknown }).roleModuleVisibility, roles);

  const roleActionPermissions = (body as { roleActionPermissions?: unknown }).roleActionPermissions === undefined
    ? Object.fromEntries(
        roles.map((role) => [
          role,
          Object.fromEntries(
            CONTROL_CENTER_MODULE_KEYS.map((moduleKey) => [
              moduleKey,
              resolveRoleModuleActionPermissions(store, role, moduleKey),
            ]),
          ),
        ]),
      )
    : sanitizeRoleActionPermissions((body as { roleActionPermissions?: unknown }).roleActionPermissions, roles);

  if (roles.includes('SUPER_ADMIN')) {
    roleModuleVisibility.SUPER_ADMIN = Object.fromEntries(
      CONTROL_CENTER_MODULE_KEYS.map((moduleKey) => [moduleKey, true]),
    ) as Record<ModuleKey, boolean>;
    roleActionPermissions.SUPER_ADMIN = Object.fromEntries(
      CONTROL_CENTER_MODULE_KEYS.map((moduleKey) => [
        moduleKey,
        Object.fromEntries(MASTER_PERMISSION_ACTIONS.map((action) => [action, true])) as Record<ActionKey, boolean>,
      ]),
    ) as Record<ModuleKey, Record<ActionKey, boolean>>;
  }

  const next = await updateAdminStore((current) => ({
    ...current,
    controlCenterRoleVisibility: {
      ...current.controlCenterRoleVisibility,
      ...roleModuleVisibility,
    },
    controlCenterRoleActionPermissions: {
      ...current.controlCenterRoleActionPermissions,
      ...roleActionPermissions,
    },
  }));

  const actor = await getCurrentPlatformUser(auth.session.token);
  await appendAuditLog({
    actorEmail: actor?.email ?? String(auth.session.user?.user_email ?? 'unknown'),
    action: 'master.access_control.updated',
    target: 'role-module-visibility',
    details: 'Updated system role privileges matrix.',
  });

  return NextResponse.json({
    ok: true,
    roles,
    modules: CONTROL_CENTER_MODULE_KEYS,
    actions: MASTER_PERMISSION_ACTIONS,
    roleModuleVisibility: Object.fromEntries(
      roles.map((role) => [
        role,
        Object.fromEntries(
          CONTROL_CENTER_MODULE_KEYS.map((moduleKey) => [moduleKey, Boolean(next.controlCenterRoleVisibility[role]?.[moduleKey])]),
        ),
      ]),
    ),
    roleActionPermissions: buildResolvedActionPermissions(next, roles),
  });
}
