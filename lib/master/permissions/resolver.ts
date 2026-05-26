import {
  CONTROL_CENTER_MODULE_KEYS,
  type ControlCenterModuleKey,
  type ControlCenterRoleActionPermissions,
} from '@/lib/adminStore';
import type { MasterInternalRole } from '@/lib/master/roleDashboard';
import { MASTER_PERMISSION_ACTIONS, type MasterPermissionAction } from './actions';
import type {
  MasterRoleActionPermissionMatrix,
  ModuleActionPermissions,
  RoleModuleActionPermissions,
  StoredRoleModuleActionPermissions,
} from './types';

export const MASTER_INTERNAL_ROLES: MasterInternalRole[] = [
  'SUPER_ADMIN',
  'ADMIN',
  'CUSTOMER_SUPPORT',
  'TECHNICAL_SUPPORT',
  'DEPLOYMENT_MANAGER',
  'BILLING_MANAGER',
];

function emptyActionPermissions(): ModuleActionPermissions {
  return {
    view: false,
    create: false,
    update: false,
    delete: false,
    assign: false,
    approve: false,
    export: false,
  };
}

function fullActionPermissions(): ModuleActionPermissions {
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

function operationalEditorPermissions(): ModuleActionPermissions {
  return {
    view: true,
    create: true,
    update: true,
    delete: false,
    assign: true,
    approve: false,
    export: true,
  };
}

export function legacyBooleanToSafeActionPermissions(enabled: boolean): ModuleActionPermissions {
  const next = emptyActionPermissions();
  next.view = Boolean(enabled);
  return next;
}

function createRolePermissionTemplate(base: ModuleActionPermissions): RoleModuleActionPermissions {
  return Object.fromEntries(
    CONTROL_CENTER_MODULE_KEYS.map((moduleKey) => [moduleKey, { ...base }]),
  ) as RoleModuleActionPermissions;
}

export const DEFAULT_ROLE_ACTION_PERMISSION_MATRIX: MasterRoleActionPermissionMatrix = (() => {
  const superAdmin = createRolePermissionTemplate(fullActionPermissions());

  const admin = createRolePermissionTemplate(emptyActionPermissions());
  const adminOperationalModules: ControlCenterModuleKey[] = [
    'overview',
    'clients',
    'workspaces',
    'deploymentQueue',
    'supportQueue',
    'tickets',
    'knowledgeCenter',
    'definedReplies',
    'launchReadiness',
    'finance',
    'reports',
  ];
  for (const moduleKey of adminOperationalModules) {
    admin[moduleKey] = { ...operationalEditorPermissions() };
  }
  admin.deploymentQueue.approve = true;
  admin.launchReadiness.approve = true;

  const customerSupport = createRolePermissionTemplate(emptyActionPermissions());
  customerSupport.overview = legacyBooleanToSafeActionPermissions(true);
  customerSupport.tickets = {
    view: true,
    create: true,
    update: true,
    delete: false,
    assign: false,
    approve: false,
    export: true,
  };
  customerSupport.supportQueue = {
    view: true,
    create: true,
    update: true,
    delete: false,
    assign: false,
    approve: false,
    export: false,
  };
  customerSupport.definedReplies = {
    view: true,
    create: true,
    update: true,
    delete: false,
    assign: false,
    approve: false,
    export: false,
  };
  customerSupport.knowledgeCenter = {
    view: true,
    create: true,
    update: true,
    delete: false,
    assign: false,
    approve: false,
    export: true,
  };

  const technicalSupport = createRolePermissionTemplate(emptyActionPermissions());
  technicalSupport.overview = legacyBooleanToSafeActionPermissions(true);
  technicalSupport.workspaces = legacyBooleanToSafeActionPermissions(true);
  technicalSupport.tickets = {
    view: true,
    create: false,
    update: true,
    delete: false,
    assign: true,
    approve: false,
    export: false,
  };
  technicalSupport.supportQueue = {
    view: true,
    create: false,
    update: true,
    delete: false,
    assign: true,
    approve: false,
    export: false,
  };
  technicalSupport.launchReadiness = {
    view: true,
    create: false,
    update: true,
    delete: false,
    assign: true,
    approve: false,
    export: false,
  };
  technicalSupport.deploymentQueue = {
    view: true,
    create: false,
    update: true,
    delete: false,
    assign: true,
    approve: false,
    export: false,
  };
  technicalSupport.connectors = {
    view: true,
    create: false,
    update: true,
    delete: false,
    assign: true,
    approve: false,
    export: false,
  };
  technicalSupport.knowledgeCenter = legacyBooleanToSafeActionPermissions(true);

  const deploymentManager = createRolePermissionTemplate(emptyActionPermissions());
  deploymentManager.overview = legacyBooleanToSafeActionPermissions(true);
  deploymentManager.workspaces = {
    view: true,
    create: false,
    update: true,
    delete: false,
    assign: true,
    approve: false,
    export: true,
  };
  deploymentManager.supportQueue = {
    view: true,
    create: false,
    update: true,
    delete: false,
    assign: true,
    approve: false,
    export: false,
  };
  deploymentManager.deploymentQueue = {
    view: true,
    create: false,
    update: true,
    delete: false,
    assign: true,
    approve: true,
    export: true,
  };
  deploymentManager.launchReadiness = {
    view: true,
    create: false,
    update: true,
    delete: false,
    assign: true,
    approve: true,
    export: true,
  };
  deploymentManager.templates = legacyBooleanToSafeActionPermissions(true);
  deploymentManager.knowledgeCenter = legacyBooleanToSafeActionPermissions(true);

  const billingManager = createRolePermissionTemplate(emptyActionPermissions());
  billingManager.overview = legacyBooleanToSafeActionPermissions(true);
  billingManager.clients = legacyBooleanToSafeActionPermissions(true);
  billingManager.reports = {
    view: true,
    create: false,
    update: false,
    delete: false,
    assign: false,
    approve: false,
    export: true,
  };
  billingManager.tickets = {
    view: true,
    create: false,
    update: true,
    delete: false,
    assign: false,
    approve: false,
    export: false,
  };
  billingManager.knowledgeCenter = legacyBooleanToSafeActionPermissions(true);
  billingManager.plansBilling = {
    view: true,
    create: false,
    update: true,
    delete: false,
    assign: false,
    approve: true,
    export: true,
  };
  billingManager.finance = {
    view: true,
    create: true,
    update: true,
    delete: false,
    assign: false,
    approve: true,
    export: true,
  };

  return {
    SUPER_ADMIN: superAdmin,
    ADMIN: admin,
    CUSTOMER_SUPPORT: customerSupport,
    TECHNICAL_SUPPORT: technicalSupport,
    DEPLOYMENT_MANAGER: deploymentManager,
    BILLING_MANAGER: billingManager,
  };
})();

export function getDefaultActionPermissions(role: MasterInternalRole, moduleKey: ControlCenterModuleKey): ModuleActionPermissions {
  return { ...DEFAULT_ROLE_ACTION_PERMISSION_MATRIX[role][moduleKey] };
}

export function sanitizeStoredActionPermissionMap(
  input: unknown,
): StoredRoleModuleActionPermissions {
  const payload = input && typeof input === 'object'
    ? (input as StoredRoleModuleActionPermissions)
    : {};

  return Object.fromEntries(
    MASTER_INTERNAL_ROLES.map((role) => [
      role,
      Object.fromEntries(
        CONTROL_CENTER_MODULE_KEYS.map((moduleKey) => {
          const actionPayload = payload[role]?.[moduleKey] || {};
          const sanitized = Object.fromEntries(
            MASTER_PERMISSION_ACTIONS.map((action) => [action, Boolean(actionPayload[action])]),
          ) as Record<MasterPermissionAction, boolean>;
          return [moduleKey, sanitized];
        }),
      ),
    ]),
  ) as StoredRoleModuleActionPermissions;
}

export function createDefaultStoredActionPermissionMap(): ControlCenterRoleActionPermissions {
  return Object.fromEntries(
    MASTER_INTERNAL_ROLES.map((role) => [
      role,
      Object.fromEntries(
        CONTROL_CENTER_MODULE_KEYS.map((moduleKey) => [
          moduleKey,
          { ...DEFAULT_ROLE_ACTION_PERMISSION_MATRIX[role][moduleKey] },
        ]),
      ),
    ]),
  ) as ControlCenterRoleActionPermissions;
}

export function resolveModuleActionPermissions(input: {
  role: MasterInternalRole;
  moduleKey: ControlCenterModuleKey;
  moduleVisibility: boolean;
  storedActionPermissions?: Partial<Record<MasterPermissionAction, boolean>>;
}): ModuleActionPermissions {
  const defaults = getDefaultActionPermissions(input.role, input.moduleKey);
  const explicit = input.storedActionPermissions;

  if (!explicit) {
    return input.moduleVisibility
      ? defaults
      : legacyBooleanToSafeActionPermissions(false);
  }

  return {
    view: explicit.view ?? (input.moduleVisibility ? defaults.view : false),
    create: explicit.create ?? defaults.create,
    update: explicit.update ?? defaults.update,
    delete: explicit.delete ?? defaults.delete,
    assign: explicit.assign ?? defaults.assign,
    approve: explicit.approve ?? defaults.approve,
    export: explicit.export ?? defaults.export,
  };
}
