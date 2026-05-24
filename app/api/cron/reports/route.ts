import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { appendAuditLog, readAdminStore, updateAdminStore } from '@/lib/adminStore';

type ReportingConfig = {
  scheduleEnabled: boolean;
  frequency: 'WEEKLY' | 'MONTHLY';
  dayOfWeek: number;
  dayOfMonth: number;
  hourUTC: number;
  recipients: string[];
  includeIncidents: boolean;
  includeComplaints: boolean;
  includeAnalytics: boolean;
  updatedAt: string;
  lastRunAt?: string;
  lastRunStatus?: 'success' | 'failed';
};

function normalizeRecipients(input: string[]): string[] {
  return Array.from(new Set(input.map((item) => String(item).trim().toLowerCase()).filter(Boolean)));
}

function isDue(config: ReportingConfig, now: Date): boolean {
  if (!config.scheduleEnabled) return false;
  if (now.getUTCHours() !== config.hourUTC) return false;

  if (config.frequency === 'WEEKLY') {
    return now.getUTCDay() === config.dayOfWeek;
  }

  return now.getUTCDate() === config.dayOfMonth;
}

function hasExecutedThisWindow(lastRunAt: string | undefined, now: Date, frequency: ReportingConfig['frequency']): boolean {
  if (!lastRunAt) return false;
  const last = new Date(lastRunAt);
  if (Number.isNaN(last.getTime())) return false;

  if (frequency === 'WEEKLY') {
    const startOfWeek = new Date(now);
    startOfWeek.setUTCDate(now.getUTCDate() - now.getUTCDay());
    startOfWeek.setUTCHours(0, 0, 0, 0);
    return last >= startOfWeek;
  }

  return last.getUTCFullYear() === now.getUTCFullYear() && last.getUTCMonth() === now.getUTCMonth();
}

function summarize(store: Awaited<ReturnType<typeof readAdminStore>>) {
  const workspaces = Object.values(store.cloud.workspaces);
  const failedDeployments = workspaces.filter((workspace) => {
    return workspace.status === 'blocked' || workspace.onboardingStatus === 'FAILED' || workspace.connectorStatus === 'FAILED';
  }).length;
  const openSupportAssignments = workspaces.filter((workspace) => workspace.supportRequired && workspace.supportAssignment?.status !== 'ASSIGNED').length;
  const launchBlockers = workspaces.filter((workspace) => workspace.missingRequirements.length > 0).length;
  const connectedWebsites = workspaces.filter((workspace) => workspace.connectorStatus === 'CONNECTED').length;
  const plansSold = Object.values(store.cloud.commercial.subscriptions).filter((subscription) => {
    return subscription.status !== 'CANCELLED' && subscription.status !== 'EXPIRED';
  }).length;
  const plansAvailable = store.cloud.commercial.plans.length;

  return {
    totalWorkspaces: workspaces.length,
    failedDeployments,
    openSupportAssignments,
    launchBlockers,
    connectedWebsites,
    plansSold,
    plansAvailable,
    generatedAt: new Date().toISOString(),
  };
}

function buildHtml(summary: ReturnType<typeof summarize>, schedule: ReportingConfig) {
  const rows: Array<[string, string | number]> = [
    ['Total Workspaces', summary.totalWorkspaces],
    ['Failed Deployments', summary.failedDeployments],
    ['Open Support Assignments', summary.openSupportAssignments],
    ['Launch Blockers', summary.launchBlockers],
    ['Connected Websites', summary.connectedWebsites],
    ['Plans Sold', summary.plansSold],
    ['Plans Available', summary.plansAvailable],
    ['Generated At (UTC)', summary.generatedAt],
  ];

  return `
  <div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5;">
    <h2 style="margin:0 0 12px;">Marveo Leadership Report</h2>
    <p style="margin:0 0 12px;">Controlled schedule: ${schedule.frequency} at ${String(schedule.hourUTC).padStart(2, '0')}:00 UTC</p>
    <table style="border-collapse:collapse;width:100%;max-width:560px;">
      ${rows.map(([label, value]) => `<tr><td style="border:1px solid #e2e8f0;padding:8px;font-weight:600;">${label}</td><td style="border:1px solid #e2e8f0;padding:8px;">${value}</td></tr>`).join('')}
    </table>
  </div>`;
}

