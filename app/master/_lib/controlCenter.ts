import { readAdminStore, type WorkspaceOrchestration } from '@/lib/adminStore';

export interface ControlCenterClient {
  id: string;
  name: string;
  email: string;
  workspaceCount: number;
  countries: string[];
  statuses: string[];
}

function normalize(str: unknown): string {
  return String(str ?? '').trim();
}

function websiteTypeLabel(type?: string): string {
  if (type === 'NEW_WEBSITE') return 'New Website';
  if (type === 'EXISTING_WEBSITE') return 'Existing Website';
  if (type === 'CUSTOM_HEADLESS') return 'Custom / Headless';
  return 'Not set';
}

function hasSupportBlocker(workspace: WorkspaceOrchestration): boolean {
  if (!workspace.supportRequired) return false;
  return workspace.supportAssignment?.status !== 'ASSIGNED';
}

function hasConnectorBlocker(workspace: WorkspaceOrchestration): boolean {
  if (workspace.websiteType !== 'EXISTING_WEBSITE') return false;
  return workspace.connectorStatus !== 'CONNECTED';
}

function hasDeploymentBlocker(workspace: WorkspaceOrchestration): boolean {
  return workspace.missingRequirements.length > 0 || hasSupportBlocker(workspace) || hasConnectorBlocker(workspace);
}

export async function getControlCenterSnapshot() {
  const store = await readAdminStore();
  const workspaces = Object.values(store.cloud.workspaces).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const clientMap = new Map<string, ControlCenterClient>();
  for (const workspace of workspaces) {
    const profile = (workspace.businessProfile ?? {}) as Record<string, unknown>;
    const email = normalize(profile.contactEmail).toLowerCase();
    const name = normalize(profile.businessName || workspace.name) || workspace.name;
    const key = email || name.toLowerCase() || workspace.id;

    const existing = clientMap.get(key);
    if (!existing) {
      clientMap.set(key, {
        id: key,
        name,
        email: email || 'n/a',
        workspaceCount: 1,
        countries: [workspace.country],
        statuses: [workspace.status],
      });
      continue;
    }

    existing.workspaceCount += 1;
    if (!existing.countries.includes(workspace.country)) existing.countries.push(workspace.country);
    if (!existing.statuses.includes(workspace.status)) existing.statuses.push(workspace.status);
  }

  const clients = Array.from(clientMap.values()).sort((a, b) => a.name.localeCompare(b.name));

  const pendingDeployments = workspaces.filter((workspace) => {
    return workspace.onboardingStatus === 'DEPLOYING' || workspace.status === 'onboarding' || workspace.status === 'draft';
  }).length;

  const openSupportAssignments = workspaces.filter((workspace) => workspace.supportRequired && workspace.supportAssignment?.status !== 'ASSIGNED').length;
  const launchBlockers = workspaces.filter((workspace) => hasDeploymentBlocker(workspace)).length;
  const connectedWebsites = workspaces.filter((workspace) => workspace.connectorStatus === 'CONNECTED').length;
  const failedDeployments = workspaces.filter((workspace) => {
    return workspace.status === 'blocked' || workspace.onboardingStatus === 'FAILED' || workspace.connectorStatus === 'FAILED';
  }).length;

  const connectorCounts = {
    connected: workspaces.filter((workspace) => workspace.connectorStatus === 'CONNECTED').length,
    pending: workspaces.filter((workspace) => workspace.connectorStatus === 'PENDING_VERIFICATION' || workspace.connectorStatus === 'TOKEN_GENERATED').length,
    failed: workspaces.filter((workspace) => workspace.connectorStatus === 'FAILED').length,
    unconfigured: workspaces.filter((workspace) => !workspace.connectorStatus || workspace.connectorStatus === 'NOT_CONNECTED').length,
  };

  return {
    accountPlan: store.cloud.accountPlan,
    workspaceLimit: store.cloud.accountPlan === 'starter' ? 1 : store.cloud.accountPlan === 'business' ? 3 : 999,
    workspaces,
    clients,
    metrics: {
      totalClients: clients.length,
      activeWorkspaces: workspaces.length,
      pendingDeployments,
      openSupportAssignments,
      launchBlockers,
      connectedWebsites,
      failedDeployments,
    },
    audit: store.audit,
    maintenance: store.maintenance,
    roleVisibility: store.roleModuleVisibility,
    connectorCounts,
    templatesInUse: workspaces.filter((workspace) => Boolean(normalize(workspace.selectedTemplateId))).length,
    websiteTypeBreakdown: {
      newWebsite: workspaces.filter((workspace) => workspace.websiteType === 'NEW_WEBSITE').length,
      existingWebsite: workspaces.filter((workspace) => workspace.websiteType === 'EXISTING_WEBSITE').length,
      customHeadless: workspaces.filter((workspace) => workspace.websiteType === 'CUSTOM_HEADLESS').length,
    },
    websiteTypeLabel,
  };
}
