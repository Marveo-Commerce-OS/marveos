import { NextRequest, NextResponse } from 'next/server';
import { appendAuditLog, readAdminStore, updateAdminStore } from '@/lib/adminStore';
import { getCurrentPlatformUser, isSuperAdmin } from '@/lib/auth';
import { requireActionPermission } from '@/lib/master/permissions/guards';

export async function POST(req: NextRequest) {
  const auth = await requireActionPermission('auditLogs', 'delete');
  if ('error' in auth) return auth.error;

  const canPurge = await isSuperAdmin(auth.session.token);
  if (!canPurge) {
    return NextResponse.json(
      { error: 'Purge requires Super Admin approval.' },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => null);
  const confirmText = String((body as { confirmText?: unknown } | null)?.confirmText || '').trim().toUpperCase();
  if (confirmText !== 'PURGE') {
    return NextResponse.json({ error: 'confirmText must be PURGE.' }, { status: 400 });
  }

  const store = await readAdminStore();
  const deletedCount = store.audit.length;

  await updateAdminStore((current) => ({
    ...current,
    audit: [],
  }));

  const actor = await getCurrentPlatformUser(auth.session.token);
  await appendAuditLog({
    actorEmail: actor?.email ?? String(auth.session.user?.user_email ?? 'unknown'),
    action: 'master.audit.purged',
    target: 'audit-log-stream',
    details: `deletedEntries=${deletedCount}`,
  });

  return NextResponse.json({ ok: true, deletedCount });
}
