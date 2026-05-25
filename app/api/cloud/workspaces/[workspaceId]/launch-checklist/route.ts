import { NextRequest, NextResponse } from 'next/server';
import { getSession, isAdmin } from '@/lib/auth';
import { readAdminStore } from '@/lib/adminStore';
import type { WorkspaceOrchestration } from '@/lib/adminStore';
import { mapLegacyStepToMvpStepKey } from '@/src/contexts/onboarding/onboarding-step.mapper';
import { requireWorkspaceAccess } from '@/lib/permissions/access';

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

function toBool(value: unknown): boolean {
  return Boolean(value);
}

function hasBusinessDetails(workspace: WorkspaceOrchestration): boolean {
  const profile = workspace.businessProfile;
  if (profile && typeof profile === 'object') {
    return Object.keys(profile as Record<string, unknown>).length > 0;
  }

  const collected = workspace.collectedBusinessData;
  if (collected && typeof collected === 'object') {
    return Object.keys(collected as Record<string, unknown>).length > 0;
  }

  return false;
}

function hasConnectorOrTemplate(workspace: WorkspaceOrchestration): boolean {
  const template = String(workspace.selectedTemplateId || '').trim();
  if (template) return true;

  // For EXISTING_WEBSITE workspaces, connector connected status counts
  if (workspace.connectorStatus === 'CONNECTED') return true;

  const collected = workspace.collectedBusinessData;
  if (!collected || typeof collected !== 'object') return false;

  const data = collected as Record<string, unknown>;
  return Boolean(String(data.connectorToken || '').trim() || String(data.apiDetails || '').trim());
}

function hasDomain(workspace: WorkspaceOrchestration): boolean {
  const profile = workspace.businessProfile;
  if (profile && typeof profile === 'object') {
    const domain = String((profile as Record<string, unknown>).domain || '').trim();
    if (domain) return true;
  }

  const collected = workspace.collectedBusinessData;
  if (collected && typeof collected === 'object') {
    const domain = String((collected as Record<string, unknown>).domain || '').trim();
    if (domain) return true;
  }

  return Boolean(String(workspace.contentBaseUrl || '').trim());
}

function hasNewWebsiteFrontendDomain(workspace: WorkspaceOrchestration): boolean {
  const collected = workspace.collectedBusinessData;
  if (!collected || typeof collected !== 'object') return false;
  return Boolean(String((collected as Record<string, unknown>).frontendDomain || '').trim());
}

