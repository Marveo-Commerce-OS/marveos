import { NextRequest, NextResponse } from 'next/server';
import { readAdminStore, type WorkspaceOrchestration } from '@/lib/adminStore';
import { hasInternalPlatformAccess } from '@/lib/auth';
import { requireOSAccess } from '@/lib/permissions/access';
import { hasProfessionConfig, resolveProfessionConfig } from '@/config/professions';
import { buildWorkspaceDashboardSummary } from '@/modules/reports';

function resolveWorkspaceForRequest(input: {
  requestedWorkspaceId?: string;
  sessionUserId: string;
  internal: boolean;
  workspaces: WorkspaceOrchestration[];
  users: Record<string, { assignedWorkspaceId?: string }>;
}): WorkspaceOrchestration | null {
  const byId = new Map(input.workspaces.map((workspace) => [workspace.id, workspace]));

  const assignedWorkspaceId = input.users[input.sessionUserId]?.assignedWorkspaceId;

  if (input.requestedWorkspaceId) {
    const requested = byId.get(input.requestedWorkspaceId) || null;
    if (!requested) return null;
    if (!input.internal && assignedWorkspaceId && assignedWorkspaceId !== requested.id) return null;
    if (!input.internal && !assignedWorkspaceId) return null;
    return requested;
  }

  if (!input.internal) {
    if (!assignedWorkspaceId) return null;
    return byId.get(assignedWorkspaceId) || null;
  }

  return input.workspaces[0] || null;
}

function explicitProfessionKey(workspace: WorkspaceOrchestration): string | undefined {
  const profile = (workspace.businessProfile || {}) as Record<string, unknown>;
  const collected = (workspace.collectedBusinessData || {}) as Record<string, unknown>;
  const key = String(profile.professionKey || collected.professionKey || '').trim().toLowerCase();
  return key || undefined;
}

export async function GET(req: NextRequest) {
  const access = await requireOSAccess();
  if ('error' in access) return access.error;

  const store = await readAdminStore();
  const workspaces = Object.values(store.cloud.workspaces).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const requestedWorkspaceId = new URL(req.url).searchParams.get('workspaceId')?.trim() || undefined;
  const sessionUserId = String(access.session.user?.id ?? access.session.user?.ID ?? '').trim();
  const internal = hasInternalPlatformAccess(access.roles);

  const workspace = resolveWorkspaceForRequest({
    requestedWorkspaceId,
    sessionUserId,
    internal,
    workspaces,
    users: store.users as Record<string, { assignedWorkspaceId?: string }>,
  });

  if (!workspace) {
    return NextResponse.json({
      workspaceId: requestedWorkspaceId || '',
      professionKey: 'generic-service-business',
      professionName: 'Service Business',
      widgets: {
        todaysBookings: { count: 0, items: [] },
        pendingDeposits: { count: 0, amount: 0, currency: 'USD', items: [] },
        newEnquiries: { count: 0, items: [] },
        whatsappStatus: { connected: false, label: 'Not connected yet' },
        aiAssistantStatus: { enabled: false, label: 'Not enabled yet' },
        revenueSnapshot: { today: 0, month: 0, currency: 'USD' },
        onboardingChecklist: { total: 0, completed: 0, items: [] },
      },
      quickActions: [],
    }, { status: 200 });
  }

  const requestedProfessionKey = explicitProfessionKey(workspace);
  const known = requestedProfessionKey ? hasProfessionConfig(requestedProfessionKey) : false;
  const profession = resolveProfessionConfig(known ? requestedProfessionKey : undefined);

  const summary = buildWorkspaceDashboardSummary({
    workspace,
    professionKey: profession.key,
    professionName: profession.professionName,
  });

  return NextResponse.json(summary);
}
