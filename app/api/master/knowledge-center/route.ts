import { NextRequest, NextResponse } from 'next/server';
import { appendAuditLog, readAdminStore, updateAdminStore } from '@/lib/adminStore';
import { hasInternalPlatformAccess } from '@/lib/auth';
import { requireOSAccess } from '@/lib/permissions/access';
import { requireActionPermission } from '@/lib/master/permissions/guards';

type KnowledgeAudience = 'internal' | 'client' | 'both';

type KnowledgeArticle = {
  id: string;
  title: string;
  summary: string;
  audience: KnowledgeAudience;
  sourceDoc?: string;
  heroImageUrl?: string;
  videoUrl?: string;
  contentHtml: string;
  contentText: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

const KNOWLEDGE_SEED: Array<Omit<KnowledgeArticle, 'id' | 'createdBy' | 'createdAt' | 'updatedAt' | 'contentText'>> = [
  {
    title: 'Install Marveo Connector (WordPress)',
    summary: 'Install and activate the connector to enable workspace-level WordPress integration.',
    audience: 'client',
    sourceDoc: 'marveo-website/docs/wordpress/install-marveo-connector.md',
    contentHtml:
      '<h2>Purpose</h2><p>Install and activate the Marveo connector to allow workspace-level operational integration.</p><h2>When to use</h2><ul><li>During first-time WordPress onboarding.</li><li>During migration from manual processes to connected workflows.</li></ul><h2>Setup steps</h2><ol><li>Sign in to WordPress admin.</li><li>Go to plugin installation.</li><li>Upload or install the Marveo connector package provided by your onboarding flow.</li><li>Activate the plugin.</li><li>Return to Marveo and continue the connection flow.</li><li>Confirm connector status shows active.</li></ol><h2>Troubleshooting</h2><ul><li>Activation fails: confirm PHP/WP version compatibility.</li><li>Plugin not visible: clear plugin cache and refresh admin.</li><li>Permission denied: verify plugin directory write access.</li></ul>',
  },
  {
    title: 'Verify WordPress Connection',
    summary: 'Validate WordPress and Marveo connectivity before handoff and launch readiness checks.',
    audience: 'client',
    sourceDoc: 'marveo-website/docs/wordpress/verify-wordpress-connection.md',
    contentHtml:
      '<h2>Purpose</h2><p>Validate that WordPress and Marveo are connected reliably before operational rollout.</p><h2>Setup steps</h2><ol><li>Open the workspace connection status panel.</li><li>Confirm connector status is active.</li><li>Confirm workspace status reads verified.</li><li>Run a basic sync test.</li><li>Confirm no critical warnings in connection logs.</li></ol><h2>Verification checklist</h2><ul><li>Connector active</li><li>Workspace verified</li><li>Sync test passed</li><li>No critical warnings</li><li>Handoff notes recorded</li></ul>',
  },
  {
    title: 'Install Next.js Adapter',
    summary: 'Set up the Marveo adapter in a Next.js project for operational integration.',
    audience: 'client',
    sourceDoc: 'marveo-website/docs/nextjs/install-nextjs-adapter.md',
    contentHtml:
      '<h2>Purpose</h2><p>Set up the Marveo adapter for Next.js projects so operational controls can connect to your frontend workflow.</p><h2>Setup steps</h2><ol><li>Confirm your project is in a supported Next.js environment.</li><li>Add the Marveo adapter package.</li><li>Configure required adapter settings.</li><li>Run local validation.</li><li>Connect to the target Marveo workspace.</li></ol><h2>Troubleshooting</h2><ul><li>Build errors: verify package compatibility.</li><li>Adapter not detected: re-check configuration and env values.</li><li>Runtime mismatch: validate Node and Next.js versions.</li></ul>',
  },
  {
    title: 'Connect Next.js Site',
    summary: 'Connect a Next.js production site to Marveo for centralized operations and launch checks.',
    audience: 'client',
    sourceDoc: 'marveo-website/docs/nextjs/connect-nextjs-site.md',
    contentHtml:
      '<h2>Purpose</h2><p>Connect a Next.js site to Marveo so operations, onboarding, and launch checks run from one workspace.</p><h2>Setup steps</h2><ol><li>Prepare the workspace in Marveo.</li><li>Confirm adapter installation and baseline config.</li><li>Start the connection flow from Marveo.</li><li>Validate connection status and initial sync.</li><li>Complete operational handoff checklist.</li></ol><h2>Troubleshooting</h2><ul><li>Connection pending: verify adapter registration and workspace mapping.</li><li>Failed sync: verify environment variables and deployment health.</li><li>Unstable status: collect logs and escalate with timestamps.</li></ul>',
  },
  {
    title: 'Guided Onboarding Playbook',
    summary: 'Internal support process for onboarding customers consistently and reducing setup delays.',
    audience: 'internal',
    sourceDoc: 'marveo-website/docs/support/guided-onboarding-playbook.md',
    contentHtml:
      '<h2>Purpose</h2><p>Provide support officers a repeatable process for onboarding customers into Marveo.</p><h2>Playbook steps</h2><ol><li>Discovery call: current stack, goals, and launch timeline.</li><li>Connection path selection.</li><li>Setup execution: connector/adapter install and workspace mapping.</li><li>Verification: run health checks.</li><li>Operational handoff: ownership, support channels, and launch plan.</li></ol><h2>Success criteria</h2><ul><li>Workspace verified</li><li>Key workflows confirmed</li><li>Handoff complete</li><li>Launch readiness started</li></ul>',
  },
  {
    title: 'Escalation Severity Matrix',
    summary: 'Internal severity definitions, response targets, and escalation ownership.',
    audience: 'internal',
    sourceDoc: 'marveo-website/docs/support/escalation-severity-matrix.md',
    contentHtml:
      '<h2>Severity levels</h2><ul><li><strong>Sev 1:</strong> Critical service impact, 15 min response.</li><li><strong>Sev 2:</strong> Major degradation, 1 hour response.</li><li><strong>Sev 3:</strong> Moderate issue, same business day response.</li><li><strong>Sev 4:</strong> Minor/request, next business day response.</li></ul><h2>Escalation triggers</h2><ul><li>Issue exceeds response target.</li><li>Workaround fails.</li><li>Issue repeats across workspaces.</li><li>Launch milestone blocked.</li></ul><h2>Required context</h2><ul><li>Workspace name</li><li>Stack type</li><li>Environment</li><li>Timestamps</li><li>Impact summary</li><li>Screenshots/logs</li></ul>',
  },
  {
    title: 'Incident Response Playbook',
    summary: 'Internal incident workflow for outage stabilization and post-incident review.',
    audience: 'internal',
    sourceDoc: 'marveo-website/docs/operations/incident-response-playbook.md',
    contentHtml:
      '<h2>Response flow</h2><ol><li>Identify severity using the escalation matrix.</li><li>Assign incident commander and comms owner.</li><li>Stabilize service with workaround or rollback.</li><li>Send status updates on cadence.</li><li>Resolve root cause and validate recovery.</li><li>Run post-incident review.</li></ol><h2>Communication checklist</h2><ul><li>Issue summary published</li><li>Impact scope confirmed</li><li>Next update time shared</li><li>Recovery confirmation shared</li></ul>',
  },
  {
    title: 'Customer Handoff Template',
    summary: 'Internal template for structured onboarding-to-support transfer.',
    audience: 'internal',
    sourceDoc: 'marveo-website/docs/support/customer-handoff-template.md',
    contentHtml:
      '<h2>Template sections</h2><ol><li>Customer snapshot</li><li>Current connection status</li><li>Operational scope</li><li>Known risks</li><li>Support routing</li><li>Open items</li><li>Sign-off</li></ol><p>Use this template for every onboarding handoff record to avoid context loss.</p>',
  },
];

function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function stripTags(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeAudience(value: unknown): KnowledgeAudience {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'internal' || raw === 'client') return raw;
  return 'both';
}

function normalizeUrl(value: unknown): string | undefined {
  const raw = String(value || '').trim();
  return raw ? raw : undefined;
}

async function ensureSeeded() {
  const store = await readAdminStore();
  if (Object.keys(store.cloud.ticketing.knowledgeArticles || {}).length > 0) return;

  const now = new Date().toISOString();
  await updateAdminStore((current) => {
    if (Object.keys(current.cloud.ticketing.knowledgeArticles || {}).length > 0) return current;

    const seeded: Record<string, KnowledgeArticle> = {};
    for (const row of KNOWLEDGE_SEED) {
      const id = createId('kb');
      seeded[id] = {
        id,
        title: row.title,
        summary: row.summary,
        audience: row.audience,
        sourceDoc: row.sourceDoc,
        heroImageUrl: row.heroImageUrl,
        videoUrl: row.videoUrl,
        contentHtml: row.contentHtml,
        contentText: stripTags(row.contentHtml),
        createdBy: 'system:seed',
        createdAt: now,
        updatedAt: now,
      };
    }

    return {
      ...current,
      cloud: {
        ...current.cloud,
        ticketing: {
          ...current.cloud.ticketing,
          knowledgeArticles: seeded,
        },
      },
    };
  });
}

export async function GET(req: NextRequest) {
  const access = await requireOSAccess();
  if ('error' in access) return access.error;

  await ensureSeeded();

  const store = await readAdminStore();
  const audienceFilter = String(req.nextUrl.searchParams.get('audience') || '').trim().toLowerCase();
  const q = String(req.nextUrl.searchParams.get('q') || '').trim().toLowerCase();
  const internal = hasInternalPlatformAccess(access.roles);

  let articles = Object.values(store.cloud.ticketing.knowledgeArticles || {})
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  if (!internal) {
    articles = articles.filter((article) => article.audience === 'client' || article.audience === 'both');
  }

  if (audienceFilter === 'internal' || audienceFilter === 'client' || audienceFilter === 'both') {
    articles = articles.filter((article) => article.audience === audienceFilter);
  }

  if (q) {
    articles = articles.filter((article) => {
      const blob = [article.title, article.summary, article.contentText, article.sourceDoc || ''].join(' ').toLowerCase();
      return blob.includes(q);
    });
  }

  return NextResponse.json({
    ok: true,
    internal,
    articles,
  });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    id?: unknown;
    delete?: unknown;
    title?: unknown;
    summary?: unknown;
    audience?: unknown;
    sourceDoc?: unknown;
    heroImageUrl?: unknown;
    videoUrl?: unknown;
    contentHtml?: unknown;
  } | null;

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const isDelete = Boolean(body.delete);
  const auth = await requireActionPermission('knowledgeCenter', isDelete ? 'delete' : 'update');
  if ('error' in auth) return auth.error;

  const actorEmail = String(auth.session.user?.user_email || auth.session.user?.email || 'unknown').trim().toLowerCase();
  const id = String(body.id || '').trim();

  if (isDelete) {
    if (!id) return NextResponse.json({ error: 'id is required for delete.' }, { status: 400 });

    await updateAdminStore((current) => {
      const nextArticles = { ...(current.cloud.ticketing.knowledgeArticles || {}) };
      delete nextArticles[id];
      return {
        ...current,
        cloud: {
          ...current.cloud,
          ticketing: {
            ...current.cloud.ticketing,
            knowledgeArticles: nextArticles,
          },
        },
      };
    });

    await appendAuditLog({
      actorEmail,
      action: 'knowledge-article.deleted',
      target: `knowledge-article:${id}`,
      details: 'deleted=true',
    });

    return NextResponse.json({ ok: true, deleted: id });
  }

  const title = String(body.title || '').trim().slice(0, 140);
  const summary = String(body.summary || '').trim().slice(0, 260);
  const contentHtml = String(body.contentHtml || '').trim();
  if (!title) return NextResponse.json({ error: 'title is required.' }, { status: 400 });
  if (!contentHtml) return NextResponse.json({ error: 'contentHtml is required.' }, { status: 400 });

  const now = new Date().toISOString();
  const articleId = id || createId('kb');
  const audience = normalizeAudience(body.audience);
  const sourceDoc = normalizeUrl(body.sourceDoc);
  const heroImageUrl = normalizeUrl(body.heroImageUrl);
  const videoUrl = normalizeUrl(body.videoUrl);

  const updated = await updateAdminStore((current) => {
    const existing = current.cloud.ticketing.knowledgeArticles?.[articleId];
    const next: KnowledgeArticle = {
      id: articleId,
      title,
      summary,
      audience,
      sourceDoc,
      heroImageUrl,
      videoUrl,
      contentHtml,
      contentText: stripTags(contentHtml),
      createdBy: existing?.createdBy || actorEmail,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    return {
      ...current,
      cloud: {
        ...current.cloud,
        ticketing: {
          ...current.cloud.ticketing,
          knowledgeArticles: {
            ...(current.cloud.ticketing.knowledgeArticles || {}),
            [articleId]: next,
          },
        },
      },
    };
  });

  await appendAuditLog({
    actorEmail,
    action: id ? 'knowledge-article.updated' : 'knowledge-article.created',
    target: `knowledge-article:${articleId}`,
    details: `audience=${audience};title=${title}`,
  });

  return NextResponse.json({
    ok: true,
    article: updated.cloud.ticketing.knowledgeArticles[articleId],
  });
}
