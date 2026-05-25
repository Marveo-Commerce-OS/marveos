import type { ClientsModuleContext } from './types';

export async function getClientsModuleState(input: ClientsModuleContext): Promise<{ ok: true; workspaceId: string; module: string }> {
  return {
    ok: true,
    workspaceId: input.workspaceId,
    module: 'clients',
  };
}
