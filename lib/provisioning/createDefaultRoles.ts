export interface CreateDefaultRolesInput {
  workspaceId: string;
  professionKey: string;
}

export async function createDefaultRoles(input: CreateDefaultRolesInput): Promise<string[]> {
  void input.workspaceId;

  if (input.professionKey === 'makeup-artist') {
    return ['Owner', 'Manager', 'Artist/Staff', 'Support Access'];
  }

  return ['CLIENT_OWNER', 'CLIENT_STAFF'];
}
