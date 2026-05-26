export interface CreateWorkspaceInput {
  tenantId: string;
  workspaceName: string;
  professionKey: string;
}

export interface CreateWorkspaceResult {
  workspaceId: string;
}

function makeWorkspaceId(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let token = '';
  for (let index = 0; index < 7; index += 1) {
    token += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `WS-${token}`;
}

export async function createWorkspace(input: CreateWorkspaceInput): Promise<CreateWorkspaceResult> {
  // Phase 6 scaffold: wiring into persistent store is deferred to migration implementation.
  void input;
  const workspaceId = makeWorkspaceId();
  return { workspaceId };
}
