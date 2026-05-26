export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import PDFDocument from 'pdfkit';
import { requireActionPermission } from '@/lib/master/permissions/guards';

/* ── Types matching OverviewAnalytics client stats ─────────────────────── */
type WorkspaceStatus = 'draft' | 'onboarding' | 'ready_for_launch' | 'launched' | 'blocked';

type DecisionDashboardPayload = {
  generatedAt: string;
  filters: {
    period: string;
    country: string;
    state: string;
    websiteType: string;
  };
  totalWorkspaces: number;
  launchReadinessRate: number;
  statusCounts: Record<WorkspaceStatus, number>;
  connectorCounts: {
    connected: number;
    pending: number;
    failed: number;
    notConnected: number;
  };
  supportLoad: {
    requiringSupport: number;
    unresolved: number;
  };
  timeline: {
    labels: string[];
    values: number[];
  };
};

function toTitle(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function humanPeriod(period: string): string {
  if (period === 'all') return 'All time';
  return `Last ${period} days`;
}

/* ── PDF builder ──────────────────────────────────────────────────────────── */
async function buildPdf(payload: DecisionDashboardPayload): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      bufferPages: true,
      info: {
        Title: 'Decision Dashboard Report',
        Author: 'Marvéo Platform',
        Subject: 'Operational analytics report',
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width - 100; // usable width
    const BRAND = '#1e3a8a'; // indigo-900

    /* ── Header ─────────────────────────────────────────────────────────── */
    doc
      .rect(50, 40, W, 58)
      .fill(BRAND);
    doc
      .fillColor('#ffffff')
      .fontSize(22)
      .font('Helvetica-Bold')
      .text('Decision Dashboard Report', 60, 52, { width: W - 20 });
    doc
      .fontSize(9)
      .font('Helvetica')
      .text(`Generated: ${new Date(payload.generatedAt).toLocaleString('en-GB', { timeZone: 'UTC' })} UTC`, 60, 78);

    doc.moveDown(3.5).fillColor('#1e293b');

    /* ── Applied filters block ───────────────────────────────────────────── */
    doc.fontSize(11).font('Helvetica-Bold').fillColor(BRAND).text('Applied Filters', { underline: false });
    doc.moveDown(0.3);
    doc.fontSize(9).font('Helvetica').fillColor('#334155');
    const f = payload.filters;
    const filterLines = [
      `Period: ${humanPeriod(f.period)}`,
      `Country: ${f.country === 'all' ? 'All countries' : f.country}`,
      `State / Region: ${f.state === 'all' ? 'All' : f.state}`,
      `Website Type: ${f.websiteType === 'all' ? 'All types' : toTitle(f.websiteType)}`,
    ];
    for (const line of filterLines) {
      doc.text(`• ${line}`, { indent: 12 });
    }
    doc.moveDown(1);

    /* ── Key metrics ─────────────────────────────────────────────────────── */
    doc.fontSize(11).font('Helvetica-Bold').fillColor(BRAND).text('Key Metrics');
    doc.moveDown(0.4);

    const metrics = [
      { label: 'Total Workspaces (filtered)', value: String(payload.totalWorkspaces) },
      { label: 'Launch Readiness Rate', value: `${payload.launchReadinessRate}%` },
      { label: 'Requiring Support', value: String(payload.supportLoad.requiringSupport) },
      { label: 'Unresolved Support', value: String(payload.supportLoad.unresolved) },
    ];

    const colW = W / 2;
    const mx = 50;
    const my = doc.y;
    for (let i = 0; i < metrics.length; i++) {
      const m = metrics[i];
      const cx = mx + (i % 2) * colW;
      const cy = i < 2 ? my : my + 46;
      doc.rect(cx, cy, colW - 8, 40).lineWidth(0.5).strokeColor('#cbd5e1').stroke();
      doc.fillColor('#64748b').fontSize(8).font('Helvetica').text(m.label, cx + 8, cy + 7, { width: colW - 20 });
      doc.fillColor('#0f172a').fontSize(18).font('Helvetica-Bold').text(m.value, cx + 8, cy + 17, { width: colW - 20 });
    }
    doc.y = my + 100;
    doc.moveDown(0.5);

    /* ── Workspace status breakdown ──────────────────────────────────────── */
    doc.fontSize(11).font('Helvetica-Bold').fillColor(BRAND).text('Workspace Status Breakdown');
    doc.moveDown(0.3);

    const statusOrder: WorkspaceStatus[] = ['draft', 'onboarding', 'ready_for_launch', 'launched', 'blocked'];
    const statusColors: Record<WorkspaceStatus, string> = {
      draft: '#94a3b8',
      onboarding: '#fb923c',
      ready_for_launch: '#3b82f6',
      launched: '#22c55e',
      blocked: '#ef4444',
    };

    const total = payload.totalWorkspaces || 1;
    const barMaxW = W - 80;
    for (const s of statusOrder) {
      const count = payload.statusCounts[s] ?? 0;
      const pct = Math.round((count / total) * 100);
      const barW = Math.max(2, Math.round((count / total) * barMaxW));
      const rowY = doc.y;
      doc.fillColor('#334155').fontSize(9).font('Helvetica').text(toTitle(s), 50, rowY, { width: 120, continued: false });
      doc.rect(175, rowY, barW, 11).fill(statusColors[s] ?? '#94a3b8');
      doc.fillColor('#334155').fontSize(9).font('Helvetica').text(`${count}  (${pct}%)`, 175 + barW + 6, rowY);
      doc.moveDown(0.65);
    }
    doc.moveDown(0.5);

    /* ── Connector status ────────────────────────────────────────────────── */
    doc.fontSize(11).font('Helvetica-Bold').fillColor(BRAND).text('Connector Status');
    doc.moveDown(0.3);

    const connectorRows = [
      { label: 'Connected', value: payload.connectorCounts.connected, color: '#22c55e' },
      { label: 'Pending / Token Generated', value: payload.connectorCounts.pending, color: '#f59e0b' },
      { label: 'Failed', value: payload.connectorCounts.failed, color: '#ef4444' },
      { label: 'Not Connected', value: payload.connectorCounts.notConnected, color: '#94a3b8' },
    ];

    for (const row of connectorRows) {
      const pct = Math.round((row.value / total) * 100);
      const barW = Math.max(2, Math.round((row.value / total) * barMaxW));
      const rowY = doc.y;
      doc.fillColor('#334155').fontSize(9).font('Helvetica').text(row.label, 50, rowY, { width: 155, continued: false });
      doc.rect(210, rowY, barW, 11).fill(row.color);
      doc.fillColor('#334155').fontSize(9).font('Helvetica').text(`${row.value}  (${pct}%)`, 210 + barW + 6, rowY);
      doc.moveDown(0.65);
    }
    doc.moveDown(0.5);

    /* ── Monthly trend table ─────────────────────────────────────────────── */
    if (payload.timeline.labels.length > 0) {
      doc.addPage();

      doc.rect(50, 40, W, 28).fill(BRAND);
      doc.fillColor('#ffffff').fontSize(14).font('Helvetica-Bold').text('Workspace Creation Trend (Monthly)', 60, 48, { width: W - 20 });
      doc.y = 80;
      doc.moveDown(1);

      // Table header
      const tCols = [120, 80, 80];
      const tH = doc.y;
      doc.rect(50, tH, tCols[0] + tCols[1] + tCols[2], 16).fill('#f1f5f9');
      doc.fillColor('#334155').fontSize(8).font('Helvetica-Bold');
      doc.text('Month', 54, tH + 3, { width: tCols[0] });
      doc.text('New Workspaces', 54 + tCols[0], tH + 3, { width: tCols[1] });
      doc.text('% of Period Total', 54 + tCols[0] + tCols[1], tH + 3, { width: tCols[2] });
      doc.y = tH + 18;

      const periodTotal = payload.timeline.values.reduce((a, b) => a + b, 0) || 1;
      payload.timeline.labels.forEach((label, idx) => {
        const v = payload.timeline.values[idx] ?? 0;
        const pct = Math.round((v / periodTotal) * 100);
        const ry = doc.y;
        if (idx % 2 === 0) {
          doc.rect(50, ry, tCols[0] + tCols[1] + tCols[2], 14).fill('#f8fafc');
        }
        doc.fillColor('#475569').fontSize(8).font('Helvetica');
        doc.text(label, 54, ry + 2, { width: tCols[0] });
        doc.text(String(v), 54 + tCols[0], ry + 2, { width: tCols[1] });
        doc.text(`${pct}%`, 54 + tCols[0] + tCols[1], ry + 2, { width: tCols[2] });
        doc.y = ry + 16;
      });

      doc.moveDown(1);
      doc.fillColor('#64748b').fontSize(7).font('Helvetica-Oblique').text(`Period total: ${periodTotal} workspaces created`);
    }

    /* ── Footer ──────────────────────────────────────────────────────────── */
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(pages.start + i);
      doc
        .fontSize(7)
        .fillColor('#94a3b8')
        .font('Helvetica')
        .text(
          `Marvéo Platform — Confidential — Page ${i + 1} of ${pages.count}`,
          50,
          doc.page.height - 30,
          { align: 'center', width: W },
        );
    }

    doc.end();
  });
}

/* ── Route handler ────────────────────────────────────────────────────────── */
export async function POST(req: NextRequest) {
  const auth = await requireActionPermission('analytics', 'view');
  if ('error' in auth) return auth.error;

  let payload: DecisionDashboardPayload;
  try {
    payload = (await req.json()) as DecisionDashboardPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  payload.generatedAt = payload.generatedAt || new Date().toISOString();

  try {
    const buffer = await buildPdf(payload);
    const date = new Date(payload.generatedAt).toISOString().slice(0, 10).replace(/-/g, '');
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="decision-dashboard-${date}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to generate PDF.' }, { status: 500 });
  }
}
