import { NextRequest, NextResponse } from 'next/server';
import { appendAuditLog, readAdminStore, updateAdminStore } from '@/lib/adminStore';
import { getCurrentPlatformUser, getSession, isAdmin, isSuperAdmin } from '@/lib/auth';

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

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

export async function GET() {
  const auth = await ensureAdminSession();
  if ('error' in auth) return auth.error;

  const store = await readAdminStore();
  return NextResponse.json({
    ok: true,
    schedule: store.platformSettings.reporting,
  });
}

export async function PATCH(req: NextRequest) {
  const auth = await ensureAdminSession();
  if ('error' in auth) return auth.error;

  const canEdit = await isSuperAdmin(auth.session.token);
  if (!canEdit) {
    return NextResponse.json({ error: 'Only super admins can manage scheduled reports.' }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    scheduleEnabled?: unknown;
    frequency?: unknown;
    dayOfWeek?: unknown;
    dayOfMonth?: unknown;
    hourUTC?: unknown;
    recipients?: unknown;
    includeIncidents?: unknown;
    includeComplaints?: unknown;
    includeAnalytics?: unknown;
  } | null;

  if (!body || typeof body !== 'object') {
    return badRequest('Invalid JSON payload.');
  }

  const frequency = String(body.frequency || 'WEEKLY').toUpperCase();
  if (frequency !== 'WEEKLY' && frequency !== 'MONTHLY') {
    return badRequest('frequency must be WEEKLY or MONTHLY.');
  }

  const dayOfWeek = Number(body.dayOfWeek ?? 1);
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    return badRequest('dayOfWeek must be an integer between 0 and 6.');
  }

  const dayOfMonth = Number(body.dayOfMonth ?? 1);
  if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 28) {
    return badRequest('dayOfMonth must be an integer between 1 and 28.');
  }

  const hourUTC = Number(body.hourUTC ?? 8);
  if (!Number.isInteger(hourUTC) || hourUTC < 0 || hourUTC > 23) {
    return badRequest('hourUTC must be an integer between 0 and 23.');
  }

  const recipients = Array.isArray(body.recipients)
    ? body.recipients.map((item) => String(item).trim().toLowerCase()).filter(Boolean)
    : [];

  if (Boolean(body.scheduleEnabled) && recipients.length === 0) {
    return badRequest('At least one recipient is required when scheduling is enabled.');
  }

  const invalidRecipient = recipients.find((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
  if (invalidRecipient) {
    return badRequest(`Invalid recipient email: ${invalidRecipient}`);
  }

  const updated = await updateAdminStore((current) => ({
    ...current,
    platformSettings: {
      ...current.platformSettings,
      reporting: {
        scheduleEnabled: Boolean(body.scheduleEnabled),
        frequency: frequency as 'WEEKLY' | 'MONTHLY',
        dayOfWeek,
        dayOfMonth,
        hourUTC,
        recipients,
        includeIncidents: Boolean(body.includeIncidents),
        includeComplaints: Boolean(body.includeComplaints),
        includeAnalytics: Boolean(body.includeAnalytics),
        updatedAt: new Date().toISOString(),
        lastRunAt: current.platformSettings.reporting.lastRunAt,
        lastRunStatus: current.platformSettings.reporting.lastRunStatus,
      },
    },
  }));

  const actor = await getCurrentPlatformUser(auth.session.token);
  await appendAuditLog({
    actorEmail: actor?.email ?? String(auth.session.user?.user_email ?? 'unknown'),
    action: 'master.reports.schedule.updated',
    target: 'reports-schedule',
    details: `enabled=${updated.platformSettings.reporting.scheduleEnabled}; frequency=${updated.platformSettings.reporting.frequency}; recipients=${updated.platformSettings.reporting.recipients.length}`,
  });

  return NextResponse.json({ ok: true, schedule: updated.platformSettings.reporting });
}
