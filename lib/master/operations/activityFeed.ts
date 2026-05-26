import {
  readAdminStore,
  updateAdminStore,
  type OperationalActivityEvent,
} from '@/lib/adminStore';
import type { MasterInternalRole } from '@/lib/master/roleDashboard';

function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function appendOperationalActivityEvent(
  event: Omit<OperationalActivityEvent, 'id' | 'createdAt'> & { createdAt?: string },
): Promise<OperationalActivityEvent> {
  const nextEvent: OperationalActivityEvent = {
    id: createId('act'),
    createdAt: event.createdAt || new Date().toISOString(),
    ...event,
  };

  await updateAdminStore((current) => ({
    ...current,
    cloud: {
      ...current.cloud,
      operations: {
        ...current.cloud.operations,
        activityFeed: [nextEvent, ...current.cloud.operations.activityFeed].slice(0, 500),
      },
    },
  }));

  return nextEvent;
}

function isRelevantToRole(event: OperationalActivityEvent, role: MasterInternalRole): boolean {
  if (role === 'SUPER_ADMIN' || role === 'ADMIN') return true;
  if (role === 'CUSTOMER_SUPPORT') return event.type === 'ticket_assigned' || event.type === 'support_session_started';
  if (role === 'TECHNICAL_SUPPORT') return event.type === 'connector_failed' || event.type === 'deployment_assigned' || event.type === 'website_connected';
  if (role === 'DEPLOYMENT_MANAGER') return event.type === 'deployment_assigned' || event.type === 'launch_approved' || event.type === 'template_selected';
  if (role === 'BILLING_MANAGER') return event.type === 'payment_failed';
  return false;
}

export async function listOperationalActivityForRole(role: MasterInternalRole, userId?: string): Promise<{
  relevant: OperationalActivityEvent[];
  mine: OperationalActivityEvent[];
}> {
  const store = await readAdminStore();
  const relevant = store.cloud.operations.activityFeed.filter((event) => isRelevantToRole(event, role)).slice(0, 20);
  const mine = userId
    ? store.cloud.operations.activityFeed.filter((event) => event.metadata?.assignedToUserId === userId || event.metadata?.actorUserId === userId).slice(0, 20)
    : [];

  return { relevant, mine };
}
