import { NextResponse } from 'next/server';
import { getSession, hasClientWorkspaceAccess, hasInternalPlatformAccess, normalizeRoles } from '@/lib/auth';
import { readAdminStore, type WorkspaceOrchestration } from '@/lib/adminStore';

type HealthStatus = 'pass' | 'warn' | 'fail' | 'unknown';
type StackSegment = 'wordpress' | 'nextjs' | 'headless' | 'unknown';

interface HealthCheck {
  key: string;
  label: string;
  status: HealthStatus;
  detail: string;
}

interface WorkspaceHealth {
  workspaceId: string;
  workspaceName: string;
  websiteType: string;
  stackSegments: StackSegment[];
  generatedAt: string;
  checks: HealthCheck[];
}

function parseVersion(value: string): number[] {
  return value
    .trim()
    .replace(/^v/i, '')
    .split('.')
    .map((part) => Number.parseInt(part, 10))
    .map((part) => (Number.isFinite(part) ? part : 0));
}

function compareVersions(left: string, right: string): number {
  const leftParts = parseVersion(left);
  const rightParts = parseVersion(right);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const leftPart = leftParts[index] ?? 0;
    const rightPart = rightParts[index] ?? 0;

    if (leftPart > rightPart) return 1;
    if (leftPart < rightPart) return -1;
  }

  return 0;
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function extractNextVersion(workspace: WorkspaceOrchestration): string | null {
  const data = workspace.collectedBusinessData ?? {};
  const candidates = [
    normalizeText((data as Record<string, unknown>).stack),
    normalizeText((data as Record<string, unknown>).apiDetails),
    normalizeText((data as Record<string, unknown>).integrationNotes),
  ]
    .filter(Boolean)
    .join(' ');

  if (!candidates) {
    return null;
  }

  const match = candidates.match(/next(?:\.js)?\s*v?(\d+(?:\.\d+){0,2})/i);
  if (!match?.[1]) {
    return null;
  }

  return match[1];
}

function inferStackSegments(workspace: WorkspaceOrchestration): StackSegment[] {
  const segments = new Set<StackSegment>();
  const websiteType = normalizeText(workspace.websiteType);
  const contentSource = normalizeText(workspace.contentSource);
  const platform = normalizeText(workspace.connectorSiteMetadata?.platform);
  const currentPlatform = normalizeText((workspace.collectedBusinessData ?? {}).currentPlatform);
  const stack = normalizeText((workspace.collectedBusinessData ?? {}).stack);

  const combined = [platform, currentPlatform, stack, contentSource, websiteType].join(' ').toLowerCase();

  if (combined.includes('wordpress') || combined.includes('woocommerce') || websiteType === 'EXISTING_WEBSITE') {
    segments.add('wordpress');
  }

  if (combined.includes('next') || contentSource === 'nextjs') {
    segments.add('nextjs');
  }

  if (websiteType === 'CUSTOM_HEADLESS' || combined.includes('headless')) {
    segments.add('headless');
  }

  if (segments.size === 0) {
    segments.add('unknown');
  }

  return Array.from(segments);
}

