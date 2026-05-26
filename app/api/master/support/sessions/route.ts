import { NextRequest, NextResponse } from 'next/server';
import { appendAuditLog, readAdminStore } from '@/lib/adminStore';
import { requireMasterAccess } from '@/lib/permissions/access';
import { getSupportSessionStoreSnapshot } from '@/lib/support-access/createSupportSession';

function parseBoolean(value: string | null, fallback = false): boolean {
  if (value == null) return fallback;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

export async function GET(req: NextRequest) {
  const master = await requireMasterAccess();
  if ('error' in master) return master.error;

  const workspaceId = String(req.nextUrl.searchParams.get('workspaceId') || '').trim();
  const supportUserId = String(req.nextUrl.searchParams.get('supportUserId') || '').trim();
  const includeRevoked = parseBoolean(req.nextUrl.searchParams.get('includeRevoked'), true);

  const store = await readAdminStore();
  const sessions = Array.from(getSupportSessionStoreSnapshot().values())
    .filter((session) => {
      if (workspaceId && session.workspaceId !== workspaceId) return false;
      if (supportUserId && session.supportUserId !== supportUserId) return false;
      if (!includeRevoked && session.revokedAt) return false;
      return true;
    })
    .sort((a, b) => {
      const left = new Date(a.issuedAt).getTime();
      const right = new Date(b.issuedAt).getTime();
      return right - left;
    })
    .map((session) => {
      const workspace = store.cloud.workspaces[session.workspaceId];
      return {
        ...session,
        workspaceName: workspace?.name || session.workspaceId,
      };
    });

  await appendAuditLog({
    actorEmail: master.session.user?.user_email ?? 'unknown',
    action: 'support.session.listed',
    target: workspaceId || 'all',
    details: `count=${sessions.length};includeRevoked=${includeRevoked};supportUserId=${supportUserId || 'all'}`,
  });

  return NextResponse.json({
    ok: true,
    sessions,
  });
}
