import type { ControlCenterModuleKey } from '@/lib/adminStore';
import type { MasterInternalRole } from '@/lib/master/roleDashboard';
import type { MasterPermissionAction } from './actions';

export type ModuleActionPermissions = Record<MasterPermissionAction, boolean>;

export type RoleModuleActionPermissions = Record<ControlCenterModuleKey, ModuleActionPermissions>;

export type MasterRoleActionPermissionMatrix = Record<MasterInternalRole, RoleModuleActionPermissions>;

export type StoredRoleModuleActionPermissions = Record<
  string,
  Partial<Record<ControlCenterModuleKey, Partial<Record<MasterPermissionAction, boolean>>>>
>;
