import { NextRequest, NextResponse } from 'next/server';
import { getSession, isAdmin, getCurrentWpUser } from '@/lib/auth';
import { appendAuditLog, readAdminStore, setWorkspaceConnectorState, getWorkspaceConnectorState } from '@/lib/adminStore';
import type { ConnectorSiteMetadata } from '@/lib/adminStore';
import { normalizeSiteUrl, probeConnectorSite } from '@/lib/connectorProbe';

async function ensureAdminSession() {
  const session = await getSession();
  if (!session) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const admin = await isAdmin(session.token);
  if (!admin) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { session };
}

// POST /api/cloud/workspaces/:workspaceId/connector/verify
// Verifies the connector plugin is installed on the remote site and records site metadata.
// Body: { domain: string; connectorToken?: string }
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ workspaceId: string }> },
) {
  const auth = await ensureAdminSession();
  if ('error' in auth) return auth.error;

  const { workspaceId } = await context.params;

  const store = await readAdminStore();
  const workspace = store.cloud.workspaces[workspaceId];
  if (!workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const rawDomain = String(body?.domain || workspace.contentBaseUrl || '');
  const providedToken = String(body?.connectorToken || '').trim();

  if (providedToken) {
    const currentConnectorState = await getWorkspaceConnectorState(workspaceId);
    const expectedToken = String(currentConnectorState?.connectorToken || '').trim();
    if (expectedToken && expectedToken !== providedToken) {
      await setWorkspaceConnectorState(workspaceId, {
        connectorStatus: 'FAILED',
        supportRequired: true,
        connectorLastVerificationAttempt: new Date().toISOString(),
        connectorVerificationError: 'Provided connector token does not match generated workspace token.',
      });

      return NextResponse.json(
        {
          workspaceId,
          connectorStatus: 'FAILED',
          verified: false,
          error: 'Provided connector token does not match generated workspace token.',
        },
        { status: 401 },
      );
    }
  }

  const verificationAttemptAt = new Date().toISOString();

  // Record that we attempted verification
  await setWorkspaceConnectorState(workspaceId, {
    connectorStatus: 'PENDING_VERIFICATION',
    connectorLastVerificationAttempt: verificationAttemptAt,
    connectorVerificationError: undefined,
  });

  const probe = await probeConnectorSite(rawDomain);
  if (!probe.ok || !probe.metadata) {
    const verificationError = probe.verificationError || 'Connector verification failed.';
    // Verification failed
    await setWorkspaceConnectorState(workspaceId, {
      connectorStatus: 'FAILED',
      supportRequired: true,
      connectorLastVerificationAttempt: verificationAttemptAt,
      connectorVerificationError: verificationError,
    });

    const actor = await getCurrentWpUser(auth.session.token);
    await appendAuditLog({
      actorEmail: actor?.email ?? auth.session.user?.user_email ?? 'unknown',
      action: 'cloud.connector.verification_failed',
      target: workspaceId,
      details: `Connector verification failed: ${verificationError}`,
    });

    return NextResponse.json({
      workspaceId,
      connectorStatus: 'FAILED',
      verified: false,
      error: verificationError,
      siteOrigin: probe.siteOrigin || null,
      attemptedAt: verificationAttemptAt,
    });
  }

  const metadata: ConnectorSiteMetadata = {
    ...probe.metadata,
    discoveredAt: verificationAttemptAt,
  };

  const submittedOrigin = normalizeSiteUrl(rawDomain);
  const verifiedOrigin = normalizeSiteUrl(metadata.siteUrl || probe.siteOrigin || '');
  if (submittedOrigin && verifiedOrigin && submittedOrigin !== verifiedOrigin) {
    const verificationError = 'This token does not match the website domain entered. Please confirm the WordPress site and token.';

    await setWorkspaceConnectorState(workspaceId, {
      connectorStatus: 'FAILED',
      supportRequired: true,
      connectorLastVerificationAttempt: verificationAttemptAt,
      connectorVerificationError: verificationError,
    });

    const actor = await getCurrentWpUser(auth.session.token);
    await appendAuditLog({
      actorEmail: actor?.email ?? auth.session.user?.user_email ?? 'unknown',
      action: 'cloud.connector.verification_failed',
      target: workspaceId,
      details: verificationError,
    });

    return NextResponse.json({
      workspaceId,
      connectorStatus: 'FAILED',
      verified: false,
      error: verificationError,
      siteOrigin: probe.siteOrigin || null,
      attemptedAt: verificationAttemptAt,
    }, { status: 422 });
  }

  // Mark as connected
  await setWorkspaceConnectorState(workspaceId, {
    connectorStatus: 'CONNECTED',
    supportRequired: false,
    connectorConnectedAt: verificationAttemptAt,
    connectorLastVerificationAttempt: verificationAttemptAt,
    connectorVerificationError: undefined,
    connectorSiteMetadata: metadata,
  });

  const actor = await getCurrentWpUser(auth.session.token);
  await appendAuditLog({
    actorEmail: actor?.email ?? auth.session.user?.user_email ?? 'unknown',
    action: 'cloud.connector.connected',
    target: workspaceId,
    details: `Connector verified for ${metadata.siteUrl ?? probe.siteOrigin ?? 'unknown site'}. WP: ${metadata.wordpressVersion ?? 'unknown'}, WC: ${metadata.woocommerceEnabled ? 'enabled' : 'not detected'}, plugin: ${metadata.connectorPluginStatus}`,
  });

  return NextResponse.json({
    workspaceId,
    connectorStatus: 'CONNECTED',
    verified: true,
    siteOrigin: probe.siteOrigin,
    connectorPluginStatus: metadata.connectorPluginStatus,
    siteMetadata: metadata,
    connectedAt: verificationAttemptAt,
  });
}
