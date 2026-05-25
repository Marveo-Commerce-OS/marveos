import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { getSession, isAdmin } from '@/lib/auth';

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

type SmtpAttempt = {
  port: number;
  secure: boolean;
};

function buildSmtpAttempts(port: number, secure: boolean): SmtpAttempt[] {
  const attempts: SmtpAttempt[] = [{ port, secure }];

  // Common cPanel fallback: 587 (STARTTLS) <-> 465 (implicit TLS)
  if (port === 587 && secure === false) {
    attempts.push({ port: 465, secure: true });
  } else if (port === 465 && secure === true) {
    attempts.push({ port: 587, secure: false });
  }

  return attempts;
}

function isRetryableSmtpError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('etimedout') ||
    lower.includes('timed out') ||
    lower.includes('connection timeout') ||
    lower.includes('econnrefused') ||
    lower.includes('esocket') ||
    lower.includes('greeting never received')
  );
}

function mapSmtpError(message: string, host: string, port: number, secure: boolean): string {
  const lower = message.toLowerCase();
  if (lower.includes('does not match certificate') || lower.includes('cert\'s altnames') || lower.includes('hostname/ip does not match certificate')) {
    return 'SMTP TLS certificate does not match the SMTP host. Use the provider SMTP hostname that matches the certificate (for example managed-vps.net), or install a certificate on your mail host that includes this hostname as SAN.';
  }
  if (lower.includes('unauthorized ip address')) {
    return 'SMTP rejected this server IP. For Brevo, authorize your sender IP/domain in Brevo SMTP settings, then retry.';
  }
  if (lower.includes('invalid login') || lower.includes('535') || lower.includes('authentication failed') || lower.includes('incorrect authentication')) {
    return 'SMTP authentication failed. Check username/password and ensure SMTP relay is enabled for this account.';
  }
  if (lower.includes('etimedout') || lower.includes('connection timeout') || lower.includes('timed out')) {
    const isOffice365 = host.toLowerCase().includes('office365') || host.toLowerCase().includes('outlook');
    const secureTip = port === 465 && !secure
      ? ' Port 465 requires Secure=true.'
      : port === 587 && secure
        ? ' Port 587 should use Secure=false (STARTTLS).'
        : '';
    const cpanelTip = ' For many cPanel hosts, SSL on port 465 is more reliable than STARTTLS on 587.';
    const office365Tip = isOffice365
      ? ' For Microsoft 365: ensure "Authenticated SMTP" (SMTP AUTH) is enabled for the account in M365 Admin Center → Users → Mail → Email apps. Also confirm the account is not blocked by a Conditional Access policy.'
      : '';
    return `SMTP connection timed out. Verify host/port are correct and port ${port} is not blocked by your firewall/ISP.${secureTip}${cpanelTip}${office365Tip}`;
  }
  if (lower.includes('econnrefused')) {
    return 'SMTP connection refused. Check SMTP host/port and provider-side access policy.';
  }
  if (lower.includes('enotfound')) {
    return 'SMTP host not found. Verify the SMTP hostname.';
  }
  return message;
}

export async function POST(req: NextRequest) {
  const auth = await ensureAdminSession();
  if ('error' in auth) return auth.error;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return badRequest('Invalid JSON body.');
  }

  const emailConfigRaw = (body as { emailConfig?: unknown }).emailConfig;
  if (!emailConfigRaw || typeof emailConfigRaw !== 'object' || Array.isArray(emailConfigRaw)) {
    return badRequest('emailConfig is required.');
  }

  const emailConfig = emailConfigRaw as Record<string, unknown>;
  const provider = String(emailConfig.provider || 'SMTP').toUpperCase();
  if (!['SMTP', 'SES_SMTP'].includes(provider)) {
    return badRequest('SMTP connection test only supports SMTP and Amazon SES SMTP providers.');
  }

  const host = String(emailConfig.host || '').trim();
  const username = String(emailConfig.username || '').trim();
  const password = String(emailConfig.password || '');
  const fromEmail = String(emailConfig.fromEmail || '').trim().toLowerCase();
  const port = Number(emailConfig.port ?? 587);
  const secure = Boolean(emailConfig.secure);

  if (!host || !username || !password || !fromEmail) {
    return badRequest('SMTP host, username, password, and from email are required for connection test.');
  }
  if (!Number.isFinite(port) || port < 1 || port > 65535) {
    return badRequest('SMTP port must be between 1 and 65535.');
  }

  const attempts = buildSmtpAttempts(port, secure);
  let lastRaw = 'SMTP connection test failed.';

  for (let index = 0; index < attempts.length; index += 1) {
    const attempt = attempts[index];
    const transporter = nodemailer.createTransport({
      host,
      port: attempt.port,
      secure: attempt.secure,
      auth: {
        user: username,
        pass: password,
      },
      tls: process.env.NODE_ENV !== 'production' ? { rejectUnauthorized: false } : undefined,
      dnsTimeout: 8000,
      connectionTimeout: 12000,
      greetingTimeout: 12000,
      socketTimeout: 20000,
    });

    try {
      await transporter.verify();
      const usedFallback = attempt.port !== port || attempt.secure !== secure;
      return NextResponse.json({
        ok: true,
        message: usedFallback
          ? `SMTP connection verified using fallback settings (port=${attempt.port}, secure=${attempt.secure}). Save these settings in System Settings.`
          : 'SMTP connection verified successfully.',
        resolvedConfig: {
          host,
          port: attempt.port,
          secure: attempt.secure,
        },
      });
    } catch (error) {
      lastRaw = error instanceof Error ? error.message : 'SMTP connection test failed.';
      const canRetry = index < attempts.length - 1 && isRetryableSmtpError(lastRaw);
      if (!canRetry) {
        break;
      }
    }
  }

  return NextResponse.json({ error: mapSmtpError(lastRaw, host, port, secure), rawError: lastRaw }, { status: 400 });
}
