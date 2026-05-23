import { NextRequest, NextResponse } from 'next/server';
import { getSession, getCurrentWpUser, isAdmin } from '@/lib/auth';
import { appendAuditLog, readAdminStore, updateAdminStore } from '@/lib/adminStore';

async function ensureAdminSession() {
  const session = await getSession();
  if (!session) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const admin = await isAdmin(session.token);
  if (!admin) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { session };
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ workspaceId: string }> },
) {
  const auth = await ensureAdminSession();
  if ('error' in auth) return auth.error;

  const { workspaceId } = await context.params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return badRequest('Invalid JSON body');

  if (typeof (body as { supportRequired?: unknown }).supportRequired !== 'boolean') {
    return badRequest('supportRequired boolean is required');
  }

  const supportRequired = (body as { supportRequired: boolean }).supportRequired;

  const store = await readAdminStore();
  const workspace = store.cloud.workspaces[workspaceId];
  if (!workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  await updateAdminStore((current) => {
    const existing = current.cloud.workspaces[workspaceId];
    if (!existing) return current;

    return {
      ...current,
      cloud: {
        ...current.cloud,
        workspaces: {
          ...current.cloud.workspaces,
          [workspaceId]: {
            ...existing,
            supportRequired,
            updatedAt: new Date().toISOString(),
          },
        },
      },
    };
  });

  const actor = await getCurrentWpUser(auth.session.token);
  await appendAuditLog({
    actorEmail: actor?.email ?? auth.session.user?.user_email ?? 'unknown',
    action: 'cloud.support.required_set',
    target: workspaceId,
    details: `supportRequired=${supportRequired}`,
  });

  return NextResponse.json({ ok: true, workspaceId, supportRequired });
}
