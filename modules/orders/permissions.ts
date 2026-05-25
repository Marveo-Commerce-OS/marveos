import { requireSubscriptionEntitlement, requireWorkspaceAccess } from '@/lib/permissions/access';

export async function requireOrdersWorkspaceMutation(input: {
  workspaceId: string;
  subscriptionId?: string;
}) {
  const workspaceAccess = await requireWorkspaceAccess(input.workspaceId);
  if ('error' in workspaceAccess) return workspaceAccess;

  if (input.subscriptionId) {
    const entitlement = await requireSubscriptionEntitlement(input.subscriptionId);
    if ('error' in entitlement) return entitlement;
  }

  return workspaceAccess;
}
