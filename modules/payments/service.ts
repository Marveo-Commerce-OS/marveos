import type { PaymentsModuleContext } from './types';

export async function getPaymentsModuleState(input: PaymentsModuleContext): Promise<{ ok: true; workspaceId: string; module: string }> {
  return {
    ok: true,
    workspaceId: input.workspaceId,
    module: 'payments',
  };
}
