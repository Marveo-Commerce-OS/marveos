import {
  readAdminStore,
  updateAdminStore,
  type OperationalAssignmentEntity,
  type OperationalAssignmentRecord,
  type OperationalAssignmentStatus,
} from '@/lib/adminStore';
import { appendOperationalActivityEvent } from './activityFeed';
import { appendOperationalAuditEvent } from './auditTrail';

function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function upsertOperationalAssignment(input: {
  entityType: OperationalAssignmentEntity;
  entityId: string;
  workspaceId?: string;
  assignedToUserId: string;
  assignedToName: string;
  assignedRole: string;
  assignedBy: string;
  assignmentStatus: OperationalAssignmentStatus;
  metadata?: Record<string, unknown>;
}): Promise<OperationalAssignmentRecord> {
  const now = new Date().toISOString();
  const assignmentId = `${input.entityType}:${input.entityId}`;

  const record: OperationalAssignmentRecord = {
    id: assignmentId || createId('asg'),
    entityType: input.entityType,
    entityId: input.entityId,
    workspaceId: input.workspaceId,
    assignedToUserId: input.assignedToUserId,
    assignedToName: input.assignedToName,
    assignedRole: input.assignedRole,
    assignedAt: now,
    assignedBy: input.assignedBy,
    assignmentStatus: input.assignmentStatus,
    metadata: input.metadata,
  };

  await updateAdminStore((current) => ({
    ...current,
    cloud: {
      ...current.cloud,
      operations: {
        ...current.cloud.operations,
        assignments: {
          ...current.cloud.operations.assignments,
          [record.id]: record,
        },
      },
    },
  }));

  await appendOperationalActivityEvent({
    type: input.entityType === 'ticket'
      ? 'ticket_assigned'
      : input.entityType === 'deployment'
        ? 'deployment_assigned'
        : input.entityType === 'support_session'
          ? 'support_session_started'
          : input.entityType === 'launch_readiness'
            ? 'launch_approved'
            : 'ticket_assigned',
    actor: input.assignedBy,
    target: `${input.entityType}:${input.entityId}`,
    workspaceId: input.workspaceId,
    metadata: {
      assignedToUserId: input.assignedToUserId,
      assignedToName: input.assignedToName,
      assignedRole: input.assignedRole,
      assignmentStatus: input.assignmentStatus,
      ...(input.metadata || {}),
    },
  });

  await appendOperationalAuditEvent({
    actor: input.assignedBy,
    action: 'assignment.updated',
    entity: input.entityType,
    entityId: input.entityId,
    workspaceId: input.workspaceId,
    metadata: {
      assignedToUserId: input.assignedToUserId,
      assignedToName: input.assignedToName,
      assignedRole: input.assignedRole,
      assignmentStatus: input.assignmentStatus,
      ...(input.metadata || {}),
    },
  });

  return record;
}

export async function listMyAssignments(userId: string): Promise<OperationalAssignmentRecord[]> {
  const normalized = String(userId || '').trim();
  if (!normalized) return [];

  const store = await readAdminStore();
  return Object.values(store.cloud.operations.assignments)
    .filter((assignment) => assignment.assignedToUserId === normalized)
    .sort((a, b) => b.assignedAt.localeCompare(a.assignedAt));
}
