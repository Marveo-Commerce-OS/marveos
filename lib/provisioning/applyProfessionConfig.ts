import { resolveProfessionConfig } from '@/config/professions';
import type { ProfessionConfig } from '@/types/profession';

export interface ApplyProfessionConfigInput {
  workspaceId: string;
  professionKey: string;
}

export async function applyProfessionConfig(
  input: ApplyProfessionConfigInput,
): Promise<ProfessionConfig> {
  const config = resolveProfessionConfig(input.professionKey);

  // Phase 6 scaffold: persistence and module/materialization happens in later migration.
  return config;
}
