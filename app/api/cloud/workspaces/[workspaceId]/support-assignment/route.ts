import { NextRequest, NextResponse } from 'next/server';
import { getSession, getCurrentWpUser, isAdmin } from '@/lib/auth';
import {
  appendAuditLog,
  getWorkspaceSupportAssignment,
  readAdminStore,
  setWorkspaceSupportAssignment,
} from '@/lib/adminStore';
import type { SupportAssignmentContract } from '@/src/contexts/support/support-assignment.contract';

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

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function isValidPriority(value: unknown): value is SupportAssignmentContract['priority'] {
  return value === 'LOW' || value === 'MEDIUM' || value === 'HIGH' || value === 'CRITICAL';
}

function isValidSetupType(value: unknown): value is SupportAssignmentContract['setupType'] {
  return value === 'NEW_WEBSITE' || value === 'EXISTING_WEBSITE' || value === 'CUSTOM_HEADLESS';
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
  const auth = await ensureAdminSession();
  if ('error' in auth) {
    return auth.error;
  }

  const { workspaceId } = await context.params;
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

  const assignmentPayload: SupportAssignmentContract = {
    workspaceId,
    clientId,
    priority,
    reason,
    setupType,
    requiredSkills,
    initialNotes,
  };

  const nextAssignment = {
    status: 'ASSIGNED' as const,
    assignedAt: new Date().toISOString(),
    assignedBy: auth.session.user?.user_email ?? 'unknown',
    supportOfficerId,
    supportOfficerName,
    priority,
    reason,
    setupType,
    requiredSkills,
    initialNotes,
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
    details: `priority=${priority} setupType=${setupType} officer=${supportOfficerId}`,
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
  const auth = await ensureAdminSession();
  if ('error' in auth) {
    return auth.error;
  }

  const { workspaceId } = await context.params;
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

  const nextAssignment = {
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
    priority: nextPriority,
    reason: typeof body.reason === 'string' ? (body.reason.trim() || undefined) : currentAssignment.reason,
    setupType: nextSetupType,
    requiredSkills: Array.isArray(body.requiredSkills)
      ? body.requiredSkills.map((item: unknown) => String(item).trim()).filter(Boolean)
      : (currentAssignment.requiredSkills ?? []),
    initialNotes: typeof body.initialNotes === 'string'
      ? (body.initialNotes.trim() || undefined)
      : currentAssignment.initialNotes,
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
    details: `status=${nextStatus} officer=${nextAssignment.supportOfficerId || 'none'} priority=${nextPriority}`,
  });

  return NextResponse.json({
    workspaceId,
    assignment: nextAssignment,
    assignmentStatus: nextStatus,
  });
}
