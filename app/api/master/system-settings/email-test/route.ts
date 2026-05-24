import { NextRequest, NextResponse } from 'next/server';
import { getSession, isAdmin } from '@/lib/auth';
import { PLATFORM_EMAIL_TEMPLATE_KEYS } from '@/lib/adminStore';
import { sendPlatformTestEmail } from '@/lib/emailNotifications';

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function reasonToMessage(reason: string): string {
  if (reason === 'no-recipient') return 'Please provide a valid recipient email.';
  if (reason === 'template-not-found') return 'Selected template was not found.';
  if (reason === 'wordpress-mailer-provider') return 'Test send currently supports SMTP only. Switch provider to SMTP to test here.';
  if (reason === 'incomplete-transport-config') return 'SMTP settings are incomplete. Configure host, port, username, password, and from email.';
  if (reason.includes('ETIMEDOUT')) {
    return 'SMTP connection timed out. Check host/port reachability, firewall rules, and provider settings. For port 465 use secure=true; for port 587 use secure=false.';
  }
  if (reason.includes('ECONNREFUSED')) {
    return 'SMTP connection was refused. Verify SMTP host/port and ensure inbound SMTP is allowed by your provider.';
  }
  if (reason.includes('ENOTFOUND')) {
    return 'SMTP host could not be resolved. Verify the SMTP hostname.';
  }
  return reason || 'Failed to send test email.';
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

export async function POST(req: NextRequest) {
  const auth = await ensureAdminSession();
  if ('error' in auth) return auth.error;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return badRequest('Invalid JSON body.');
  }

  const templateKey = String((body as { templateKey?: unknown }).templateKey || '').trim().toUpperCase();
  if (!PLATFORM_EMAIL_TEMPLATE_KEYS.includes(templateKey as typeof PLATFORM_EMAIL_TEMPLATE_KEYS[number])) {
    return badRequest('templateKey is invalid.');
  }

  const to = String((body as { to?: unknown }).to || '').trim().toLowerCase();
  if (!to || !/^\S+@\S+\.\S+$/.test(to)) {
    return badRequest('A valid recipient email is required.');
  }

  const variables = (body as { variables?: unknown }).variables;
  if (variables && (typeof variables !== 'object' || Array.isArray(variables))) {
    return badRequest('variables must be an object.');
  }

  const emailConfigRaw = (body as { emailConfig?: unknown }).emailConfig;
  const emailConfig = (emailConfigRaw && typeof emailConfigRaw === 'object' && !Array.isArray(emailConfigRaw))
    ? (emailConfigRaw as Record<string, unknown>)
    : null;

  const transportOverride = emailConfig ? {
    provider: String(emailConfig.provider || 'SMTP').toUpperCase() as 'SMTP' | 'WORDPRESS_MAILER',
    host: typeof emailConfig.host === 'string' ? emailConfig.host.trim() : undefined,
    port: Number.isFinite(Number(emailConfig.port)) ? Number(emailConfig.port) : undefined,
    secure: typeof emailConfig.secure === 'boolean' ? emailConfig.secure : undefined,
    username: typeof emailConfig.username === 'string' ? emailConfig.username.trim() : undefined,
    password: typeof emailConfig.password === 'string' ? emailConfig.password : undefined,
    fromEmail: typeof emailConfig.fromEmail === 'string' ? emailConfig.fromEmail.trim().toLowerCase() : undefined,
    fromName: typeof emailConfig.fromName === 'string' ? emailConfig.fromName.trim() : undefined,
    replyToEmail: typeof emailConfig.replyToEmail === 'string' ? emailConfig.replyToEmail.trim().toLowerCase() : undefined,
  } : undefined;

  const sendResult = await sendPlatformTestEmail({
    templateKey: templateKey as typeof PLATFORM_EMAIL_TEMPLATE_KEYS[number],
    to,
    variables: (variables as Record<string, string | number | boolean | null | undefined>) || {},
    fallbackSubject: `Test email for ${templateKey}`,
    transportOverride,
  });

  if (!sendResult.ok) {
    const message = reasonToMessage(sendResult.reason);
    return NextResponse.json({ error: message, reason: sendResult.reason }, { status: sendResult.skipped ? 400 : 500 });
  }

  return NextResponse.json({
    ok: true,
    recipient: to,
    templateKey,
    message: `Test email sent to ${to}.`,
  });
}
