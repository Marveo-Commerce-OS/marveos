export interface CreateWorkspaceInput {
  tenantId: string;
  workspaceName: string;
  professionKey: string;
}

export interface CreateWorkspaceResult {
  workspaceId: string;
}

export async function createWorkspace(input: CreateWorkspaceInput): Promise<CreateWorkspaceResult> {
  // Phase 6 scaffold: wiring into persistent store is deferred to migration implementation.
  const workspaceId = `ws_${input.tenantId}_${Date.now()}`;
  return { workspaceId };
}
