import { NextRequest, NextResponse } from 'next/server';
import PDFDocument from 'pdfkit';
import * as XLSX from 'xlsx';
import { getSession, isSuperAdmin } from '@/lib/auth';
import { readAdminStore } from '@/lib/adminStore';

export const runtime = 'nodejs';

type ExportRow = {
  Date: string;
  Actor: string;
  Action: string;
  Target: string;
  Details: string;
};

function toRows() {
  return async (): Promise<ExportRow[]> => {
    const store = await readAdminStore();
    return store.audit.map((log) => ({
      Date: log.at,
      Actor: log.actorEmail,
      Action: log.action,
      Target: log.target,
      Details: log.details ?? '',
    }));
  };
}

async function renderPdf(rows: ExportRow[]) {
  return await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 36, size: 'A4' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(16).text('PRAG Admin Audit Backup');
    doc.moveDown(0.5);
    doc.fontSize(9).fillColor('#555').text(`Generated: ${new Date().toISOString()}`);
    doc.moveDown(1);

    rows.forEach((row, index) => {
      if (doc.y > 760) doc.addPage();
      doc.fillColor('#111').fontSize(10).text(`${index + 1}. ${row.Date}`);
      doc.fillColor('#333').fontSize(9).text(`Actor: ${row.Actor}`);
      doc.text(`Action: ${row.Action}`);
      doc.text(`Target: ${row.Target}`);
      if (row.Details) doc.text(`Details: ${row.Details}`);
      doc.moveDown(0.7);
    });

    if (rows.length === 0) {
      doc.fillColor('#444').fontSize(10).text('No audit records available.');
    }

    doc.end();
  });
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ok = await isSuperAdmin(session.token);
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const format = req.nextUrl.searchParams.get('format')?.toLowerCase();
  const rows = await toRows()();

  if (format === 'excel' || format === 'xlsx') {
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Audit');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="audit-backup-${Date.now()}.xlsx"`,
      },
    });
  }

  if (format === 'pdf') {
    const buffer = await renderPdf(rows);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="audit-backup-${Date.now()}.pdf"`,
      },
    });
  }

  return NextResponse.json({ error: 'Unsupported format. Use format=pdf or format=excel.' }, { status: 400 });
}
