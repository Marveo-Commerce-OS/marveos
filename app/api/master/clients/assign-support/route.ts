import { NextRequest, NextResponse } from 'next/server';
import { getCurrentWpUser } from '@/lib/auth';
import { appendAuditLog, readAdminStore, updateAdminStore } from '@/lib/adminStore';
import { sendPlatformEmailNotification } from '@/lib/emailNotifications';
import { requireActionPermission } from '@/lib/master/permissions/guards';
import { upsertOperationalAssignment } from '@/lib/master/operations';

async function ensureAdminSession() {
  return requireActionPermission('supportQueue', 'assign');
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function getWorkspaceContactEmail(workspace: { businessProfile?: Record<string, unknown> }): string {
  const profile = workspace.businessProfile || {};
  return String(profile.contactEmail || '').trim().toLowerCase();
}

function buildSupportTicketId(workspaceId: string): string {
  const shortWorkspace = workspaceId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase() || 'WS';
  return `TKT-${Date.now().toString(36).toUpperCase()}-${shortWorkspace}`;
}

export async function POST(req: NextRequest) {
  const auth = await ensureAdminSession();
  if ('error' in auth) return auth.error;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return badRequest('Invalid JSON body');

  const clientEmail = String((body as { clientEmail?: unknown }).clientEmail || '').trim().toLowerCase();
  const supportOfficerId = String((body as { supportOfficerId?: unknown }).supportOfficerId || '').trim();
  const supportOfficerName = String((body as { supportOfficerName?: unknown }).supportOfficerName || '').trim();

  if (!clientEmail) return badRequest('clientEmail is required');
  if (!supportOfficerId) return badRequest('supportOfficerId is required');
  if (!supportOfficerName) return badRequest('supportOfficerName is required');

  const store = await readAdminStore();
  const supportOfficer = store.nativeAuth.identities[supportOfficerId];
  const supportOfficerEmail = String(
    supportOfficer?.email
      || store.platformSettings.email.supportEmail
      || store.platformSettings.email.userOpsEmail
      || '',
  ).trim().toLowerCase();
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
          supportOfficerType: 'CUSTOMER_SUPPORT',
          ticketId: currentAssignment?.ticketId || buildSupportTicketId(workspace.id),
          priority: currentAssignment?.priority ?? 'MEDIUM',
          reason: currentAssignment?.reason ?? 'Assigned from /master/clients',
          setupType: currentAssignment?.setupType ?? existing.websiteType ?? 'NEW_WEBSITE',
          requiredSkills: currentAssignment?.requiredSkills ?? ['Onboarding'],
          initialNotes: currentAssignment?.initialNotes ?? 'Assigned via client operations view',
          technicalSupportOfficerId: currentAssignment?.technicalSupportOfficerId,
          technicalSupportOfficerName: currentAssignment?.technicalSupportOfficerName,
          escalationStatus: currentAssignment?.escalationStatus ?? 'NONE',
          escalatedAt: currentAssignment?.escalatedAt,
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

    if (supportOfficerEmail && supportOfficerEmail !== clientEmail) {
      await sendPlatformEmailNotification({
        templateKey: 'SUPPORT_ASSIGNED_SUPPORT',
        to: supportOfficerEmail,
        variables: {
          supportOfficerName: supportOfficer?.name || supportOfficerName,
          workspaceName: workspace.name,
          clientEmail,
          ticketId: workspace.supportAssignment?.ticketId || 'n/a',
          priority: workspace.supportAssignment?.priority || 'MEDIUM',
        },
      });
    }

    await upsertOperationalAssignment({
      entityType: 'support_queue',
      entityId: workspace.id,
      workspaceId: workspace.id,
      assignedToUserId: supportOfficerId,
      assignedToName: supportOfficerName,
      assignedRole: String(supportOfficer?.roles?.[0] || 'CUSTOMER_SUPPORT'),
      assignedBy: actor?.email ?? actorEmail,
      assignmentStatus: 'assigned',
      metadata: {
        ticketId: workspace.supportAssignment?.ticketId || null,
        priority: workspace.supportAssignment?.priority || 'MEDIUM',
      },
    });
  }

  return NextResponse.json({ ok: true, updated: targets.length, workspaceIds: targets.map((item) => item.id) });
}
