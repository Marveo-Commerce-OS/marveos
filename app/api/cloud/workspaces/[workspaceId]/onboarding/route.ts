import { NextRequest, NextResponse } from 'next/server';
import { getSession, getCurrentWpUser, isSuperAdmin } from '@/lib/auth';
import { appendAuditLog, readAdminStore, updateAdminStore } from '@/lib/adminStore';
import { updateStepStatus } from '@/lib/cloudOrchestration';
import {
  mapLegacyStepToMvpStepKey,
  resolveCompatibleStep,
} from '@/src/contexts/onboarding/onboarding-step.mapper';
import { validateCollectedBusinessData } from '@/src/contexts/onboarding/onboarding-validation';
import { MVP_ONBOARDING_STEP_SEQUENCE } from '@/src/contexts/onboarding/constants';
import type { OnboardingStatusKey, OnboardingStepKey, WebsiteTypeKey } from '@/src/contexts/onboarding/types';

type OnboardingAction = 'start' | 'complete' | 'fail' | 'retry' | 'rollback';

const WEBSITE_TYPES = new Set<WebsiteTypeKey>(['NEW_WEBSITE', 'EXISTING_WEBSITE', 'CUSTOM_HEADLESS']);
const ONBOARDING_STATUSES = new Set<OnboardingStatusKey>([
  'NOT_STARTED',
  'IN_PROGRESS',
  'WAITING_FOR_CLIENT',
  'WAITING_FOR_SUPPORT',
  'DEPLOYING',
  'READY_FOR_REVIEW',
  'READY_FOR_LAUNCH',
  'LIVE',
  'FAILED',
]);
const ONBOARDING_STEP_KEYS = new Set<OnboardingStepKey>(MVP_ONBOARDING_STEP_SEQUENCE);

async function ensureAdminSession() {
  const session = await getSession();
  if (!session) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const superAdmin = await isSuperAdmin(session.token);
  if (!superAdmin) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { session };
}

function isAction(value: string): value is OnboardingAction {
  return ['start', 'complete', 'fail', 'retry', 'rollback'].includes(value);
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
  const store = await readAdminStore();
  const workspace = store.cloud.workspaces[workspaceId];

  if (!workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  return NextResponse.json({
    workspace,
    compatibility: {
      numericStep: workspace.currentStep,
      onboardingStepKey: workspace.onboardingStepKey ?? mapLegacyStepToMvpStepKey(workspace.currentStep),
      onboardingStatus: workspace.onboardingStatus ?? null,
    },
  });
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ workspaceId: string }> },
) {
  const auth = await ensureAdminSession();
  if ('error' in auth) {
    return auth.error;
  }

  const { workspaceId } = await context.params;
  const body = await req.json();

  const resolvedStep = resolveCompatibleStep({
    step: Number(body?.step),
    onboardingStepKey: body?.onboardingStepKey ? String(body.onboardingStepKey).trim() : undefined,
  });
  const step = Number(resolvedStep.step || 0);
  const action = String(body?.action || '');
  const errorMessage = body?.error ? String(body.error) : undefined;
  const warnings: string[] = [];

  const websiteTypeRaw = body?.websiteType ? String(body.websiteType).trim() : undefined;
  const websiteType = websiteTypeRaw && WEBSITE_TYPES.has(websiteTypeRaw as WebsiteTypeKey)
    ? (websiteTypeRaw as WebsiteTypeKey)
    : undefined;

  const onboardingStepKeyRaw = body?.onboardingStepKey ? String(body.onboardingStepKey).trim() : undefined;
  const onboardingStepKey = onboardingStepKeyRaw && ONBOARDING_STEP_KEYS.has(onboardingStepKeyRaw as OnboardingStepKey)
    ? (onboardingStepKeyRaw as OnboardingStepKey)
    : resolvedStep.onboardingStepKey;

  const onboardingStatusRaw = body?.onboardingStatus ? String(body.onboardingStatus).trim() : undefined;
  const onboardingStatus = onboardingStatusRaw && ONBOARDING_STATUSES.has(onboardingStatusRaw as OnboardingStatusKey)
    ? (onboardingStatusRaw as OnboardingStatusKey)
    : undefined;

  const collectedBusinessData =
    body?.collectedBusinessData && typeof body.collectedBusinessData === 'object' && !Array.isArray(body.collectedBusinessData)
      ? (body.collectedBusinessData as Record<string, unknown>)
      : undefined;
  const supportRequired = typeof body?.supportRequired === 'boolean' ? body.supportRequired : undefined;

  if (websiteTypeRaw && !websiteType) {
    warnings.push('Ignored invalid websiteType value.');
  }
  if (onboardingStatusRaw && !onboardingStatus) {
    warnings.push('Ignored invalid onboardingStatus value.');
  }
  if (onboardingStepKeyRaw && !ONBOARDING_STEP_KEYS.has(onboardingStepKeyRaw as OnboardingStepKey)) {
    warnings.push('Ignored invalid onboardingStepKey value.');
  }

  const validationResult = validateCollectedBusinessData(websiteType, collectedBusinessData);
  if (!validationResult.valid) {
    warnings.push('collectedBusinessData did not fully match MVP contract and was stored as-is for compatibility.');
  }

  if (!Number.isFinite(step) || step < 1 || step > 11) {
    return NextResponse.json({ error: 'step must be between 1 and 11' }, { status: 400 });
  }

  if (!isAction(action)) {
    return NextResponse.json({ error: 'invalid onboarding action' }, { status: 400 });
  }

  let nextWorkspace = null;

  await updateAdminStore((current) => {
    const workspace = current.cloud.workspaces[workspaceId];
    if (!workspace) {
      return current;
    }

    const updated = updateStepStatus(workspace, step, action, errorMessage);
    const derivedStepKey = mapLegacyStepToMvpStepKey(updated.currentStep);

    nextWorkspace = {
      ...updated,
      websiteType: websiteType ?? updated.websiteType,
      onboardingStepKey: onboardingStepKey ?? derivedStepKey ?? updated.onboardingStepKey,
      onboardingStatus: onboardingStatus ?? updated.onboardingStatus ?? 'IN_PROGRESS',
      collectedBusinessData: collectedBusinessData ?? updated.collectedBusinessData,
      supportRequired: supportRequired ?? updated.supportRequired,
    };

    return {
      ...current,
      cloud: {
        ...current.cloud,
        workspaces: {
          ...current.cloud.workspaces,
          [workspaceId]: nextWorkspace,
        },
      },
    };
  });

  if (!nextWorkspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  const actor = await getCurrentWpUser(auth.session.token);
  await appendAuditLog({
    actorEmail: actor?.email ?? auth.session.user?.user_email ?? 'unknown',
    action: `cloud.onboarding.${action}`,
    target: workspaceId,
    details: `Step ${step} transitioned with action=${action}${errorMessage ? ` error=${errorMessage}` : ''}${onboardingStepKey ? ` step_key=${onboardingStepKey}` : ''}${onboardingStatus ? ` status=${onboardingStatus}` : ''}`,
  });

  return NextResponse.json({
    workspace: nextWorkspace,
    compatibility: {
      numericStep: nextWorkspace.currentStep,
      onboardingStepKey: nextWorkspace.onboardingStepKey ?? mapLegacyStepToMvpStepKey(nextWorkspace.currentStep),
      onboardingStatus: nextWorkspace.onboardingStatus ?? null,
    },
    onboardingValidation: {
      valid: validationResult.valid,
      errors: validationResult.errors,
    },
    warnings,
  });
}
