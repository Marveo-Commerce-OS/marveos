import { NextResponse } from 'next/server';
import { readAdminStore } from '@/lib/adminStore';
import { requireMasterAccess } from '@/lib/permissions/access';
import { hasSupportQueueAccess } from '@/lib/tickets/service';
import { getLiveSessionWithMessages } from '@/lib/liveChatSessions/service';

function supportsResponder(identity: {
  roles: string[];
  status: string;
  userType: string;
}, userState: { masterRole?: string; active?: boolean; status?: string } | undefined): boolean {
  if (identity.userType !== 'INTERNAL_USER' || identity.status !== 'ACTIVE') return false;
  if (userState?.active === false || userState?.status === 'DISABLED') return false;

  const mergedRoles = new Set<string>([
    ...identity.roles,
    ...(userState?.masterRole ? [userState.masterRole] : []),
  ]);

  const normalized = Array.from(mergedRoles).map((role) => String(role).trim().toUpperCase());
  return normalized.includes('CUSTOMER_SUPPORT')
    || normalized.includes('TECHNICAL_SUPPORT')
    || normalized.includes('ADMIN')
    || normalized.includes('SUPER_ADMIN');
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const access = await requireMasterAccess();
  if ('error' in access) return access.error;

  const allowed = await hasSupportQueueAccess(access.roles);
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { sessionId } = await context.params;
  const row = await getLiveSessionWithMessages(sessionId);
  if (!row) return NextResponse.json({ error: 'Live session not found' }, { status: 404 });

  const store = await readAdminStore();
  const workspace = store.cloud.workspaces[row.session.workspaceId] || null;
  const supportUsers = Object.values(store.nativeAuth.identities)
    .filter((identity) => supportsResponder(identity, store.users[identity.id]))
    .map((identity) => ({
      id: identity.id,
      name: identity.name,
      email: identity.email,
      roles: Array.from(new Set([
        ...identity.roles,
        ...(store.users[identity.id]?.masterRole ? [String(store.users[identity.id].masterRole)] : []),
      ])),
    }));

  return NextResponse.json({
    session: row.session,
    messages: row.messages,
    presence: store.cloud.ticketing.livePresence[sessionId] || null,
    workspace,
    supportUsers,
  });
}
