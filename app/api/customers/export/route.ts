import { NextRequest, NextResponse } from 'next/server';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { getSession, getCurrentWpUser, isAdmin } from '@/lib/auth';
import { getAllCustomers } from '@/lib/api';
import { appendAuditLog } from '@/lib/adminStore';

function customerRows(customers: Awaited<ReturnType<typeof getAllCustomers>>) {
  return customers.map((c) => ({
    id: c.id,
    first_name: c.first_name,
    last_name: c.last_name,
    email: c.email,
    phone: c.billing?.phone ?? '',
    city: c.billing?.city ?? '',
    state: c.billing?.state ?? '',
    orders_count: c.orders_count,
    total_spent: c.total_spent,
    date_created: c.date_created,
  }));
}

function toCsv(rows: ReturnType<typeof customerRows>) {
  const headers = Object.keys(rows[0] ?? {
    id: '', first_name: '', last_name: '', email: '', phone: '', city: '', state: '', orders_count: '', total_spent: '', date_created: '',
  });

  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(
      headers
        .map((h) => {
          const value = String((row as Record<string, unknown>)[h] ?? '');
          return `"${value.replaceAll('"', '""')}"`;
        })
        .join(','),
    );
  }
  return lines.join('\n');
}

function toPdfBuffer(rows: ReturnType<typeof customerRows>) {
  return new Promise<Buffer>((resolve) => {
    const doc = new PDFDocument({ margin: 36, size: 'A4' });
    const buffers: Buffer[] = [];

    doc.on('data', (chunk) => buffers.push(Buffer.from(chunk)));
    doc.on('end', () => resolve(Buffer.concat(buffers)));

    doc.fontSize(16).text('PRAG Customers Export', { align: 'left' });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#666').text(`Generated: ${new Date().toLocaleString('en-GB')}`);
    doc.fillColor('#000');
    doc.moveDown(1);

    for (const row of rows) {
      doc.fontSize(10).text(`${row.first_name} ${row.last_name} <${row.email}>`);
      doc.fontSize(9).fillColor('#555').text(`Phone: ${row.phone || '—'} | Location: ${[row.city, row.state].filter(Boolean).join(', ') || '—'} | Orders: ${row.orders_count} | Total: ${row.total_spent}`);
      doc.fillColor('#000');
      doc.moveDown(0.6);
      if (doc.y > 760) {
        doc.addPage();
      }
    }

    doc.end();
  });
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ok = await isAdmin(session.token);
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const format = req.nextUrl.searchParams.get('format') ?? 'xlsx';
  const customers = await getAllCustomers(1000);
  const rows = customerRows(customers);

  const actor = await getCurrentWpUser(session.token);
  await appendAuditLog({
    actorEmail: actor?.email ?? session.user?.user_email ?? 'unknown',
    action: 'customers.exported',
    target: `customers:${format}`,
    details: `Exported ${rows.length} customers.`,
  });

  if (format === 'csv') {
    const csv = toCsv(rows);
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="customers-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  if (format === 'pdf') {
    const pdf = await toPdfBuffer(rows);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="customers-${new Date().toISOString().slice(0, 10)}.pdf"`,
      },
    });
  }

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Customers');
  worksheet.columns = [
    { header: 'id', key: 'id', width: 10 },
    { header: 'first_name', key: 'first_name', width: 18 },
    { header: 'last_name', key: 'last_name', width: 18 },
    { header: 'email', key: 'email', width: 30 },
    { header: 'phone', key: 'phone', width: 18 },
    { header: 'city', key: 'city', width: 16 },
    { header: 'state', key: 'state', width: 16 },
    { header: 'orders_count', key: 'orders_count', width: 14 },
    { header: 'total_spent', key: 'total_spent', width: 14 },
    { header: 'date_created', key: 'date_created', width: 24 },
  ];
  worksheet.getRow(1).font = { bold: true };
  rows.forEach((row) => worksheet.addRow(row));
  const xlsx = Buffer.from(await workbook.xlsx.writeBuffer() as ArrayBuffer);

  return new NextResponse(new Uint8Array(xlsx), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="customers-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
