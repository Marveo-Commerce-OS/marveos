import { NextRequest, NextResponse } from 'next/server';
import { appendAuditLog, updateAdminStore } from '@/lib/adminStore';
import { requireMasterAccess } from '@/lib/permissions/access';
import { clearSupportSessionStore } from '@/lib/support-access/createSupportSession';
import { clearSupportOtpStore } from '@/lib/support-access/requestSupportSession';

type ResetTarget = 'support_db' | 'support_queue' | 'all';

function parseResetTarget(value: unknown): ResetTarget | null {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'support_db') return 'support_db';
  if (normalized === 'support_queue') return 'support_queue';
  if (normalized === 'all') return 'all';
  return null;
}

export async function POST(req: NextRequest) {
  const access = await requireMasterAccess();
  if ('error' in access) return access.error;

  const body = await req.json().catch(() => null);
  const target = parseResetTarget((body as { target?: unknown } | null)?.target);
  if (!target) {
    return NextResponse.json({ error: 'target must be one of support_db, support_queue, all' }, { status: 400 });
  }

  let clearedOtpChallenges = 0;
  let clearedSessions = 0;
  let clearedQueueAssignments = 0;

  if (target === 'support_db' || target === 'all') {
    clearedOtpChallenges = clearSupportOtpStore();
    clearedSessions = clearSupportSessionStore();
  }

  if (target === 'support_queue' || target === 'all') {
    await updateAdminStore((current) => {
      const nextWorkspaces = { ...current.cloud.workspaces };
      for (const [workspaceId, workspace] of Object.entries(nextWorkspaces)) {
        const hadAssignment = Boolean(workspace.supportAssignment) || Boolean(workspace.supportRequired);
        if (!hadAssignment) continue;

        clearedQueueAssignments += 1;
        nextWorkspaces[workspaceId] = {
          ...workspace,
          supportRequired: false,
          supportAssignment: undefined,
          updatedAt: new Date().toISOString(),
        };
      }

      return {
        ...current,
        cloud: {
          ...current.cloud,
          workspaces: nextWorkspaces,
        },
      };
    });
  }

  const actorEmail = String(access.session.user?.user_email || access.session.user?.email || 'unknown').trim().toLowerCase();
  await appendAuditLog({
    actorEmail,
    action: 'support.queue.reset',
    target,
    details: `otp=${clearedOtpChallenges};sessions=${clearedSessions};queue=${clearedQueueAssignments}`,
  });

  return NextResponse.json({
    ok: true,
    target,
    clearedOtpChallenges,
    clearedSessions,
    clearedQueueAssignments,
  });
}
