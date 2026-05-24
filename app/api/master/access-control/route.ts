import { NextRequest, NextResponse } from 'next/server';
import { CONTROL_CENTER_MODULE_KEYS, appendAuditLog, readAdminStore, updateAdminStore } from '@/lib/adminStore';
import { getCurrentPlatformUser, getSession, isAdmin, isSuperAdmin } from '@/lib/auth';

const MARVEO_ROLES = [
  'SUPER_ADMIN',
  'ADMIN',
  'SUPPORT_OFFICER',
  'DEPLOYMENT_MANAGER',
  'BILLING_MANAGER',
] as const;

type MarveoRole = (typeof MARVEO_ROLES)[number];
type ModuleKey = (typeof CONTROL_CENTER_MODULE_KEYS)[number];

type RoleModuleVisibilityPayload = Partial<Record<MarveoRole, Partial<Record<ModuleKey, boolean>>>>;

async function ensureAdminSession() {
  const session = await getSession();
  if (!session) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const admin = await isAdmin(session.token);
  if (!admin) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { session };
}

function sanitizeRoleModuleVisibility(input: unknown) {
  const payload = (input && typeof input === 'object')
    ? (input as RoleModuleVisibilityPayload)
    : {};

  return Object.fromEntries(
    MARVEO_ROLES.map((role) => [
      role,
      Object.fromEntries(
        CONTROL_CENTER_MODULE_KEYS.map((moduleKey) => [moduleKey, Boolean(payload[role]?.[moduleKey])]),
      ),
    ]),
  );
}

export async function GET() {
  const auth = await ensureAdminSession();
  if ('error' in auth) return auth.error;

  const store = await readAdminStore();
  const roleModuleVisibility = Object.fromEntries(
    MARVEO_ROLES.map((role) => [
      role,
      Object.fromEntries(
        CONTROL_CENTER_MODULE_KEYS.map((moduleKey) => [moduleKey, Boolean(store.controlCenterRoleVisibility[role]?.[moduleKey])]),
      ),
    ]),
  );

  return NextResponse.json({
    roles: MARVEO_ROLES,
    modules: CONTROL_CENTER_MODULE_KEYS,
    roleModuleVisibility,
  });
}

export async function PATCH(req: NextRequest) {
  const auth = await ensureAdminSession();
  if ('error' in auth) return auth.error;

  const canEdit = await isSuperAdmin(auth.session.token);
  if (!canEdit) {
    return NextResponse.json({ error: 'Only super admins can update access control.' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const roleModuleVisibility = sanitizeRoleModuleVisibility((body as { roleModuleVisibility?: unknown }).roleModuleVisibility);

  const next = await updateAdminStore((current) => ({
    ...current,
    controlCenterRoleVisibility: {
      ...current.controlCenterRoleVisibility,
      ...roleModuleVisibility,
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
    roles: MARVEO_ROLES,
    modules: CONTROL_CENTER_MODULE_KEYS,
    roleModuleVisibility: Object.fromEntries(
      MARVEO_ROLES.map((role) => [
        role,
        Object.fromEntries(
          CONTROL_CENTER_MODULE_KEYS.map((moduleKey) => [moduleKey, Boolean(next.controlCenterRoleVisibility[role]?.[moduleKey])]),
        ),
      ]),
    ),
  });
}
