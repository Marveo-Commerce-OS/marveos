import nodemailer from 'nodemailer';
import { readAdminStore, type PlatformEmailTemplateKey } from '@/lib/adminStore';
import { getConfig } from '@/src/config/client';

type Primitive = string | number | boolean | null | undefined;

export type EmailTemplateVariables = Record<string, Primitive>;

function normalizeAppBaseUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';

  try {
    const parsed = new URL(trimmed);
    return `${parsed.origin}/`;
  } catch {
    return trimmed.startsWith('/') ? trimmed : '';
  }
}

function absolutizeUrl(value: string, appBaseUrl: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  const normalizedBase = normalizeAppBaseUrl(appBaseUrl);
  if (!normalizedBase) return trimmed;

  try {
    return new URL(trimmed, normalizedBase).toString();
  } catch {
    return trimmed;
  }
}

function ensureCredentialDetails(params: {
  templateKey: PlatformEmailTemplateKey;
  bodyHtml: string;
  text: string;
  vars: EmailTemplateVariables;
}) {
  const tempPassword = typeof params.vars.tempPassword === 'string' ? params.vars.tempPassword.trim() : '';
  const loginUrl = typeof params.vars.loginUrl === 'string' ? params.vars.loginUrl.trim() : '';
  const changePasswordUrl = typeof params.vars.changePasswordUrl === 'string' ? params.vars.changePasswordUrl.trim() : '';
  const appBaseUrl = typeof params.vars.appBaseUrl === 'string' ? params.vars.appBaseUrl.trim() : '';
  const otpCode = typeof params.vars.otpCode === 'string' ? params.vars.otpCode.trim() : '';

  const needsCredentialBlock = params.templateKey === 'USER_INVITE' || params.templateKey === 'PASSWORD_RESET_REQUESTED';
  if (!needsCredentialBlock) {
    return { bodyHtml: params.bodyHtml, text: params.text };
  }

  let bodyHtml = params.bodyHtml;
  let text = params.text;

  if (tempPassword && !bodyHtml.includes(tempPassword)) {
    bodyHtml += `<p><strong>Temporary password:</strong> ${escapeHtml(tempPassword)}</p>`;
  }
  if (tempPassword && !text.includes(tempPassword)) {
    text += `${text ? ' ' : ''}Temporary password: ${tempPassword}.`;
  }

  const preferredAccessUrl = loginUrl || appBaseUrl;
  if (preferredAccessUrl && !bodyHtml.includes(preferredAccessUrl)) {
    bodyHtml += `<p><strong>Access URL:</strong> <a href="${escapeHtml(preferredAccessUrl)}">${escapeHtml(preferredAccessUrl)}</a></p>`;
  }
  if (preferredAccessUrl && !text.includes(preferredAccessUrl)) {
    text += `${text ? ' ' : ''}Access URL: ${preferredAccessUrl}.`;
  }

  if (changePasswordUrl && !bodyHtml.includes(changePasswordUrl)) {
    bodyHtml += `<p><strong>Change password:</strong> <a href="${escapeHtml(changePasswordUrl)}">${escapeHtml(changePasswordUrl)}</a></p>`;
  }
  if (changePasswordUrl && !text.includes(changePasswordUrl)) {
    text += `${text ? ' ' : ''}Change password: ${changePasswordUrl}.`;
  }

  if (otpCode && !bodyHtml.includes(otpCode)) {
    bodyHtml += `<p><strong>Verification code:</strong> ${escapeHtml(otpCode)}</p>`;
  }
  if (otpCode && !text.includes(otpCode)) {
    text += `${text ? ' ' : ''}Verification code: ${otpCode}.`;
  }

  return { bodyHtml, text };
}

