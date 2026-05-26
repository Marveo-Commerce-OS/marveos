import { updateAdminStore, type OperationalAuditEvent } from '@/lib/adminStore';

function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function appendOperationalAuditEvent(
  event: Omit<OperationalAuditEvent, 'id' | 'timestamp'> & { timestamp?: string },
): Promise<OperationalAuditEvent> {
  const nextEvent: OperationalAuditEvent = {
    id: createId('op_audit'),
    timestamp: event.timestamp || new Date().toISOString(),
    ...event,
  };

  await updateAdminStore((current) => ({
    ...current,
    cloud: {
      ...current.cloud,
      operations: {
        ...current.cloud.operations,
        auditTrail: [nextEvent, ...current.cloud.operations.auditTrail].slice(0, 2000),
      },
    },
  }));

  return nextEvent;
}
