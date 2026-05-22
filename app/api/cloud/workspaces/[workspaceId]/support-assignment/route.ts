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
