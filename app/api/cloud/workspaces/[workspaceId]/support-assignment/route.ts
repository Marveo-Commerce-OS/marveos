import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWpUser } from '@/lib/auth';
import {
  appendAuditLog,
  getWorkspaceSupportAssignment,
  readAdminStore,
  setWorkspaceSupportAssignment,
  type WorkspaceOrchestration,
} from '@/lib/adminStore';
import type { SupportAssignmentContract } from '@/src/contexts/support/support-assignment.contract';
import { sendPlatformEmailNotification } from '@/lib/emailNotifications';
import { requireWorkspaceAccess } from '@/lib/permissions/access';
import { requireActionPermission } from '@/lib/master/permissions/guards';
import { upsertOperationalAssignment } from '@/lib/master/operations';

async function ensureAdminSession() {
  return requireActionPermission('supportQueue', 'view');
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function isValidPriority(value: unknown): value is SupportAssignmentContract['priority'] {
  return value === 'LOW' || value === 'MEDIUM' || value === 'HIGH' || value === 'CRITICAL';
}

function isValidSetupType(value: unknown): value is SupportAssignmentContract['setupType'] {
  return value === 'NEW_WEBSITE' || value === 'EXISTING_WEBSITE' || value === 'CUSTOM_HEADLESS';
}

function isValidSupportOfficerType(value: unknown): value is 'CUSTOMER_SUPPORT' | 'TECHNICAL_SUPPORT' {
  return value === 'CUSTOMER_SUPPORT' || value === 'TECHNICAL_SUPPORT';
}

function isValidEscalationStatus(value: unknown): value is 'NONE' | 'REQUESTED' | 'ASSIGNED' | 'RESOLVED' {
  return value === 'NONE' || value === 'REQUESTED' || value === 'ASSIGNED' || value === 'RESOLVED';
}

function buildSupportTicketId(workspaceId: string): string {
  const shortWorkspace = workspaceId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase() || 'WS';
  return `TKT-${Date.now().toString(36).toUpperCase()}-${shortWorkspace}`;
}

function isValidAssignmentStatus(value: unknown): value is NonNullable<NonNullable<Awaited<ReturnType<typeof getWorkspaceSupportAssignment>>>['status']> {
  return value === 'UNASSIGNED'
    || value === 'ASSIGNED'
    || value === 'IN_PROGRESS'
    || value === 'WAITING_FOR_CLIENT'
    || value === 'COMPLETED';
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ workspaceId: string }> },
) {
  const auth = await ensureAdminSession();
  if ('error' in auth) {
    return auth.error;
  }

  const { workspaceId } = await context.params;
  const workspaceAccess = await requireWorkspaceAccess(workspaceId);
  if ('error' in workspaceAccess) return workspaceAccess.error;

  const store = await readAdminStore();
  const workspace = store.cloud.workspaces[workspaceId];

  if (!workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  const assignment = await getWorkspaceSupportAssignment(workspaceId);

  return NextResponse.json({
    workspaceId,
    assignment,
    assignmentStatus: assignment?.status ?? 'UNASSIGNED',
  });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ workspaceId: string }> },
) {
  const auth = await requireActionPermission('supportQueue', 'assign');
  if ('error' in auth) {
    return auth.error;
  }

  const { workspaceId } = await context.params;
  const workspaceAccess = await requireWorkspaceAccess(workspaceId);
  if ('error' in workspaceAccess) return workspaceAccess.error;

  const body = await req.json();

  const clientId = String(body?.clientId || '').trim();
  const priority = body?.priority;
  const reason = String(body?.reason || '').trim();
  const setupType = body?.setupType;
  const requiredSkills = Array.isArray(body?.requiredSkills)
    ? body.requiredSkills.map((item: unknown) => String(item).trim()).filter(Boolean)
    : [];
  const initialNotes = String(body?.initialNotes || '').trim();

  if (!clientId) return badRequest('clientId is required');
  if (!reason) return badRequest('reason is required');
  if (!isValidPriority(priority)) return badRequest('priority must be LOW, MEDIUM, HIGH, or CRITICAL');
  if (!isValidSetupType(setupType)) return badRequest('setupType must be NEW_WEBSITE, EXISTING_WEBSITE, or CUSTOM_HEADLESS');

  const supportOfficerId = body?.supportOfficerId ? String(body.supportOfficerId).trim() : 'placeholder-unassigned';
  const supportOfficerName = body?.supportOfficerName ? String(body.supportOfficerName).trim() : 'Support Queue Placeholder';
  const supportOfficerType = body?.supportOfficerType ?? 'CUSTOMER_SUPPORT';
  if (!isValidSupportOfficerType(supportOfficerType)) {
    return badRequest('supportOfficerType must be CUSTOMER_SUPPORT or TECHNICAL_SUPPORT');
  }

  const ticketId = typeof body?.ticketId === 'string' && body.ticketId.trim()
    ? body.ticketId.trim()
    : buildSupportTicketId(workspaceId);

  const technicalSupportOfficerId = typeof body?.technicalSupportOfficerId === 'string'
    ? body.technicalSupportOfficerId.trim() || undefined
    : undefined;
  const technicalSupportOfficerName = typeof body?.technicalSupportOfficerName === 'string'
    ? body.technicalSupportOfficerName.trim() || undefined
    : undefined;

  const assignmentPayload: SupportAssignmentContract = {
    workspaceId,
    clientId,
    priority,
    reason,
    setupType,
    requiredSkills,
    initialNotes,
  };

  const nextAssignment: NonNullable<WorkspaceOrchestration['supportAssignment']> = {
    status: 'ASSIGNED' as const,
    assignedAt: new Date().toISOString(),
    assignedBy: auth.session.user?.user_email ?? 'unknown',
    supportOfficerId,
    supportOfficerName,
    supportOfficerType,
    ticketId,
    priority,
    reason,
    setupType,
    requiredSkills,
    initialNotes,
    technicalSupportOfficerId,
    technicalSupportOfficerName,
    escalationStatus: technicalSupportOfficerId ? 'ASSIGNED' : 'NONE',
    escalatedAt: technicalSupportOfficerId ? new Date().toISOString() : undefined,
  };

  const updatedWorkspace = await setWorkspaceSupportAssignment(workspaceId, nextAssignment);
  if (!updatedWorkspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  const actor = await getCurrentWpUser(auth.session.token);
  await appendAuditLog({
    actorEmail: actor?.email ?? auth.session.user?.user_email ?? 'unknown',
    action: 'cloud.support.assigned',
    target: workspaceId,
    details: `ticket=${ticketId};priority=${priority};setupType=${setupType};officer=${supportOfficerId};officerType=${supportOfficerType}`,
  });

  const refreshedAfterAssign = await readAdminStore();
  const workspaceAfterAssign = refreshedAfterAssign.cloud.workspaces[workspaceId];
  const contactEmail = String(workspaceAfterAssign?.businessProfile?.contactEmail || '').trim().toLowerCase();
  if (contactEmail) {
    await sendPlatformEmailNotification({
      templateKey: 'SUPPORT_ASSIGNED',
      to: contactEmail,
      variables: {
        clientName: String(workspaceAfterAssign?.businessProfile?.businessName || contactEmail),
        workspaceName: workspaceAfterAssign?.name || workspaceId,
        supportOfficerName,
        workspaceId,
      },
    });
  }

  const supportOfficerEmail = String(
    refreshedAfterAssign.nativeAuth.identities[nextAssignment.supportOfficerId || '']?.email
      || refreshedAfterAssign.platformSettings.email.supportEmail
      || refreshedAfterAssign.platformSettings.email.userOpsEmail
      || '',
  ).trim().toLowerCase();

  if (supportOfficerEmail && supportOfficerEmail !== contactEmail) {
    await sendPlatformEmailNotification({
      templateKey: 'SUPPORT_ASSIGNED_SUPPORT',
      to: supportOfficerEmail,
      variables: {
        supportOfficerName: nextAssignment.supportOfficerName || 'Support Officer',
        workspaceName: workspaceAfterAssign?.name || workspaceId,
        clientEmail: contactEmail || String(workspaceAfterAssign?.businessProfile?.contactEmail || '').trim().toLowerCase(),
        ticketId: nextAssignment.ticketId || 'n/a',
        priority: nextAssignment.priority || 'MEDIUM',
      },
    });
  }

  await upsertOperationalAssignment({
    entityType: 'support_queue',
    entityId: workspaceId,
    workspaceId,
    assignedToUserId: nextAssignment.supportOfficerId || 'unassigned',
    assignedToName: nextAssignment.supportOfficerName || 'Support Queue',
    assignedRole: nextAssignment.supportOfficerType || 'CUSTOMER_SUPPORT',
    assignedBy: actor?.email ?? auth.session.user?.user_email ?? 'unknown',
    assignmentStatus: 'assigned',
    metadata: {
      ticketId: nextAssignment.ticketId,
      priority: nextAssignment.priority,
      setupType: nextAssignment.setupType,
    },
  });

  return NextResponse.json({
    workspaceId,
    assignment: nextAssignment,
    assignmentStatus: 'ASSIGNED',
    payloadAccepted: assignmentPayload,
  });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ workspaceId: string }> },
) {
  const auth = await requireActionPermission('supportQueue', 'update');
  if ('error' in auth) {
    return auth.error;
  }

  const { workspaceId } = await context.params;
  const workspaceAccess = await requireWorkspaceAccess(workspaceId);
  if ('error' in workspaceAccess) return workspaceAccess.error;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return badRequest('Invalid JSON body');
  }

  const store = await readAdminStore();
  const workspace = store.cloud.workspaces[workspaceId];
  if (!workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  const currentAssignment = workspace.supportAssignment ?? {
    status: 'UNASSIGNED' as const,
    assignedAt: undefined,
    assignedBy: undefined,
    supportOfficerId: undefined,
    supportOfficerName: undefined,
    priority: 'MEDIUM' as const,
    reason: undefined,
    setupType: workspace.websiteType ?? 'NEW_WEBSITE',
    requiredSkills: [],
    initialNotes: undefined,
  };

  const nextStatus = body.status ?? currentAssignment.status;
  if (!isValidAssignmentStatus(nextStatus)) {
    return badRequest('status must be UNASSIGNED, ASSIGNED, IN_PROGRESS, WAITING_FOR_CLIENT, or COMPLETED');
  }

  const nextPriority = body.priority ?? currentAssignment.priority;
  if (!isValidPriority(nextPriority)) {
    return badRequest('priority must be LOW, MEDIUM, HIGH, or CRITICAL');
  }

  const nextSetupType = body.setupType ?? currentAssignment.setupType;
  if (!isValidSetupType(nextSetupType)) {
    return badRequest('setupType must be NEW_WEBSITE, EXISTING_WEBSITE, or CUSTOM_HEADLESS');
  }

  const nextOfficerType = body.supportOfficerType ?? currentAssignment.supportOfficerType ?? 'CUSTOMER_SUPPORT';
  if (!isValidSupportOfficerType(nextOfficerType)) {
    return badRequest('supportOfficerType must be CUSTOMER_SUPPORT or TECHNICAL_SUPPORT');
  }

  const requestedEscalationStatus = body.escalationStatus;
  if (requestedEscalationStatus !== undefined && !isValidEscalationStatus(requestedEscalationStatus)) {
    return badRequest('escalationStatus must be NONE, REQUESTED, ASSIGNED, or RESOLVED');
  }

  const nextTechnicalSupportOfficerId = typeof body.technicalSupportOfficerId === 'string'
    ? body.technicalSupportOfficerId.trim() || undefined
    : currentAssignment.technicalSupportOfficerId;
  const nextTechnicalSupportOfficerName = typeof body.technicalSupportOfficerName === 'string'
    ? body.technicalSupportOfficerName.trim() || undefined
    : currentAssignment.technicalSupportOfficerName;

  const computedEscalationStatus = requestedEscalationStatus ?? (
    nextTechnicalSupportOfficerId ? 'ASSIGNED' : (currentAssignment.escalationStatus ?? 'NONE')
  );

  const nextTicketId = typeof body.ticketId === 'string'
    ? (body.ticketId.trim() || currentAssignment.ticketId || buildSupportTicketId(workspaceId))
    : (currentAssignment.ticketId || buildSupportTicketId(workspaceId));

  const nextAssignment: NonNullable<WorkspaceOrchestration['supportAssignment']> = {
    ...currentAssignment,
    status: nextStatus,
    assignedAt: nextStatus === 'UNASSIGNED' ? undefined : (currentAssignment.assignedAt ?? new Date().toISOString()),
    assignedBy: auth.session.user?.user_email ?? currentAssignment.assignedBy,
    supportOfficerId: typeof body.supportOfficerId === 'string'
      ? body.supportOfficerId.trim() || undefined
      : currentAssignment.supportOfficerId,
    supportOfficerName: typeof body.supportOfficerName === 'string'
      ? body.supportOfficerName.trim() || undefined
      : currentAssignment.supportOfficerName,
    supportOfficerType: nextOfficerType,
    ticketId: nextTicketId,
    priority: nextPriority,
    reason: typeof body.reason === 'string' ? (body.reason.trim() || undefined) : currentAssignment.reason,
    setupType: nextSetupType,
    requiredSkills: Array.isArray(body.requiredSkills)
      ? body.requiredSkills.map((item: unknown) => String(item).trim()).filter(Boolean)
      : (currentAssignment.requiredSkills ?? []),
    initialNotes: typeof body.initialNotes === 'string'
      ? (body.initialNotes.trim() || undefined)
      : currentAssignment.initialNotes,
    technicalSupportOfficerId: nextTechnicalSupportOfficerId,
    technicalSupportOfficerName: nextTechnicalSupportOfficerName,
    escalationStatus: nextStatus === 'COMPLETED' && (computedEscalationStatus === 'ASSIGNED' || computedEscalationStatus === 'REQUESTED')
      ? 'RESOLVED'
      : computedEscalationStatus,
    escalatedAt: nextTechnicalSupportOfficerId
      ? (currentAssignment.escalatedAt ?? new Date().toISOString())
      : undefined,
  };

  const updatedWorkspace = await setWorkspaceSupportAssignment(workspaceId, nextAssignment);
  if (!updatedWorkspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  const actor = await getCurrentWpUser(auth.session.token);
  await appendAuditLog({
    actorEmail: actor?.email ?? auth.session.user?.user_email ?? 'unknown',
    action: 'cloud.support.status_changed',
    target: workspaceId,
    details: `ticket=${nextAssignment.ticketId || 'none'};status=${nextStatus};officer=${nextAssignment.supportOfficerId || 'none'};officerType=${nextAssignment.supportOfficerType || 'CUSTOMER_SUPPORT'};tech=${nextAssignment.technicalSupportOfficerId || 'none'};priority=${nextPriority}`,
  });

  await upsertOperationalAssignment({
    entityType: 'support_queue',
    entityId: workspaceId,
    workspaceId,
    assignedToUserId: nextAssignment.supportOfficerId || 'unassigned',
    assignedToName: nextAssignment.supportOfficerName || 'Support Queue',
    assignedRole: nextAssignment.supportOfficerType || 'CUSTOMER_SUPPORT',
    assignedBy: actor?.email ?? auth.session.user?.user_email ?? 'unknown',
    assignmentStatus:
      nextAssignment.status === 'COMPLETED'
        ? 'completed'
        : nextAssignment.status === 'IN_PROGRESS'
          ? 'in_progress'
          : nextAssignment.status === 'WAITING_FOR_CLIENT'
            ? 'awaiting_response'
            : nextAssignment.status === 'UNASSIGNED'
              ? 'unassigned'
              : 'assigned',
    metadata: {
      ticketId: nextAssignment.ticketId,
      priority: nextAssignment.priority,
      escalationStatus: nextAssignment.escalationStatus,
    },
  });

  if (nextStatus === 'ASSIGNED') {
    const refreshedAfterPatch = await readAdminStore();
    const workspaceAfterPatch = refreshedAfterPatch.cloud.workspaces[workspaceId];
    const contactEmail = String(workspaceAfterPatch?.businessProfile?.contactEmail || '').trim().toLowerCase();
    if (contactEmail) {
      await sendPlatformEmailNotification({
        templateKey: 'SUPPORT_ASSIGNED',
        to: contactEmail,
        variables: {
          clientName: String(workspaceAfterPatch?.businessProfile?.businessName || contactEmail),
          workspaceName: workspaceAfterPatch?.name || workspaceId,
          supportOfficerName: nextAssignment.supportOfficerName || 'Support Team',
          workspaceId,
        },
      });
    }

      const supportOfficerEmail = String(
        refreshedAfterPatch.nativeAuth.identities[nextAssignment.supportOfficerId || '']?.email
          || refreshedAfterPatch.platformSettings.email.supportEmail
          || refreshedAfterPatch.platformSettings.email.userOpsEmail
          || '',
      ).trim().toLowerCase();

      if (supportOfficerEmail && supportOfficerEmail !== contactEmail) {
        await sendPlatformEmailNotification({
          templateKey: 'SUPPORT_ASSIGNED_SUPPORT',
          to: supportOfficerEmail,
          variables: {
            supportOfficerName: nextAssignment.supportOfficerName || 'Support Officer',
            workspaceName: workspaceAfterPatch?.name || workspaceId,
            clientEmail: contactEmail || String(workspaceAfterPatch?.businessProfile?.contactEmail || '').trim().toLowerCase(),
            ticketId: nextAssignment.ticketId || 'n/a',
            priority: nextAssignment.priority || 'MEDIUM',
          },
        });
      }
  }

  return NextResponse.json({
    workspaceId,
    assignment: nextAssignment,
    assignmentStatus: nextStatus,
  });
}
