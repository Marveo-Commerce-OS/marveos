import type { ReportsModuleContext } from './types';

export async function getReportsModuleState(input: ReportsModuleContext): Promise<{ ok: true; workspaceId: string; module: string }> {
  return {
    ok: true,
    workspaceId: input.workspaceId,
    module: 'reports',
  };
}
