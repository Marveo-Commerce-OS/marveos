import type { BookingsModuleContext } from './types';

export async function getBookingsModuleState(input: BookingsModuleContext): Promise<{ ok: true; workspaceId: string; module: string }> {
  return {
    ok: true,
    workspaceId: input.workspaceId,
    module: 'bookings',
  };
}
