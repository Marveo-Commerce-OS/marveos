import { NextResponse } from 'next/server';
import {
  CONTROL_CENTER_MODULE_KEYS,
  readAdminStore,
  type ControlCenterModuleKey,
} from '@/lib/adminStore';
import {
  getSession,
  isAdmin,
  isSuperAdmin,
  resolveSessionMarveoRoles,
  type MarveoRole,
} from '@/lib/auth';
import { resolveMasterRoleDashboard, type MasterInternalRole } from '@/lib/master/roleDashboard';
import type { MasterPermissionAction } from './actions';
import { resolveModuleActionPermissions } from './resolver';
import type { ModuleActionPermissions } from './types';

const INTERNAL_ROLE_PRIORITY: MasterInternalRole[] = [
  'SUPER_ADMIN',
  'ADMIN',
  'TECHNICAL_SUPPORT',
  'CUSTOMER_SUPPORT',
  'DEPLOYMENT_MANAGER',
  'BILLING_MANAGER',
];

function resolveEffectiveInternalRole(masterRole: MarveoRole | null, marveoRoles: MarveoRole[]): MasterInternalRole | null {
  if (masterRole && INTERNAL_ROLE_PRIORITY.includes(masterRole as MasterInternalRole)) {
    return masterRole as MasterInternalRole;
  }

  for (const role of INTERNAL_ROLE_PRIORITY) {
    if (marveoRoles.includes(role)) {
      return role;
    }
  }

  return null;
}

type GuardContext = {
  session: NonNullable<Awaited<ReturnType<typeof getSession>>>;
  effectiveRole: MasterInternalRole;
  modulePermissions: ModuleActionPermissions;
  superAdmin: boolean;
};

type GuardResult =
  | { error: NextResponse }
  | GuardContext;

export async function resolveRoleModulePermissions(
  role: MasterInternalRole,
  moduleKey: ControlCenterModuleKey,
): Promise<ModuleActionPermissions> {
  const store = await readAdminStore();
  const moduleVisibility = Boolean(store.controlCenterRoleVisibility[role]?.[moduleKey]);
  return resolveModuleActionPermissions({
    role,
    moduleKey,
    moduleVisibility,
    storedActionPermissions: store.controlCenterRoleActionPermissions[role]?.[moduleKey],
  });
}

export async function hasModuleAccess(
  role: MasterInternalRole,
  moduleKey: ControlCenterModuleKey,
): Promise<boolean> {
  if (!CONTROL_CENTER_MODULE_KEYS.includes(moduleKey)) return false;
  const perms = await resolveRoleModulePermissions(role, moduleKey);
  return perms.view;
}

export async function hasActionPermission(
  role: MasterInternalRole,
  moduleKey: ControlCenterModuleKey,
  action: MasterPermissionAction,
): Promise<boolean> {
  if (!CONTROL_CENTER_MODULE_KEYS.includes(moduleKey)) return false;
  const perms = await resolveRoleModulePermissions(role, moduleKey);
  return Boolean(perms[action]);
}

export async function requireActionPermission(
  moduleKey: ControlCenterModuleKey,
  action: MasterPermissionAction,
): Promise<GuardResult> {
  const session = await getSession();
  if (!session) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const admin = await isAdmin(session.token);
  if (!admin) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  const superAdmin = await isSuperAdmin(session.token);
  if (superAdmin) {
    return {
      session,
      effectiveRole: 'SUPER_ADMIN',
      modulePermissions: {
        view: true,
        create: true,
        update: true,
        delete: true,
        assign: true,
        approve: true,
        export: true,
      },
      superAdmin: true,
    };
  }

  const roleContext = await resolveSessionMarveoRoles(session.user);
  const effectiveRole = resolveEffectiveInternalRole(roleContext.masterRole, roleContext.marveoRoles);
  if (!effectiveRole) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  const dashboard = resolveMasterRoleDashboard(effectiveRole);
  if (!dashboard.allowedModulesBaseline.includes(moduleKey)) {
    return {
      error: NextResponse.json({ error: 'Forbidden', reason: 'module_baseline_denied' }, { status: 403 }),
    };
  }

  const modulePermissions = await resolveRoleModulePermissions(effectiveRole, moduleKey);
  if (!modulePermissions[action]) {
    return {
      error: NextResponse.json(
        { error: 'Forbidden', reason: 'action_permission_denied', module: moduleKey, action },
        { status: 403 },
      ),
    };
  }

  return {
    session,
    effectiveRole,
    modulePermissions,
    superAdmin: false,
  };
}