function hasNewWebsiteBackendSubdomain(workspace: WorkspaceOrchestration): boolean {
  const collected = workspace.collectedBusinessData;
  if (!collected || typeof collected !== 'object') return false;
  return Boolean(String((collected as Record<string, unknown>).backendCmsSubdomain || '').trim());
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ workspaceId: string }> },
) {
  const auth = await ensureAdminSession();
  if ('error' in auth) {
    return auth.error;
  }

  const { workspaceId } = await context.params;
  const workspaceAccess = await requireWorkspaceAccess(workspaceId);
  if ('error' in workspaceAccess) return workspaceAccess.error;

  const store = await readAdminStore();
  const workspace: WorkspaceOrchestration | undefined = store.cloud.workspaces[workspaceId];

  if (!workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  const deploymentReadiness = workspace.deploymentReadiness || {};
  const onboardingStepKey = String(workspace.onboardingStepKey || '') || mapLegacyStepToMvpStepKey(Number(workspace.currentStep || 0));
  const onboardingStatus = String(workspace.onboardingStatus || '');
  const supportAssignment = (workspace.supportAssignment as Record<string, unknown>) || null;
  const websiteType = String(workspace.websiteType || '');
  const connectorStatus = String(workspace.connectorStatus || 'NOT_CONNECTED');
  const isExistingWebsite = websiteType === 'EXISTING_WEBSITE';
  const isNewWebsite = websiteType === 'NEW_WEBSITE';
  const collectedBusinessData = (workspace.collectedBusinessData as Record<string, unknown> | undefined) || undefined;
  const connectionMethod = String(collectedBusinessData?.connectionMethod || '').toLowerCase();
  const manualSetupSelected = connectionMethod === 'manual';
  const connectorFailed = connectorStatus === 'FAILED' || connectorStatus === 'SUPPORT_REQUIRED';
  const connectorVerificationRequired = isExistingWebsite && !manualSetupSelected;
  const supportRequiredForChecklist = isExistingWebsite
    ? manualSetupSelected || connectorFailed
    : Boolean(workspace.supportRequired);

  const backendPreparationReady = isNewWebsite
    ? Number(workspace.currentStep || 0) >= 7 || onboardingStatus === 'DEPLOYING' || onboardingStatus === 'READY_FOR_REVIEW' || onboardingStatus === 'READY_FOR_LAUNCH' || onboardingStatus === 'LIVE'
    : false;
  const connectorAutoInstallReady = isNewWebsite
    ? connectorStatus === 'CONNECTED' || onboardingStatus === 'READY_FOR_REVIEW' || onboardingStatus === 'READY_FOR_LAUNCH' || onboardingStatus === 'LIVE'
    : false;

  const supportAssigned = Boolean(supportAssignment && String(supportAssignment.status || '') === 'ASSIGNED');
  const launchGuardChecked = Boolean(workspace.launchGuardLastCheckedAt) || toBool(deploymentReadiness.onboardingComplete);
  const clientReviewReady = onboardingStatus === 'READY_FOR_REVIEW' || onboardingStatus === 'READY_FOR_LAUNCH' || onboardingStatus === 'LIVE';

  const items = [
    {
      key: 'workspace_created',
      label: 'Workspace created',
      completed: true,
      required: true,
    },
    {
      key: 'website_type_selected',
      label: 'Website type selected',
      completed: Boolean(workspace.websiteType),
      required: true,
    },
    {
      key: 'business_details_completed',
      label: 'Business details completed',
      completed: hasBusinessDetails(workspace),
      required: true,
    },
    {
      key: 'connector_or_template_selected',
      label: 'Connector or template selected',
      completed: hasConnectorOrTemplate(workspace),
      required: true,
    },
    {
      key: 'deployment_started',
      label: 'Deployment started',
      completed: Number(workspace.currentStep || 0) >= 7 || onboardingStatus === 'DEPLOYING',
      required: true,
    },
    {
      key: 'support_assigned',
      label: 'Support assigned',
      completed: supportAssigned,
      required: supportRequiredForChecklist,
    },
    {
      key: 'domain_submitted',
      label: 'Domain submitted',
      completed: hasDomain(workspace),
      required: true,
    },
    ...(isNewWebsite
      ? [
          {
            key: 'frontend_domain_submitted',
            label: 'Frontend domain submitted',
            completed: hasNewWebsiteFrontendDomain(workspace),
            required: true,
          },
          {
            key: 'backend_cms_subdomain_submitted',
            label: 'Backend CMS subdomain submitted',
            completed: hasNewWebsiteBackendSubdomain(workspace),
            required: true,
          },
          {
            key: 'wordpress_backend_prepared',
            label: 'WordPress backend preparation pending/ready',
            completed: backendPreparationReady,
            required: true,
          },
          {
            key: 'connector_auto_install_ready',
            label: 'Connector auto-install pending/ready',
            completed: connectorAutoInstallReady,
            required: true,
          },
        ]
      : []),
    {
      key: 'launch_guard_checked',
      label: 'Launch guard checked',
      completed: launchGuardChecked,
      required: true,
    },
    {
      key: 'client_review_ready',
      label: 'Client review ready',
      completed: clientReviewReady,
      required: false,
    },
    ...(isExistingWebsite
      ? [
          {
            key: 'website_connection_verified',
            label: 'Website connection verified',
            completed: connectorStatus === 'CONNECTED',
            required: connectorVerificationRequired,
          },
          {
            key: 'connector_status_ready',
            label: 'Connector status ready',
            completed: connectorStatus === 'CONNECTED',
            required: connectorVerificationRequired,
          },
        ]
      : []),
  ];

  const blockers = items.filter((item) => item.required && !item.completed).map((item) => item.label);

  return NextResponse.json({
    workspaceId,
    onboardingStepKey,
    onboardingStatus: onboardingStatus || null,
    launchGuardLastCheckedAt: workspace.launchGuardLastCheckedAt || null,
    deploymentReadiness,
    supportAssignment,
    connectorStatus: isExistingWebsite ? connectorStatus : null,
    connectorSiteMetadata: isExistingWebsite ? (workspace.connectorSiteMetadata ?? null) : null,
    readyForLaunch: blockers.length === 0,
    items,
    blockers,
    generatedAt: new Date().toISOString(),
  });
}
