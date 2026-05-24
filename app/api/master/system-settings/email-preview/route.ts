import { NextRequest, NextResponse } from 'next/server';
import { getSession, isAdmin } from '@/lib/auth';
import { PLATFORM_EMAIL_TEMPLATE_KEYS } from '@/lib/adminStore';
import { renderPlatformEmailTemplatePreview } from '@/lib/emailNotifications';

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

  const variables = (body as { variables?: unknown }).variables;
  if (variables && (typeof variables !== 'object' || Array.isArray(variables))) {
    return badRequest('variables must be an object.');
  }

  const preview = await renderPlatformEmailTemplatePreview({
    templateKey: templateKey as typeof PLATFORM_EMAIL_TEMPLATE_KEYS[number],
    variables: (variables as Record<string, string | number | boolean | null | undefined>) || {},
  });

  if (!preview.ok) {
    return NextResponse.json({ error: preview.reason || 'Could not render preview.' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    subject: preview.subject,
    preheader: preview.preheader,
    html: preview.html,
    text: preview.text,
  });
}
