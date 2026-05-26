import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import {
  getSession,
  hasClientMasterAccess,
  hasInternalMasterAccess,
  isAdmin,
  isSuperAdmin,
  resolveSessionMarveoRoles,
  type MarveoRole,
} from '@/lib/auth';
import MasterSidebar from '@/components/MasterSidebar';
import SessionInactivityGuard from '@/components/SessionInactivityGuard';
import { CONTROL_CENTER_MODULE_KEYS, readAdminStore, type ControlCenterModuleKey } from '@/lib/adminStore';
import { resolveMasterRoleDashboard, type MasterInternalRole } from '@/lib/master/roleDashboard';
import { resolveRequiredModuleForPath } from './_lib/moduleAccess';
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

function roleLabel(role: string | null): string {
  const normalized = String(role || '').trim();
  if (!normalized) return '';
  return normalized
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default async function MasterLayout({ children }: { children: React.ReactNode }) {
  const isDev = process.env.NODE_ENV !== 'production';
  const session = await getSession();
  if (!session) {
    const target = isDev ? '/master-login?error=auth_required&from=/master' : '/master-login';
    redirect(target);
  }
  if ((session.user as { requirePasswordChange?: boolean } | null)?.requirePasswordChange) {
    redirect('/password/change?surface=master&firstLogin=1');
  }

  const roleContext = await resolveSessionMarveoRoles(session.user);
  const roles = roleContext.marveoRoles;

  // Clients can never access /master.
  // If a user is both a client and internal, internal access takes priority.
  if (hasClientMasterAccess(roles) && !hasInternalMasterAccess(roles)) {
    redirect('/portal');
  }

  const admin = await isAdmin(session.token);
  if (!admin) {
    const base = '/master-login?error=unauthorized&from=/master';
    const withRoles = isDev ? `${base}&roles=${encodeURIComponent(roleContext.rawRoles.join(','))}&marveoRoles=${encodeURIComponent(roles.join(','))}` : '/master-login?error=unauthorized';
    redirect(withRoles);
  }

  const superAdmin = await isSuperAdmin(session.token);
  const store = await readAdminStore();
  const effectiveRole = resolveEffectiveInternalRole(roleContext.masterRole, roles);
  const dashboard = effectiveRole ? resolveMasterRoleDashboard(effectiveRole) : null;
  const resolvedRoleLabel = roleLabel(roleContext.masterRole || effectiveRole);

  const allowedModules: ControlCenterModuleKey[] = (() => {
    if (superAdmin) return [...CONTROL_CENTER_MODULE_KEYS];
    if (!effectiveRole || !dashboard) return [];

    const configured = CONTROL_CENTER_MODULE_KEYS.filter((moduleKey) => {
      const permissions = resolveModuleActionPermissions({
        role: effectiveRole,
        moduleKey,
        moduleVisibility: Boolean(store.controlCenterRoleVisibility[effectiveRole]?.[moduleKey]),
        storedActionPermissions: store.controlCenterRoleActionPermissions[effectiveRole]?.[moduleKey],
      });
      return permissions.view;
    });
    const configuredSet = new Set(configured);

    // Enforce baseline (code) + configured (store). Store can reduce, but cannot expand beyond baseline.
    return dashboard.allowedModulesBaseline.filter((moduleKey) => configuredSet.has(moduleKey));
  })();

  const requestHeaders = await headers();
  const currentPath = requestHeaders.get('x-marveo-pathname') ?? '/master';
  const requiredModule = resolveRequiredModuleForPath(currentPath);
  const notifications: Array<{ id: string; tone: 'amber' | 'blue'; text: string }> = [];

  if (requiredModule && !allowedModules.includes(requiredModule)) {
    redirect('/master?error=module_access_denied');
  }

  if (store.maintenance.site_under_construction) {
    notifications.push({
      id: 'maintenance',
      tone: 'amber',
      text: store.maintenance.under_construction_title || 'System maintenance mode is active.',
    });
  }

  if (currentPath.includes('error=module_access_denied')) {
    notifications.push({
      id: 'module-access',
      tone: 'amber',
      text: 'Access denied for this module based on your internal role permissions.',
    });
  }

  if (!superAdmin) {
    notifications.push({
      id: 'limited-role',
      tone: 'blue',
      text: 'Limited internal role detected: some sections may be read-only.',
    });
  }

  return (
    <div className="flex flex-col md:flex-row h-screen overflow-y-hidden overflow-x-visible bg-gray-50">
      <MasterSidebar
        displayName={session.user?.user_display_name ?? 'Admin'}
        email={session.user?.user_email ?? ''}
        allowedModules={allowedModules}
        dashboardLogoUrl={store.platformSettings.branding.dashboardLogoUrl || store.platformSettings.branding.logoUrl || ''}
        brandName={store.platformSettings.branding.brandName || 'Marveo'}
        navItems={dashboard?.sidebar}
        surfaceLabel="Control Center"
        roleLabel={resolvedRoleLabel}
        isSuperAdmin={superAdmin}
      />
      <main className="flex-1 overflow-auto pt-16 md:pt-0">
        <SessionInactivityGuard
          enabled={store.platformSettings.sessionSecurity.inactivityEnabled}
          idleTimeoutMinutes={store.platformSettings.sessionSecurity.idleTimeoutMinutes}
          idleWarningMinutes={store.platformSettings.sessionSecurity.idleWarningMinutes}
          loginRedirectPath="/master-login?reason=inactive"
        />
        {notifications.map((notice) => (
          <div
            key={notice.id}
            className={`border-b px-4 py-2 text-xs md:px-8 ${notice.tone === 'amber' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-blue-200 bg-blue-50 text-blue-900'}`}
          >
            {notice.text}
          </div>
        ))}
        <div className="p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}
