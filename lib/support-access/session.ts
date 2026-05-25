import { NextRequest, NextResponse } from 'next/server';
import { appendAuditLog } from '@/lib/adminStore';
import { validateSupportSessionToken } from './validateSupportSession';

export async function requireSupportAccessSession(req: NextRequest, input: {
  actorEmail: string;
  supportUserId?: string;
  workspaceId?: string;
  auditTarget: string;
}): Promise<{ ok: true } | { error: NextResponse }> {
  const token = req.headers.get('x-marveo-support-session') || '';
  if (!token) {
    return { error: NextResponse.json({ error: 'Support access session token is required' }, { status: 403 }) };
  }

  const validated = validateSupportSessionToken({
    token,
    workspaceId: input.workspaceId,
    supportUserId: input.supportUserId,
  });
  if (!validated.ok) {
    return { error: NextResponse.json({ error: validated.reason }, { status: 403 }) };
  }

  await appendAuditLog({
    actorEmail: input.actorEmail,
    action: 'support.session.validated',
    target: input.auditTarget,
    details: `session_id=${validated.session.id};workspace=${validated.session.workspaceId};expires_at=${validated.session.expiresAt}`,
  });

  return { ok: true };
}
