import { NextRequest, NextResponse } from 'next/server';
import { hasClientWorkspaceAccess, isSuperAdmin } from '@/lib/auth';
import { ensureWorkspaceSupportChatPin, readAdminStore } from '@/lib/adminStore';
import { requireOSAccess } from '@/lib/permissions/access';
import { resolveClientWorkspaceScope } from '@/lib/tickets/service';

type SessionLike = {
  user?: {
    id?: string | number;
    ID?: string | number;
    user_email?: string;
    email?: string;
    user_display_name?: string;
  } | null;
};

function getSessionIdentity(session: SessionLike) {
  const userId = String(session.user?.id ?? session.user?.ID ?? '').trim();
  const email = String(session.user?.user_email ?? session.user?.email ?? '').trim().toLowerCase();
  const name = String(session.user?.user_display_name || email || 'Client').trim();
  return { userId, email, name };
}

export async function GET(req: NextRequest) {
  const access = await requireOSAccess();
  if ('error' in access) return access.error;

  const identity = getSessionIdentity(access.session);
  const workspaceIds = await resolveClientWorkspaceScope({
    sessionUserId: identity.userId,
    roles: access.roles,
  });

  if (workspaceIds.length === 0) {
    return NextResponse.json({ error: 'No workspace scope found for this user.' }, { status: 403 });
  }

  const workspaceId = workspaceIds[0];
  const store = await readAdminStore();
  const workspace = store.cloud.workspaces[workspaceId];
  const isClient = hasClientWorkspaceAccess(access.roles);
  const isRootSuperAdmin = await isSuperAdmin(access.session.token);
  const canViewMaskedPin = isClient || isRootSuperAdmin;
  const canRevealPin = isClient || isRootSuperAdmin;
  const revealPin = req.nextUrl.searchParams.get('revealPin') === 'true';

  const supportPinRaw = canViewMaskedPin ? await ensureWorkspaceSupportChatPin(workspaceId) : null;
  const maskedSupportPin = supportPinRaw ? `${'*'.repeat(Math.max(0, supportPinRaw.length - 2))}${supportPinRaw.slice(-2)}` : null;
  const supportPin = canRevealPin && revealPin ? supportPinRaw : null;

  return NextResponse.json({
    ok: true,
    identity,
    workspace: workspace
      ? {
          id: workspace.id,
          name: workspace.name,
        }
      : {
          id: workspaceId,
          name: workspaceId,
        },
    canViewSupportPin: canViewMaskedPin,
    canRevealSupportPin: canRevealPin,
    maskedSupportPin,
    supportPin,
  });
}
