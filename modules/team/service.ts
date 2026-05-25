import type { TeamModuleContext } from './types';

export async function getTeamModuleState(input: TeamModuleContext): Promise<{ ok: true; workspaceId: string; module: string }> {
  return {
    ok: true,
    workspaceId: input.workspaceId,
    module: 'team',
  };
}
