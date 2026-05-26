import { NextResponse } from 'next/server';
import {
  getSession,
  isAdmin,
  isSuperAdmin,
  resolveSessionMarveoRoles,
  type MarveoRole,
} from '@/lib/auth';
import { readAdminStore, type ControlCenterModuleKey } from '@/lib/adminStore';
import { resolveMasterRoleDashboard, type MasterInternalRole } from '@/lib/master/roleDashboard';
import { resolveModuleActionPermissions } from '@/lib/master/permissions/resolver';

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

type ModuleAccessContext = {
  session: NonNullable<Awaited<ReturnType<typeof getSession>>>;
  effectiveRole: MasterInternalRole;
  superAdmin: boolean;
};

type ModuleAccessResult =
  | { error: NextResponse }
  | ModuleAccessContext;

export async function enforceMasterModuleAccess(moduleKey: ControlCenterModuleKey): Promise<ModuleAccessResult> {
  const session = await getSession();
  if (!session) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const admin = await isAdmin(session.token);
  if (!admin) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  const superAdmin = await isSuperAdmin(session.token);
  const roleContext = await resolveSessionMarveoRoles(session.user);
  const effectiveRole = superAdmin
    ? ('SUPER_ADMIN' as const)
    : resolveEffectiveInternalRole(roleContext.masterRole, roleContext.marveoRoles);

  if (!effectiveRole) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  if (superAdmin) {
    return { session, effectiveRole, superAdmin: true };
  }

  const dashboard = resolveMasterRoleDashboard(effectiveRole);
  const store = await readAdminStore();
  const baselineAllowed = dashboard.allowedModulesBaseline.includes(moduleKey);
  const modulePermissions = resolveModuleActionPermissions({
    role: effectiveRole,
    moduleKey,
    moduleVisibility: Boolean(store.controlCenterRoleVisibility[effectiveRole]?.[moduleKey]),
    storedActionPermissions: store.controlCenterRoleActionPermissions[effectiveRole]?.[moduleKey],
  });
  const configuredAllowed = Boolean(modulePermissions.view);

  if (!baselineAllowed || !configuredAllowed) {
    return {
      error: NextResponse.json(
        { error: 'Forbidden', reason: 'module_access_denied', module: moduleKey },
        { status: 403 },
      ),
    };
  }

  return { session, effectiveRole, superAdmin: false };
}