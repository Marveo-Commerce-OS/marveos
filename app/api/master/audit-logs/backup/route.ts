import { NextRequest, NextResponse } from 'next/server';
import { readAdminStore, appendAuditLog, type AuditRecord } from '@/lib/adminStore';
import { requireActionPermission } from '@/lib/master/permissions/guards';
import ExcelJS from 'exceljs';

function stamp(now: Date): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  const hour = String(now.getUTCHours()).padStart(2, '0');
  const minute = String(now.getUTCMinutes()).padStart(2, '0');
  return `${year}${month}${day}-${hour}${minute}`;
}

function toCsv(logs: AuditRecord[], exportedAt: string, exportedBy: string): string {
  const headerLine = ['id', 'at', 'actorEmail', 'action', 'target', 'details'].join(',');
  const rows = logs.map((l) =>
    [l.id, l.at, l.actorEmail, l.action, l.target, l.details ?? '']
      .map((c) => `"${String(c).replace(/"/g, '""')}"`)
      .join(','),
  );
  return [`# Marveo Audit Log Export — ${exportedAt} — by ${exportedBy}`, headerLine, ...rows].join('\n');
}

async function toXlsx(logs: AuditRecord[], exportedAt: string, exportedBy: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = exportedBy;
  wb.created = new Date(exportedAt);

  const ws = wb.addWorksheet('Audit Logs');
  ws.columns = [
    { header: 'ID', key: 'id', width: 30 },
    { header: 'Timestamp (UTC)', key: 'at', width: 25 },
    { header: 'Actor Email', key: 'actorEmail', width: 30 },
    { header: 'Action', key: 'action', width: 40 },
    { header: 'Target', key: 'target', width: 30 },
    { header: 'Details', key: 'details', width: 50 },
  ];

  // Bold header row
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };

  for (const log of logs) {
    ws.addRow({
      id: log.id,
      at: new Date(log.at).toLocaleString(),
      actorEmail: log.actorEmail,
      action: log.action,
      target: log.target,
      details: log.details ?? '',
    });
  }

  const meta = wb.addWorksheet('Export Info');
  meta.addRow(['Exported At', exportedAt]);
  meta.addRow(['Exported By', exportedBy]);
  meta.addRow(['Total Entries', logs.length]);

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function GET(req: NextRequest) {
  const auth = await requireActionPermission('auditLogs', 'export');
  if ('error' in auth) return auth.error;

  const format = (req.nextUrl.searchParams.get('format') ?? 'json').toLowerCase();
  const now = new Date();
  const store = await readAdminStore();
  const actorEmail = String(auth.session.user?.user_email ?? 'unknown');
  const ts = stamp(now);

  // Record the backup so the retention status card can display "Last backup"
  await appendAuditLog({
    actorEmail,
    action: 'master.audit.backup_downloaded',
    target: 'audit-logs',
    details: `count=${store.audit.length};format=${format}`,
  });

  if (format === 'csv') {
    const csv = toCsv(store.audit, now.toISOString(), actorEmail);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="audit-logs-${ts}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  if (format === 'xlsx') {
    const buffer = await toXlsx(store.audit, now.toISOString(), actorEmail);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="audit-logs-${ts}.xlsx"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  // Default: JSON
  const payload = {
    exportedAt: now.toISOString(),
    exportedBy: actorEmail,
    count: store.audit.length,
    logs: store.audit,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="audit-logs-${ts}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}
