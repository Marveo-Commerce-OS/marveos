import { NextRequest, NextResponse } from 'next/server';
import { getSession, getCurrentWpUser, isAdmin } from '@/lib/auth';
import { appendAuditLog, readAdminStore, updateAdminStore } from '@/lib/adminStore';
import { sendPlatformEmailNotification } from '@/lib/emailNotifications';
import { requireSupportAccessSession } from '@/lib/support-access/session';

async function ensureAdminSession() {
  const session = await getSession();
  if (!session) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const allowed = await isAdmin(session.token);
  if (!allowed) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { session };
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function getWorkspaceContactEmail(workspace: { businessProfile?: Record<string, unknown> }): string {
  const profile = workspace.businessProfile || {};
  return String(profile.contactEmail || '').trim().toLowerCase();
}

export async function POST(req: NextRequest) {
  const auth = await ensureAdminSession();
  if ('error' in auth) return auth.error;

  const supportUserId = String(auth.session.user?.id ?? auth.session.user?.ID ?? '').trim() || undefined;
  const supportSession = await requireSupportAccessSession(req, {
    actorEmail: auth.session.user?.user_email ?? 'unknown',
    supportUserId,
    auditTarget: 'master:clients:assign-support',
  });
  if ('error' in supportSession) return supportSession.error;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return badRequest('Invalid JSON body');

  const clientEmail = String((body as { clientEmail?: unknown }).clientEmail || '').trim().toLowerCase();
  const supportOfficerId = String((body as { supportOfficerId?: unknown }).supportOfficerId || '').trim();
  const supportOfficerName = String((body as { supportOfficerName?: unknown }).supportOfficerName || '').trim();

  if (!clientEmail) return badRequest('clientEmail is required');
  if (!supportOfficerId) return badRequest('supportOfficerId is required');
  if (!supportOfficerName) return badRequest('supportOfficerName is required');

  const store = await readAdminStore();
  const targets = Object.values(store.cloud.workspaces)
    .filter((workspace) => getWorkspaceContactEmail(workspace) === clientEmail)
    .filter((workspace) => Boolean(workspace.supportRequired))
    .filter((workspace) => !workspace.supportAssignment || workspace.supportAssignment.status === 'UNASSIGNED');

  if (targets.length === 0) {
    return NextResponse.json({ ok: true, updated: 0, workspaceIds: [] });
  }

  const now = new Date().toISOString();
  const actorEmail = auth.session.user?.user_email ?? 'unknown';

  await updateAdminStore((current) => {
    const nextWorkspaces = { ...current.cloud.workspaces };

    for (const workspace of targets) {
      const existing = nextWorkspaces[workspace.id];
      if (!existing) continue;

      const currentAssignment = existing.supportAssignment;

      nextWorkspaces[workspace.id] = {
        ...existing,
        supportAssignment: {
          status: 'ASSIGNED',
          assignedAt: currentAssignment?.assignedAt ?? now,
          assignedBy: actorEmail,
          supportOfficerId,
          supportOfficerName,
          priority: currentAssignment?.priority ?? 'MEDIUM',
          reason: currentAssignment?.reason ?? 'Assigned from /master/clients',
          setupType: currentAssignment?.setupType ?? existing.websiteType ?? 'NEW_WEBSITE',
          requiredSkills: currentAssignment?.requiredSkills ?? ['Onboarding'],
          initialNotes: currentAssignment?.initialNotes ?? 'Assigned via client operations view',
        },
        updatedAt: now,
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

  const actor = await getCurrentWpUser(auth.session.token);
  await appendAuditLog({
    actorEmail: actor?.email ?? actorEmail,
    action: 'master.client.support_assigned',
    target: `client:${clientEmail}`,
    details: `updated=${targets.length};officer=${supportOfficerId}`,
  });

  for (const workspace of targets) {
    await appendAuditLog({
      actorEmail: actor?.email ?? actorEmail,
      action: 'master.support.assigned',
      target: workspace.id,
      details: `client=${clientEmail};officer=${supportOfficerId}`,
    });

    await sendPlatformEmailNotification({
      templateKey: 'SUPPORT_ASSIGNED',
      to: clientEmail,
      variables: {
        clientName: String(workspace.businessProfile?.businessName || clientEmail),
        workspaceName: workspace.name,
        supportOfficerName,
        workspaceId: workspace.id,
      },
    });
  }

  return NextResponse.json({ ok: true, updated: targets.length, workspaceIds: targets.map((item) => item.id) });
}
