import type { WhatsappModuleContext } from './types';

export async function getWhatsappModuleState(input: WhatsappModuleContext): Promise<{ ok: true; workspaceId: string; module: string }> {
  return {
    ok: true,
    workspaceId: input.workspaceId,
    module: 'whatsapp',
  };
}
