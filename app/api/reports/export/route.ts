import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

import { getConfig } from '@/src/config/client';

const getWpApiUrl = () => {
  const config = getConfig();
  return config.wordpressApiUrl || 'https://localhost/wp-json';
};

function getWcBase() { return `${getWpApiUrl()}/wc/v3`; }

function auth() {
  const config = getConfig();
  const key = config.woocommerceConsumerKey ?? '';
  const secret = config.woocommerceConsumerSecret ?? '';
  return `consumer_key=${key}&consumer_secret=${secret}`;
}

interface Order {
  id: number;
  status: string;
  date_created: string;
  total: string;
  billing: { first_name: string; last_name: string; email: string };
}

async function fetchOrders(date_min: string, date_max: string): Promise<Order[]> {
  const all: Order[] = [];
  let page = 1;

  while (true) {
    const qs = new URLSearchParams({
      per_page: '100',
      page: String(page),
      status: 'any',
      ...(date_min && { after: `${date_min}T00:00:00` }),
      ...(date_max && { before: `${date_max}T23:59:59` }),
    });

    const res = await fetch(`${getWcBase()}/orders?${qs}&${auth()}`, { cache: 'no-store' });
    if (!res.ok) break;

    const orders: Order[] = await res.json();
    if (orders.length === 0) break;
    all.push(...orders);
    if (orders.length < 100) break;
    page++;
  }

  return all;
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const format = searchParams.get('format') ?? 'excel';
  const date_min = searchParams.get('date_min') ?? '';
  const date_max = searchParams.get('date_max') ?? '';

  const orders = await fetchOrders(date_min, date_max);
  const totalRevenue = orders.reduce((sum, o) => sum + parseFloat(o.total || '0'), 0);

  if (format === 'excel') {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sales Report');

    worksheet.columns = [
      { header: 'Order ID', key: 'id', width: 10 },
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Customer', key: 'customer', width: 22 },
      { header: 'Email', key: 'email', width: 28 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Total (₦)', key: 'total', width: 14 },
    ];

    worksheet.getRow(1).font = { bold: true };

    for (const order of orders) {
      worksheet.addRow({
        id: order.id,
        date: order.date_created.split('T')[0],
        customer: `${order.billing.first_name} ${order.billing.last_name}`.trim(),
        email: order.billing.email,
        status: order.status,
        total: parseFloat(order.total),
      });
    }

    worksheet.addRow({});
    worksheet.addRow({ status: 'Total Revenue (₦)', total: totalRevenue });
    worksheet.addRow({ status: 'Total Orders', total: orders.length });

    const buf = Buffer.from(await workbook.xlsx.writeBuffer() as ArrayBuffer);

    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="sales-report-${date_min}-${date_max}.xlsx"`,
      },
    });
  }

  // PDF
  return new Promise<NextResponse>((resolve) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => {
      resolve(
        new NextResponse(Buffer.concat(chunks), {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="sales-report-${date_min}-${date_max}.pdf"`,
          },
        })
      );
    });

    doc.fontSize(18).font('Helvetica-Bold').text('PRAG Sales Report', { align: 'center' });
    doc.moveDown(0.4);
    doc.fontSize(11).font('Helvetica').text(`Period: ${date_min} to ${date_max}`, { align: 'center' });
    doc.moveDown(1);

    doc.fontSize(12).font('Helvetica-Bold').text('Summary');
    doc.moveDown(0.3);
    doc.fontSize(11).font('Helvetica');
    doc.text(`Total Revenue: ₦${totalRevenue.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`);
    doc.text(`Total Orders: ${orders.length}`);
    if (orders.length > 0) {
      const avg = totalRevenue / orders.length;
      doc.text(`Average Order Value: ₦${avg.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`);
    }
    doc.moveDown(1);

    doc.fontSize(12).font('Helvetica-Bold').text('Order Details');
    doc.moveDown(0.5);

    const colX = [40, 90, 170, 300, 420, 490];
    const headers = ['ID', 'Date', 'Customer', 'Email', 'Status', 'Total (₦)'];
    const colW = [50, 80, 130, 120, 70, 80];

    doc.fontSize(9).font('Helvetica-Bold');
    headers.forEach((h, i) => doc.text(h, colX[i], doc.y, { width: colW[i], lineBreak: false }));
    doc.moveDown(0.6);

    doc.font('Helvetica').fontSize(8);
    for (const o of orders.slice(0, 300)) {
      if (doc.y > 750) doc.addPage();
      const y = doc.y;
      const cells = [
        String(o.id),
        o.date_created.split('T')[0],
        `${o.billing.first_name} ${o.billing.last_name}`.trim().slice(0, 20),
        o.billing.email.slice(0, 24),
        o.status,
        parseFloat(o.total).toLocaleString('en-NG', { maximumFractionDigits: 0 }),
      ];
      cells.forEach((cell, i) => doc.text(cell, colX[i], y, { width: colW[i], lineBreak: false }));
      doc.moveDown(0.5);
    }

    doc.end();
  });
}
