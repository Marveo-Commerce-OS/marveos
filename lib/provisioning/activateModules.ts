export interface ActivateModulesInput {
  workspaceId: string;
  modules: string[];
}

export async function activateModules(input: ActivateModulesInput): Promise<string[]> {
  // Phase 6 scaffold: actual activation side effects deferred.
  return Array.from(new Set(input.modules));
}