export async function GET(req: NextRequest) {
  const cronHeader = req.headers.get('x-vercel-cron');
  const authHeader = req.headers.get('authorization');
  const secret = String(process.env.REPORTS_CRON_SECRET || '').trim();
  const hasBearer = secret && authHeader === `Bearer ${secret}`;

  if (!cronHeader && !hasBearer) {
    return NextResponse.json({ error: 'Unauthorized cron trigger.' }, { status: 401 });
  }

  const force = req.nextUrl.searchParams.get('force') === '1';
  const store = await readAdminStore();
  const reporting = store.platformSettings.reporting;
  const now = new Date();

  if (!reporting.scheduleEnabled && !force) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'schedule-disabled' });
  }

  if (!force && !isDue(reporting, now)) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'not-due' });
  }

  if (!force && hasExecutedThisWindow(reporting.lastRunAt, now, reporting.frequency)) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'already-executed-in-window' });
  }

  const recipients = normalizeRecipients(reporting.recipients || []);
  if (recipients.length === 0) {
    return NextResponse.json({ ok: false, skipped: true, reason: 'no-recipients-configured' }, { status: 400 });
  }

  const emailConfig = store.platformSettings.email;
  if (emailConfig.provider !== 'SMTP' || !emailConfig.host || !emailConfig.port || !emailConfig.username || !emailConfig.password || !emailConfig.fromEmail) {
    return NextResponse.json({ ok: false, skipped: true, reason: 'smtp-not-ready' }, { status: 400 });
  }

  const summary = summarize(store);
  const html = buildHtml(summary, reporting);
  const text = `Marveo Leadership Report\nTotal Workspaces: ${summary.totalWorkspaces}\nFailed Deployments: ${summary.failedDeployments}\nOpen Support Assignments: ${summary.openSupportAssignments}\nLaunch Blockers: ${summary.launchBlockers}\nConnected Websites: ${summary.connectedWebsites}\nPlans Sold: ${summary.plansSold}\nPlans Available: ${summary.plansAvailable}\nGenerated At: ${summary.generatedAt}`;

  const transporter = nodemailer.createTransport({
    host: emailConfig.host,
    port: emailConfig.port,
    secure: emailConfig.secure,
    auth: {
      user: emailConfig.username,
      pass: emailConfig.password,
    },
    dnsTimeout: 8000,
    connectionTimeout: 12000,
    greetingTimeout: 12000,
    socketTimeout: 20000,
  });

  try {
    await transporter.sendMail({
      from: emailConfig.fromName ? `${emailConfig.fromName} <${emailConfig.fromEmail}>` : emailConfig.fromEmail,
      replyTo: emailConfig.replyToEmail || undefined,
      to: recipients,
      subject: `Marveo Leadership Report · ${now.toISOString().slice(0, 10)}`,
      html,
      text,
    });

    await updateAdminStore((current) => ({
      ...current,
      platformSettings: {
        ...current.platformSettings,
        reporting: {
          ...current.platformSettings.reporting,
          lastRunAt: now.toISOString(),
          lastRunStatus: 'success',
        },
      },
    }));

    await appendAuditLog({
      actorEmail: 'system@cron',
      action: 'master.reports.schedule.executed',
      target: 'reports-schedule-cron',
      details: `Delivered leadership report to ${recipients.length} recipient(s).`,
    });

    return NextResponse.json({ ok: true, delivered: true, recipients: recipients.length, generatedAt: summary.generatedAt });
  } catch (error) {
    await updateAdminStore((current) => ({
      ...current,
      platformSettings: {
        ...current.platformSettings,
        reporting: {
          ...current.platformSettings.reporting,
          lastRunAt: now.toISOString(),
          lastRunStatus: 'failed',
        },
      },
    }));

    const detail = error instanceof Error ? error.message : 'unknown error';
    await appendAuditLog({
      actorEmail: 'system@cron',
      action: 'master.reports.schedule.failed',
      target: 'reports-schedule-cron',
      details: detail,
    });
    return NextResponse.json({ ok: false, delivered: false, error: detail }, { status: 500 });
  }
}