function renderTemplate(input: string, vars: EmailTemplateVariables): string {
  return input.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_m, key) => {
    const value = vars[key];
    return value === null || value === undefined ? '' : String(value);
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function isFaviconLikeAsset(url: string): boolean {
  return /fav(?:icon)?/i.test(String(url || ''));
}

function pickPreferredLogo(candidates: string[]): string {
  return candidates
    .map((item) => String(item || '').trim())
    .find((item) => item && !isFaviconLikeAsset(item)) || '';
}

function absolutizeEmailImageSources(html: string, appBaseUrl: string) {
  const normalizedBase = normalizeAppBaseUrl(appBaseUrl);

  return html.replace(/<img\b([^>]*?)\bsrc="([^"]+)"([^>]*)>/gi, (match, before, src, after) => {
    const trimmedSrc = String(src || '').trim();
    if (!trimmedSrc || /^https?:\/\//i.test(trimmedSrc) || /^data:/i.test(trimmedSrc) || /^cid:/i.test(trimmedSrc)) {
      return match;
    }

    if (!normalizedBase) return match;

    const absolute = absolutizeUrl(trimmedSrc, normalizedBase);
    return absolute ? `<img${before}src="${escapeHtml(absolute)}"${after}>` : '';
  });
}

async function inlineEmailImageSources(html: string, appBaseUrl: string) {
  const absolutized = absolutizeEmailImageSources(html, appBaseUrl);
  const imageTagPattern = /<img\b([^>]*?)\bsrc="([^"]+)"([^>]*)>/gi;

  const replacements = await Promise.all(Array.from(absolutized.matchAll(imageTagPattern)).map(async (match) => {
    const fullMatch = match[0];
    const before = match[1] || '';
    const src = String(match[2] || '').trim();
    const after = match[3] || '';

    if (!src || /^data:/i.test(src) || /^cid:/i.test(src)) {
      return { fullMatch, replacement: fullMatch };
    }

    try {
      const response = await fetch(src, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.startsWith('image/')) {
        throw new Error('Not an image');
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const dataUri = `data:${contentType};base64,${buffer.toString('base64')}`;
      return { fullMatch, replacement: `<img${before}src="${escapeHtml(dataUri)}"${after}>` };
    } catch {
      return { fullMatch, replacement: fullMatch };
    }
  }));

  return replacements.reduce((current, { fullMatch, replacement }) => current.replace(fullMatch, replacement), absolutized);
}