function buildWordPressChecks(workspace: WorkspaceOrchestration): HealthCheck[] {
  const checks: HealthCheck[] = [];
  const connectorStatus = workspace.connectorStatus ?? 'NOT_CONNECTED';
  const connectorVersion = normalizeText(workspace.connectorSiteMetadata?.connectorVersion);
  const wordpressVersion = normalizeText(workspace.connectorSiteMetadata?.wordpressVersion);
  const minConnector = process.env.MARVEO_MIN_CONNECTOR_VERSION || '1.0.16';
  const minWordPress = process.env.MARVEO_MIN_WORDPRESS_VERSION || '6.0.0';

  checks.push({
    key: 'wp_connector_connected',
    label: 'Connector status',
    status: connectorStatus === 'CONNECTED' ? 'pass' : connectorStatus === 'FAILED' ? 'fail' : 'warn',
    detail: connectorStatus === 'CONNECTED'
      ? 'Connected and syncing metadata.'
      : `Current status: ${connectorStatus}.`,
  });

  if (!connectorVersion) {
    checks.push({
      key: 'wp_connector_version',
      label: 'Connector plugin version',
      status: 'unknown',
      detail: 'Connector plugin version not reported yet.',
    });
  } else {
    checks.push({
      key: 'wp_connector_version',
      label: 'Connector plugin version',
      status: compareVersions(connectorVersion, minConnector) >= 0 ? 'pass' : 'warn',
      detail: compareVersions(connectorVersion, minConnector) >= 0
        ? `v${connectorVersion} meets minimum v${minConnector}.`
        : `v${connectorVersion} is below minimum v${minConnector}.`,
    });
  }

  if (!wordpressVersion) {
    checks.push({
      key: 'wp_core_version',
      label: 'WordPress core version',
      status: 'unknown',
      detail: 'WordPress version not reported by connector metadata.',
    });
  } else {
    checks.push({
      key: 'wp_core_version',
      label: 'WordPress core version',
      status: compareVersions(wordpressVersion, minWordPress) >= 0 ? 'pass' : 'warn',
      detail: compareVersions(wordpressVersion, minWordPress) >= 0
        ? `v${wordpressVersion} is within supported range.`
        : `v${wordpressVersion} may be outdated (min v${minWordPress}).`,
    });
  }

  return checks;
}

function buildNextChecks(workspace: WorkspaceOrchestration): HealthCheck[] {
  const nextVersion = extractNextVersion(workspace);
  const minNext = process.env.MARVEO_MIN_NEXTJS_VERSION || '14.0.0';

  if (!nextVersion) {
    return [
      {
        key: 'next_version',
        label: 'Next.js version',
        status: 'unknown',
        detail: 'Version not detected. Ask dev team to report framework version in stack details.',
      },
    ];
  }

  return [
    {
      key: 'next_version',
      label: 'Next.js version',
      status: compareVersions(nextVersion, minNext) >= 0 ? 'pass' : 'warn',
      detail: compareVersions(nextVersion, minNext) >= 0
        ? `v${nextVersion} meets minimum v${minNext}.`
        : `v${nextVersion} is below minimum v${minNext}.`,
    },
  ];
}

function buildHeadlessChecks(workspace: WorkspaceOrchestration): HealthCheck[] {
  const stack = normalizeText((workspace.collectedBusinessData ?? {}).stack);
  const apiDetails = normalizeText((workspace.collectedBusinessData ?? {}).apiDetails);

  return [
    {
      key: 'headless_stack_declared',
      label: 'Stack declaration',
      status: stack ? 'pass' : 'warn',
      detail: stack ? `Reported stack: ${stack}` : 'No stack declared yet.',
    },
    {
      key: 'headless_api_details',
      label: 'Integration/API details',
      status: apiDetails ? 'pass' : 'warn',
      detail: apiDetails ? 'Integration details provided.' : 'API/integration details are missing.',
    },
  ];
}

function buildHealth(workspace: WorkspaceOrchestration): WorkspaceHealth {
  const stackSegments = inferStackSegments(workspace);
  const checks: HealthCheck[] = [];

  if (stackSegments.includes('wordpress')) {
    checks.push(...buildWordPressChecks(workspace));
  }

  if (stackSegments.includes('nextjs')) {
    checks.push(...buildNextChecks(workspace));
  }

  if (stackSegments.includes('headless')) {
    checks.push(...buildHeadlessChecks(workspace));
  }

  if (stackSegments.includes('unknown')) {
    checks.push({
      key: 'unknown_stack',
      label: 'Technology stack detection',
      status: 'unknown',
      detail: 'Stack could not be determined. Complete setup metadata to enable monitoring.',
    });
  }

  return {
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    websiteType: workspace.websiteType ?? 'UNKNOWN',
    stackSegments,
    generatedAt: new Date().toISOString(),
    checks,
  };
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const roles = normalizeRoles(session.user?.roles);
  const canAccess = hasClientWorkspaceAccess(roles) || hasInternalPlatformAccess(roles);

  if (!canAccess) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const store = await readAdminStore();
  const workspaces = Object.values(store.cloud.workspaces)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, 10);

  const health = workspaces.map(buildHealth);

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    workspaces: health,
  });
}
