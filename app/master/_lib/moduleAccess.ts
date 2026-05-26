import type { ControlCenterModuleKey } from '@/lib/adminStore';

const MODULE_ROUTE_PREFIXES: Array<{ module: ControlCenterModuleKey; prefixes: string[] }> = [
  { module: 'clients', prefixes: ['/master/clients'] },
  { module: 'workspaces', prefixes: ['/master/workspaces'] },
  { module: 'deploymentQueue', prefixes: ['/master/mvp-deployments', '/master/deployment'] },
  { module: 'supportQueue', prefixes: ['/master/support', '/master/support-center', '/master/support-sessions'] },
  {
    module: 'tickets',
    prefixes: [
      '/master/tickets',
      '/master/complaints',
      '/master/client-enquiries',
      '/master/technical-tickets',
      '/master/website-support-requests',
      '/master/whatsapp-integration-requests',
      '/master/awaiting-client-response',
      '/master/escalated-tickets',
      '/master/payment-issues',
    ],
  },
  { module: 'definedReplies', prefixes: ['/master/defined-replies'] },
  { module: 'launchReadiness', prefixes: ['/master/launch-readiness'] },
  { module: 'connectors', prefixes: ['/master/connectors'] },
  { module: 'templates', prefixes: ['/master/templates'] },
  { module: 'team', prefixes: ['/master/team'] },
  { module: 'finance', prefixes: ['/master/finance'] },
  { module: 'plansBilling', prefixes: ['/master/billing'] },
  { module: 'reports', prefixes: ['/master/reports'] },
  { module: 'analytics', prefixes: ['/master/analytics'] },
  { module: 'auditLogs', prefixes: ['/master/audit-logs'] },
  { module: 'systemSettings', prefixes: ['/master/system-settings', '/master/settings', '/master/admin-settings', '/master/system-map'] },
  { module: 'rolePrivileges', prefixes: ['/master/role-privileges'] },
];

export function resolveRequiredModuleForPath(pathname: string): ControlCenterModuleKey | null {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  if (normalized === '/master') return 'overview';

  for (const { module, prefixes } of MODULE_ROUTE_PREFIXES) {
    for (const prefix of prefixes) {
      if (normalized === prefix || normalized.startsWith(`${prefix}/`)) {
        return module;
      }
    }
  }

  return null;
}
