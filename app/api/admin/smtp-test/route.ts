import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { getSession, getCurrentWpUser, isSuperAdmin } from '@/lib/auth';
import { appendAuditLog, readAdminStore } from '@/lib/adminStore';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ok = await isSuperAdmin(session.token);
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = (await req.json()) as { to?: string };
  const to = String(body.to ?? '').trim();
  if (!to) return NextResponse.json({ error: 'Recipient email is required.' }, { status: 400 });

  const store = await readAdminStore();
  const smtp = store.smtp;

  if (!smtp.host || !smtp.port || !smtp.username || !smtp.password || !smtp.fromEmail) {
    return NextResponse.json({ error: 'SMTP settings are incomplete. Save host, port, username, password, and from email first.' }, { status: 400 });
  }

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: {
      user: smtp.username,
      pass: smtp.password,
    },
  });

  try {
    await transporter.verify();
    await transporter.sendMail({
      from: smtp.fromName ? `${smtp.fromName} <${smtp.fromEmail}>` : smtp.fromEmail,
      to,
      subject: 'PRAG SMTP test email',
      text: `This is a test email from the PRAG admin portal.\n\nSent at: ${new Date().toISOString()}`,
      html: `<p>This is a test email from the PRAG admin portal.</p><p>Sent at: ${new Date().toISOString()}</p>`,
    });

    const actor = await getCurrentWpUser(session.token);
    await appendAuditLog({
      actorEmail: actor?.email ?? session.user?.user_email ?? 'unknown',
      action: 'smtp.test.sent',
      target: to,
      details: 'SMTP test email sent successfully.',
    });

    return NextResponse.json({ success: true, message: `Test email sent to ${to}.` });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'SMTP test failed.';
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}