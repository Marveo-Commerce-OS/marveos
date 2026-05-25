import type { LeadsModuleContext } from './types';

export async function getLeadsModuleState(input: LeadsModuleContext): Promise<{ ok: true; workspaceId: string; module: string }> {
  return {
    ok: true,
    workspaceId: input.workspaceId,
    module: 'leads',
  };
}
