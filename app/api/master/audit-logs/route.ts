import { NextRequest, NextResponse } from 'next/server';
import { readAdminStore, type AuditRecord } from '@/lib/adminStore';
import { requireActionPermission } from '@/lib/master/permissions/guards';
import { isSuperAdmin } from '@/lib/auth';

const PAGE_SIZE = 30;

// An action is considered "client-facing" when it involves workspace, onboarding,
// billing, connector, payment, or ticket activity. Everything else is "internal" (us).
function resolveLogOrigin(log: AuditRecord): 'client' | 'internal' {
  const a = log.action.toLowerCase();
  if (
    a.includes('client') ||
    a.includes('workspace') ||
    a.includes('onboarding') ||
    a.includes('billing') ||
    a.includes('subscription') ||
    a.includes('payment') ||
    a.includes('connector') ||
    a.includes('ticket') ||
    a.includes('complaint') ||
    a.includes('support.access')
  ) return 'client';
  return 'internal';
}

function retentionMetadata(audit: AuditRecord[]) {
  const purge = audit.find((e) => e.action === 'master.audit.purged');
  const reminder = audit.find((e) => e.action === 'master.audit.retention_reminder.sent');
  const backup = audit.find((e) => e.action === 'master.audit.backup_downloaded');
  return {
    lastPurgeAt: purge?.at ?? null,
    lastReminderAt: reminder?.at ?? null,
    lastBackupAt: backup?.at ?? null,
  };
}

export async function GET(req: NextRequest) {
  const auth = await requireActionPermission('auditLogs', 'view');
  if ('error' in auth) return auth.error;

  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, Number(sp.get('page') ?? '1'));
  const origin = sp.get('origin') ?? 'all';          // 'all' | 'client' | 'internal'
  const fromDate = sp.get('from') ?? '';             // ISO date string yyyy-mm-dd
  const toDate = sp.get('to') ?? '';
  const year = sp.get('year') ?? '';
  const search = (sp.get('search') ?? '').trim().toLowerCase();

  const store = await readAdminStore();
  const canPurge = await isSuperAdmin(auth.session.token);
  let logs = [...store.audit];

  // ── Resolve client search terms against identity store ────────────────────
  // If a search term looks like it could be a client ID / name / email,
  // we expand it to a set of emails/IDs found in nativeAuth.identities and
  // include those emails in the log search scope.
  const extraMatchEmails = new Set<string>();
  if (search) {
    for (const identity of Object.values(store.nativeAuth.identities)) {
      const emailLower = identity.email.toLowerCase();
      const nameLower = (identity.name ?? '').toLowerCase();
      const idLower = identity.id.toLowerCase();
      if (emailLower.includes(search) || nameLower.includes(search) || idLower.includes(search)) {
        extraMatchEmails.add(emailLower);
        // Also add the identity id itself so it matches in target/details fields
        extraMatchEmails.add(idLower);
        // Include organisationId so org-level lookups also surface
        if (identity.organizationId) extraMatchEmails.add(identity.organizationId.toLowerCase());
      }
    }
  }

  // ── Filter by origin (independent - applies even without other filters) ───
  if (origin === 'client') {
    logs = logs.filter((l) => resolveLogOrigin(l) === 'client');
  } else if (origin === 'internal') {
    logs = logs.filter((l) => resolveLogOrigin(l) === 'internal');
  }

  // ── Filter by year ────────────────────────────────────────────────────────
  if (year) {
    logs = logs.filter((l) => l.at.startsWith(year));
  }

  // ── Filter by date range ──────────────────────────────────────────────────
  if (fromDate) {
    const from = new Date(`${fromDate}T00:00:00.000Z`).getTime();
    if (!Number.isNaN(from)) {
      logs = logs.filter((l) => new Date(l.at).getTime() >= from);
    }
  }
  if (toDate) {
    const to = new Date(`${toDate}T23:59:59.999Z`).getTime();
    if (!Number.isNaN(to)) {
      logs = logs.filter((l) => new Date(l.at).getTime() <= to);
    }
  }

  // ── Full-text + client identity search ────────────────────────────────────
  if (search) {
    logs = logs.filter((l) => {
      const blob = [l.actorEmail, l.action, l.target, l.details ?? ''].join(' ').toLowerCase();
      // Direct text match
      if (blob.includes(search)) return true;
      // Match via resolved identity (client ID / name / org)
      for (const token of extraMatchEmails) {
        if (blob.includes(token) || l.actorEmail.toLowerCase() === token) return true;
      }
      return false;
    });
  }

  // ── Sort newest-first ─────────────────────────────────────────────────────
  logs.sort((a, b) => b.at.localeCompare(a.at));

  const totalCount = logs.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * PAGE_SIZE;
  const pageLogs = logs.slice(offset, offset + PAGE_SIZE);

  // ── Derive available years for filter dropdown ────────────────────────────
  const availableYears = Array.from(
    new Set(store.audit.map((l) => l.at.slice(0, 4))),
  ).sort((a, b) => b.localeCompare(a));

  return NextResponse.json({
    logs: pageLogs,
    totalCount,
    page: safePage,
    totalPages,
    pageSize: PAGE_SIZE,
    availableYears,
    retention: retentionMetadata(store.audit),
    canPurge,
  });
}