function buildMarveoBrandedHtml(params: {
  subject: string;
  preheader: string;
  bodyHtml: string;
  brandName: string;
  brandByline: string;
  logoUrl: string;
  footerLogoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  websiteUrl: string;
  footerAddressLine: string;
  footerDescription: string;
  footerBadgeText: string;
  footerStatusLabel: string;
  footerStatusUrl: string;
  footerDocsLabel: string;
  footerDocsUrl: string;
  footerGdprLabel: string;
  footerGdprUrl: string;
  footerUnsubscribeLabel: string;
  footerUnsubscribeUrl: string;
  fromName: string;
  fromEmail: string;
  supportEmail: string;
  billingEmail: string;
  deploymentEmail: string;
  appBaseUrl: string;
}) {
  const year = new Date().getFullYear();
  const brandName = params.brandName || 'Marveo';
  const normalizedAppBaseUrl = normalizeAppBaseUrl(params.appBaseUrl) || normalizeAppBaseUrl(params.websiteUrl);
  const absoluteLogoUrl = absolutizeUrl(params.logoUrl, normalizedAppBaseUrl);
  const absoluteFooterLogoUrl = absolutizeUrl(params.footerLogoUrl || params.logoUrl, normalizedAppBaseUrl);

  const supportLine = params.supportEmail
    ? `<a href="mailto:${escapeHtml(params.supportEmail)}" style="color:#0070f3;text-decoration:none;">${escapeHtml(params.supportEmail)}</a>`
    : '<span style="color:#64748b;">Set in System Settings > Email</span>';
  const fromEmailLine = params.fromEmail
    ? `<a href="mailto:${escapeHtml(params.fromEmail)}" style="color:#0070f3;text-decoration:none;">${escapeHtml(params.fromEmail)}</a>`
    : '<span style="color:#64748b;">Set in System Settings > Email</span>';

  const logoMarkup = absoluteLogoUrl
    ? `<img src="${escapeHtml(absoluteLogoUrl)}" alt="${escapeHtml(brandName)}" style="display:block;max-height:40px;max-width:180px;object-fit:contain;object-position:left center;margin:0;" />`
    : `<div style="font-size:28px;font-weight:700;color:#243375;line-height:1.1;letter-spacing:-0.02em;">${escapeHtml(brandName)}</div>`;

  const footerLogoMarkup = absoluteFooterLogoUrl
    ? `<img src="${escapeHtml(absoluteFooterLogoUrl)}" alt="${escapeHtml(brandName)}" style="display:block;max-height:56px;max-width:240px;object-fit:contain;margin:0 auto;" />`
    : logoMarkup;

  const websiteUrl = params.websiteUrl || '';
  const statusUrl = params.footerStatusUrl || (normalizedAppBaseUrl ? `${normalizedAppBaseUrl.replace(/\/$/, '')}/master/launch-readiness` : '#');
  const docsUrl = params.footerDocsUrl || (websiteUrl ? `${websiteUrl.replace(/\/$/, '')}/docs` : '#');
  const gdprUrl = params.footerGdprUrl || (websiteUrl ? `${websiteUrl.replace(/\/$/, '')}/privacy` : '#');
  const unsubscribeUrl = params.footerUnsubscribeUrl || (websiteUrl ? `${websiteUrl.replace(/\/$/, '')}/unsubscribe` : '#');
  const footerStatusLabel = params.footerStatusLabel || 'Status';
  const footerDocsLabel = params.footerDocsLabel || 'Documentation';
  const footerGdprLabel = params.footerGdprLabel || 'GDPR';
  const footerUnsubscribeLabel = params.footerUnsubscribeLabel || 'Unsubscribe';
  const footerDescription = params.footerDescription || 'Marveo unifies WordPress, headless CMS, and commerce orchestration.';
  const footerBadgeText = params.footerBadgeText || 'Built for developers and agencies';

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(params.subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#edf1f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
    <div style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;">
      ${escapeHtml(params.preheader)}
    </div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="width:560px;max-width:560px;">
            <tr>
              <td style="background:#ffffff;border-radius:20px 20px 0 0;border:1px solid #d6deeb;border-bottom:none;padding:24px 28px 14px 28px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td valign="middle" align="left" style="text-align:left;">${logoMarkup}</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="background:#ffffff;border-left:1px solid #d6deeb;border-right:1px solid #d6deeb;padding:6px 28px 20px;">
                <h1 style="margin:0 0 12px;color:#1f2937;font-size:32px;line-height:1.15;font-weight:700;letter-spacing:-0.01em;">${escapeHtml(params.subject)}</h1>
                ${params.bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="background:#ffffff;border-left:1px solid #d6deeb;border-right:1px solid #d6deeb;padding:0 28px 20px;">
                <p style="margin:0;font-size:11px;line-height:1.6;color:#67758f;">
                  You received this operational email because your address is associated with Marveo activity.
                  If this seems incorrect, contact support immediately.
                </p>
              </td>
            </tr>
            <tr>
              <td style="background:#f1f5fb;border:1px solid #d6deeb;border-top:none;border-radius:0 0 20px 20px;padding:24px 22px 28px;text-align:center;">
                <div style="margin:0 auto 10px;max-width:260px;">${footerLogoMarkup}</div>
                <p style="margin:20px 0 0;font-size:13px;line-height:1.4;">
                  <a href="${escapeHtml(statusUrl)}" style="color:#59708f;text-decoration:none;margin:0 8px;">${escapeHtml(footerStatusLabel)}</a>
                  <a href="${escapeHtml(docsUrl)}" style="color:#59708f;text-decoration:none;margin:0 8px;">${escapeHtml(footerDocsLabel)}</a>
                  <a href="${escapeHtml(gdprUrl)}" style="color:#59708f;text-decoration:none;margin:0 8px;">${escapeHtml(footerGdprLabel)}</a>
                  <a href="${escapeHtml(unsubscribeUrl)}" style="color:#59708f;text-decoration:none;margin:0 8px;">${escapeHtml(footerUnsubscribeLabel)}</a>
                </p>
                ${normalizedAppBaseUrl
                  ? `<p style="margin:16px 0 0;"><a href="${escapeHtml(normalizedAppBaseUrl)}" style="display:inline-block;padding:10px 16px;border-radius:999px;background:#0070f3;color:#ffffff;text-decoration:none;font-size:13px;font-weight:600;">Open Marveo Portal</a></p>`
                  : ''}
                <p style="margin:12px 0 0;color:#64748b;font-size:12px;line-height:1.5;">
                  <strong style="color:#334155;">Support:</strong> ${supportLine}
                  <span style="color:#94a3b8;">&nbsp;|&nbsp;</span>
                  <strong style="color:#334155;">Email:</strong> ${fromEmailLine}
                </p>
                <p style="margin:18px 0 0;color:#7c8ca9;font-size:14px;line-height:1.5;">
                  © ${year} ${escapeHtml(brandName)}. All rights reserved.<br />
                  ${params.footerAddressLine ? escapeHtml(params.footerAddressLine) : (params.websiteUrl ? escapeHtml(params.websiteUrl) : 'Configure website URL in System Settings > Branding.')}
                </p>
                <p style="margin:10px 0 0;color:#7c8ca9;font-size:13px;line-height:1.5;">${escapeHtml(footerDescription)}</p>
                <div style="margin:18px auto 0;display:inline-block;padding:10px 18px;border-radius:999px;background:#e5ebf7;color:#4f6791;font-size:14px;line-height:1.2;">
                  ${escapeHtml(footerBadgeText)}
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function normalizeRecipients(input: string[] | string): string[] {
  const raw = Array.isArray(input) ? input : [input];
  return Array.from(
    new Set(
      raw
        .flatMap((item) => String(item).split(','))
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

type SendResult =
  | { ok: true; skipped: false }
  | { ok: false; skipped: true; reason: string }
  | { ok: false; skipped: false; reason: string };

type SupportedEmailProvider = 'SMTP' | 'RESEND' | 'SES_SMTP' | 'WORDPRESS_MAILER';

const SMTP_DNS_TIMEOUT_MS = 8000;
const SMTP_CONNECT_TIMEOUT_MS = 12000;
const SMTP_GREETING_TIMEOUT_MS = 12000;
const SMTP_SOCKET_TIMEOUT_MS = 20000;

type EmailTransportOverride = {
  provider?: SupportedEmailProvider;
  host?: string;
  port?: number;
  secure?: boolean;
  username?: string;
  password?: string;
  fromEmail?: string;
  fromName?: string;
  replyToEmail?: string;
};

type EmailAttachment = {
  filename: string;
  content: Buffer | string;
  contentType?: string;
};

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

function isRetryableSmtpErrorMessage(message: string): boolean {
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

async function deliverViaSmtp(params: {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  html: string;
  text: string;
  attachments?: EmailAttachment[];
  transportOverride?: EmailTransportOverride;
}) : Promise<SendResult> {
  const store = await readAdminStore();
  const baseEmailSettings = store.platformSettings.email;
  const emailSettings = {
    ...baseEmailSettings,
    ...(params.transportOverride || {}),
  };

  if (emailSettings.provider === 'WORDPRESS_MAILER') {
    return { ok: false, skipped: true, reason: 'wordpress-mailer-provider' } as const;
  }

  if (!emailSettings.host || !emailSettings.port || !emailSettings.username || !emailSettings.password || !emailSettings.fromEmail) {
    return { ok: false, skipped: true, reason: 'incomplete-transport-config' } as const;
  }

  const attempts = buildSmtpAttempts(emailSettings.port, Boolean(emailSettings.secure));
  let lastErrorMessage = 'email-send-failed';

  for (let index = 0; index < attempts.length; index += 1) {
    const attempt = attempts[index];
    const transporter = nodemailer.createTransport({
      host: emailSettings.host,
      port: attempt.port,
      secure: attempt.secure,
      auth: {
        user: emailSettings.username,
        pass: emailSettings.password,
      },
      tls: process.env.NODE_ENV !== 'production' ? { rejectUnauthorized: false } : undefined,
      dnsTimeout: SMTP_DNS_TIMEOUT_MS,
      connectionTimeout: SMTP_CONNECT_TIMEOUT_MS,
      greetingTimeout: SMTP_GREETING_TIMEOUT_MS,
      socketTimeout: SMTP_SOCKET_TIMEOUT_MS,
    });

    try {
      await transporter.sendMail({
        from: emailSettings.fromName ? `${emailSettings.fromName} <${emailSettings.fromEmail}>` : emailSettings.fromEmail,
        replyTo: emailSettings.replyToEmail || undefined,
        to: params.to,
        cc: params.cc,
        bcc: params.bcc,
        subject: params.subject,
        html: params.html,
        text: params.text,
        attachments: params.attachments,
      });

      return { ok: true, skipped: false } as const;
    } catch (error) {
      lastErrorMessage = error instanceof Error ? error.message : 'email-send-failed';
      const canRetry = index < attempts.length - 1 && isRetryableSmtpErrorMessage(lastErrorMessage);
      if (!canRetry) {
        break;
      }
    }
  }

  return {
    ok: false,
    skipped: false,
    reason: lastErrorMessage,
  } as const;
}

function detectResendSenderDomainError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    (lower.includes('domain') && lower.includes('verify')) ||
    lower.includes('from address is not verified') ||
    lower.includes('from domain is not verified')
  );
}

async function deliverViaResend(params: {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  html: string;
  text: string;
  attachments?: EmailAttachment[];
  transportOverride?: EmailTransportOverride;
}): Promise<SendResult> {
  const store = await readAdminStore();
  const baseEmailSettings = store.platformSettings.email;
  const emailSettings = {
    ...baseEmailSettings,
    ...(params.transportOverride || {}),
  };

  if (!emailSettings.fromEmail) {
    return { ok: false, skipped: true, reason: 'resend-missing-from-email' } as const;
  }

  const apiKey = String(process.env.RESEND_API_KEY || '').trim();
  if (!apiKey) {
    return { ok: false, skipped: true, reason: 'resend-api-key-missing' } as const;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: emailSettings.fromName
          ? `${emailSettings.fromName} <${emailSettings.fromEmail}>`
          : emailSettings.fromEmail,
        reply_to: emailSettings.replyToEmail || undefined,
        to: params.to,
        cc: params.cc,
        bcc: params.bcc,
        subject: params.subject,
        html: params.html,
        text: params.text,
        attachments: params.attachments?.map((attachment) => ({
          filename: attachment.filename,
          content: Buffer.isBuffer(attachment.content)
            ? attachment.content.toString('base64')
            : Buffer.from(String(attachment.content)).toString('base64'),
          content_type: attachment.contentType || 'application/octet-stream',
        })),
      }),
    });

    if (response.ok) {
      return { ok: true, skipped: false } as const;
    }

    const body = (await response.json().catch(() => null)) as
      | { message?: string; error?: string; name?: string }
      | null;
    const detail = String(body?.message || body?.error || body?.name || 'resend-send-failed').trim();

    if (response.status === 401 || response.status === 403) {
      return { ok: false, skipped: false, reason: 'resend-authentication-failed' } as const;
    }

    if (detectResendSenderDomainError(detail)) {
      return { ok: false, skipped: false, reason: 'resend-sender-domain-not-verified' } as const;
    }

    return { ok: false, skipped: false, reason: detail || 'resend-send-failed' } as const;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'resend-send-failed';
    if (detectResendSenderDomainError(message)) {
      return { ok: false, skipped: false, reason: 'resend-sender-domain-not-verified' } as const;
    }
    return { ok: false, skipped: false, reason: message } as const;
  }
}

async function deliverViaConfiguredProvider(params: {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  html: string;
  text: string;
  attachments?: EmailAttachment[];
  transportOverride?: EmailTransportOverride;
}): Promise<SendResult> {
  const store = await readAdminStore();
  const baseEmailSettings = store.platformSettings.email;
  const provider = (params.transportOverride?.provider || baseEmailSettings.provider || 'SMTP') as SupportedEmailProvider;

  if (provider === 'WORDPRESS_MAILER') {
    return { ok: false, skipped: true, reason: 'wordpress-mailer-provider' } as const;
  }

  if (provider === 'RESEND') {
    return deliverViaResend(params);
  }

  return deliverViaSmtp(params);
}

export async function renderPlatformEmailTemplatePreview(params: {
  templateKey: PlatformEmailTemplateKey;
  variables?: EmailTemplateVariables;
  fallbackSubject?: string;
}) {
  const store = await readAdminStore();
  const emailSettings = store.platformSettings.email;
  const branding = store.platformSettings.branding;
  const config = getConfig();
  const template = store.platformSettings.emailTemplates[params.templateKey];

  if (!template) {
    return { ok: false, reason: 'template-not-found' } as const;
  }

  const vars: EmailTemplateVariables = params.variables || {};
  const resolvedLogoUrl = pickPreferredLogo([
    branding.logoUrl,
    branding.dashboardLogoUrl,
    branding.portalLoginLogoUrl,
    config.clientLogo || '',
  ]);
  const resolvedFooterLogoUrl = pickPreferredLogo([
    branding.footerLogoUrl,
    branding.logoUrl,
    branding.dashboardLogoUrl,
    branding.portalLoginLogoUrl,
    config.clientLogo || '',
  ]) || resolvedLogoUrl;
  const resolvedAppBaseUrl =
    emailSettings.appBaseUrl
    || (typeof vars.appBaseUrl === 'string' ? vars.appBaseUrl : '')
    || branding.websiteUrl
    || config.frontendUrl
    || '';
  const subject = renderTemplate(template.subject || params.fallbackSubject || 'Marveo notification', vars);
  const preheader = renderTemplate(template.preheader || '', vars);
  const renderedBodyHtml = renderTemplate(template.html || '', vars);
  const renderedText = renderTemplate(template.text || '', vars);
  const { bodyHtml, text } = ensureCredentialDetails({
    templateKey: params.templateKey,
    bodyHtml: renderedBodyHtml,
    text: renderedText,
    vars,
  });
  const html = buildMarveoBrandedHtml({
    subject,
    preheader,
    bodyHtml,
    brandName: branding.brandName || 'Marveo',
    brandByline: branding.brandByline || '',
    logoUrl: resolvedLogoUrl,
    footerLogoUrl: resolvedFooterLogoUrl,
    primaryColor: branding.primaryColor || '#0f172a',
    secondaryColor: branding.secondaryColor || '#0ea5e9',
    websiteUrl: branding.websiteUrl || '',
    footerAddressLine: branding.footerAddressLine || '',
    footerDescription: branding.footerDescription || '',
    footerBadgeText: branding.footerBadgeText || '',
    footerStatusLabel: branding.footerStatusLabel || '',
    footerStatusUrl: branding.footerStatusUrl || '',
    footerDocsLabel: branding.footerDocsLabel || '',
    footerDocsUrl: branding.footerDocsUrl || '',
    footerGdprLabel: branding.footerGdprLabel || '',
    footerGdprUrl: branding.footerGdprUrl || '',
    footerUnsubscribeLabel: branding.footerUnsubscribeLabel || '',
    footerUnsubscribeUrl: branding.footerUnsubscribeUrl || '',
    fromName: emailSettings.fromName || 'Marveo Operations',
    fromEmail: emailSettings.fromEmail || '',
    supportEmail: emailSettings.supportEmail || '',
    billingEmail: emailSettings.billingEmail || '',
    deploymentEmail: emailSettings.deploymentEmail || '',
    appBaseUrl: resolvedAppBaseUrl,
  });
   const inlinedHtml = await inlineEmailImageSources(html, resolvedAppBaseUrl);

  return {
    ok: true,
    subject,
    preheader,
      html: inlinedHtml,
    text,
  } as const;
}

export async function sendPlatformEmailNotification(params: {
  templateKey: PlatformEmailTemplateKey;
  to: string[] | string;
  variables?: EmailTemplateVariables;
  fallbackSubject?: string;
  cc?: string[] | string;
  bcc?: string[] | string;
  attachments?: EmailAttachment[];
}) {
  const store = await readAdminStore();
  const emailSettings = store.platformSettings.email;
  const template = store.platformSettings.emailTemplates[params.templateKey];

  if (!emailSettings.enabled) {
    return { ok: false, skipped: true, reason: 'email-disabled' } as const;
  }

  if (!template || !template.enabled) {
    return { ok: false, skipped: true, reason: 'template-disabled' } as const;
  }

  const to = normalizeRecipients(params.to);
  if (to.length === 0) {
    return { ok: false, skipped: true, reason: 'no-recipient' } as const;
  }

  const vars: EmailTemplateVariables = params.variables || {};
  const rendered = await renderPlatformEmailTemplatePreview({
    templateKey: params.templateKey,
    variables: vars,
    fallbackSubject: params.fallbackSubject,
  });
  if (!rendered.ok) {
    return { ok: false, skipped: true, reason: rendered.reason } as const;
  }

  return deliverViaConfiguredProvider({
    to,
    cc: params.cc ? normalizeRecipients(params.cc) : undefined,
    bcc: params.bcc ? normalizeRecipients(params.bcc) : undefined,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    attachments: params.attachments,
  });
}

export async function sendPlatformTestEmail(params: {
  templateKey: PlatformEmailTemplateKey;
  to: string[] | string;
  variables?: EmailTemplateVariables;
  fallbackSubject?: string;
  transportOverride?: EmailTransportOverride;
  attachments?: EmailAttachment[];
}) {
  const to = normalizeRecipients(params.to);
  if (to.length === 0) {
    return { ok: false, skipped: true, reason: 'no-recipient' } as const;
  }

  const rendered = await renderPlatformEmailTemplatePreview({
    templateKey: params.templateKey,
    variables: params.variables || {},
    fallbackSubject: params.fallbackSubject,
  });
  if (!rendered.ok) {
    return { ok: false, skipped: true, reason: rendered.reason } as const;
  }

  return deliverViaConfiguredProvider({
    to,
    subject: `[TEST] ${rendered.subject}`,
    html: rendered.html,
    text: rendered.text,
    attachments: params.attachments,
    transportOverride: params.transportOverride,
  });
}

export async function sendPlatformDirectEmail(params: {
  to: string[] | string;
  subject: string;
  html: string;
  text: string;
  cc?: string[] | string;
  bcc?: string[] | string;
  attachments?: EmailAttachment[];
  transportOverride?: EmailTransportOverride;
}) {
  const to = normalizeRecipients(params.to);
  if (to.length === 0) {
    return { ok: false, skipped: true, reason: 'no-recipient' } as const;
  }

  return deliverViaConfiguredProvider({
    to,
    cc: params.cc ? normalizeRecipients(params.cc) : undefined,
    bcc: params.bcc ? normalizeRecipients(params.bcc) : undefined,
    subject: params.subject,
    html: params.html,
    text: params.text,
    attachments: params.attachments,
    transportOverride: params.transportOverride,
  });
}

export async function sendPlatformFailureAlert(params: {
  failureType: string;
  errorMessage: string;
  operationName?: string;
  workspaceId?: string;
}) {
  const store = await readAdminStore();
  const emailSettings = store.platformSettings.email;

  if (!emailSettings.sendFailureAlerts) {
    return { ok: false, skipped: true, reason: 'failure-alerts-disabled' } as const;
  }

  const recipients = normalizeRecipients([
    ...(emailSettings.failureAlertRecipients || []),
    emailSettings.supportEmail || '',
    emailSettings.userOpsEmail || '',
  ]);

  if (recipients.length === 0) {
    return { ok: false, skipped: true, reason: 'no-failure-recipients' } as const;
  }

  return sendPlatformEmailNotification({
    templateKey: 'SYSTEM_FAILURE_ALERT',
    to: recipients,
    variables: {
      failureType: params.failureType,
      errorMessage: params.errorMessage,
      operationName: params.operationName || '',
      workspaceId: params.workspaceId || '',
      occurredAt: new Date().toISOString(),
    },
    fallbackSubject: `System failure alert: ${params.failureType}`,
  });
}
