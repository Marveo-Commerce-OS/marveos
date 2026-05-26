export const MASTER_PERMISSION_ACTIONS = [
  'view',
  'create',
  'update',
  'delete',
  'assign',
  'approve',
  'export',
] as const;

export type MasterPermissionAction = (typeof MASTER_PERMISSION_ACTIONS)[number];

export const MASTER_PERMISSION_ACTION_SET = new Set<string>(MASTER_PERMISSION_ACTIONS);
