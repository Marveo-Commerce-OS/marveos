import { NextResponse } from 'next/server';
import { readAdminStore } from '@/lib/adminStore';
import { requireMasterAccess } from '@/lib/permissions/access';
import { hasSupportQueueAccess } from '@/lib/tickets/service';

type WorkspaceClientRow = {
  id: string;
  name: string;
  email: string;
  workspaceId: string;
  workspaceName: string;
};

export async function GET() {
  const access = await requireMasterAccess();
  if ('error' in access) return access.error;

  const allowed = await hasSupportQueueAccess(access.roles);
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const store = await readAdminStore();
  const workspaceMap = store.cloud.workspaces;

  const clients: WorkspaceClientRow[] = Object.values(store.nativeAuth.identities)
    .filter((identity) => identity.userType === 'CLIENT_USER' && identity.status === 'ACTIVE')
    .map((identity) => {
      const state = store.users[identity.id];
      const workspaceId = String(state?.assignedWorkspaceId || '').trim();
      if (!workspaceId || !workspaceMap[workspaceId]) return null;

      return {
        id: identity.id,
        name: String(identity.name || identity.email || 'Client').trim(),
        email: String(identity.email || '').trim().toLowerCase(),
        workspaceId,
        workspaceName: String(workspaceMap[workspaceId]?.name || workspaceId).trim(),
      };
    })
    .filter((row): row is WorkspaceClientRow => Boolean(row && row.email));

  return NextResponse.json({ ok: true, clients });
}
