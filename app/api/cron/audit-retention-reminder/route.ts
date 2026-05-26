import { NextRequest, NextResponse } from 'next/server';
import { appendAuditLog, readAdminStore } from '@/lib/adminStore';
import { sendPlatformDirectEmail } from '@/lib/emailNotifications';

const REMINDER_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000;

function normalizeRecipients(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(',')
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

function getLastReminderAt(audit: Array<{ at: string; action: string }>): Date | null {
  const sent = audit
    .filter((entry) => entry.action === 'master.audit.retention_reminder.sent')
    .map((entry) => new Date(entry.at))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => b.getTime() - a.getTime());
  return sent[0] || null;
}

function buildHtml(params: {
  auditCount: number;
  lastReminderAt: Date | null;
  appBaseUrl: string;
}) {
  const lastSent = params.lastReminderAt ? params.lastReminderAt.toISOString() : 'never';
  return `
    <div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5;">
      <h2 style="margin:0 0 12px;">Marveo Audit Retention Reminder</h2>
      <p style="margin:0 0 12px;">This reminder is sent every 30 days.</p>
      <ul style="margin:0 0 16px;padding-left:18px;">
        <li>Current audit entries: <strong>${params.auditCount}</strong></li>
        <li>Last reminder sent: <strong>${lastSent}</strong></li>
      </ul>
      <p style="margin:0 0 8px;">Recommended actions:</p>
      <ol style="margin:0 0 16px;padding-left:18px;">
        <li>Open <a href="${params.appBaseUrl}/master/audit-logs">Audit Logs</a> and run Backup logs.</li>
        <li>Optional: run Purge logs only with Super Admin approval.</li>
      </ol>
      <p style="margin:0;">If no purge is needed, keep only backup operation.</p>
    </div>
  `;
}

export async function GET(req: NextRequest) {
  const cronHeader = req.headers.get('x-vercel-cron');
  const authHeader = req.headers.get('authorization');
  const secret = String(process.env.AUDIT_RETENTION_CRON_SECRET || process.env.REPORTS_CRON_SECRET || '').trim();
  const hasBearer = Boolean(secret) && authHeader === `Bearer ${secret}`;

  if (!cronHeader && !hasBearer) {
    return NextResponse.json({ error: 'Unauthorized cron trigger.' }, { status: 401 });
  }

  const force = req.nextUrl.searchParams.get('force') === '1';
  const store = await readAdminStore();

  const now = new Date();
  const lastReminderAt = getLastReminderAt(store.audit);
  if (!force && lastReminderAt && now.getTime() - lastReminderAt.getTime() < REMINDER_INTERVAL_MS) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'not-due' });
  }

  const recipients = normalizeRecipients(
    String(process.env.AUDIT_RETENTION_REMINDER_TO || 'operations@getmarveo.com'),
  );
  if (recipients.length === 0) {
    return NextResponse.json({ ok: false, skipped: true, reason: 'no-recipients-configured' }, { status: 400 });
  }

  const appBaseUrl = String(
    store.platformSettings.email.appBaseUrl ||
    process.env.MARVEO_APP_BASE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    '',
  ).trim();

  const subject = `Marveo Audit Retention Reminder · ${now.toISOString().slice(0, 10)}`;
  const html = buildHtml({
    auditCount: store.audit.length,
    lastReminderAt,
    appBaseUrl,
  });
  const text = [
    'Marveo Audit Retention Reminder',
    `Current audit entries: ${store.audit.length}`,
    `Last reminder sent: ${lastReminderAt ? lastReminderAt.toISOString() : 'never'}`,
    `Backup logs at: ${appBaseUrl ? `${appBaseUrl}/master/audit-logs` : '/master/audit-logs'}`,
    'Optional purge requires Super Admin approval.',
  ].join('\n');

  const delivery = await sendPlatformDirectEmail({
    to: recipients,
    subject,
    html,
    text,
  });

  if (!delivery.ok) {
    await appendAuditLog({
      actorEmail: 'system@cron',
      action: 'master.audit.retention_reminder.failed',
      target: 'audit-retention-reminder',
      details: String(delivery.reason || 'delivery_failed'),
    });
    return NextResponse.json({ ok: false, delivered: false, reason: delivery.reason }, { status: 400 });
  }

  await appendAuditLog({
    actorEmail: 'system@cron',
    action: 'master.audit.retention_reminder.sent',
    target: 'audit-retention-reminder',
    details: `recipients=${recipients.length};auditEntries=${store.audit.length}`,
  });

  return NextResponse.json({
    ok: true,
    delivered: true,
    recipients: recipients.length,
    auditEntries: store.audit.length,
    sentAt: now.toISOString(),
  });
}
