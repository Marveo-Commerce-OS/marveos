'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { copyTextToClipboard } from '@/lib/client/clipboard';

type ConnectorSiteMetadata = {
	platform?: string;
	wordpressVersion?: string;
	woocommerceEnabled?: boolean;
	pageCount?: number;
	productCount?: number;
	menuCount?: number;
	discoveredAt?: string;
};

type Workspace = {
	id: string;
	name: string;
	planId?: string;
	websiteType?: string;
	onboardingStatus?: string;
	onboardingStepKey?: string;
	currentStep: number;
	status: string;
	selectedTemplateId?: string;
	selectedModules?: string[];
	architecture?: string;
	launchGuardLastCheckedAt?: string;
	deploymentReadiness?: {
		onboardingComplete?: boolean;
		architectureValidated?: boolean;
		apisReachable?: boolean;
		modulesValid?: boolean;
		frontendValidated?: boolean;
		contentMapped?: boolean;
		integrationsConfigured?: boolean;
	};
	connectorStatus?: string;
	connectorSiteMetadata?: ConnectorSiteMetadata | null;
	businessProfile?: Record<string, unknown>;
	collectedBusinessData?: Record<string, unknown>;
	contentBaseUrl: string;
	supportAssignment?: {
		status: 'UNASSIGNED' | 'ASSIGNED';
		assignedAt?: string;
		assignedBy?: string;
		supportOfficerId?: string;
		supportOfficerName?: string;
		priority?: string;
		reason?: string;
		setupType?: string;
		requiredSkills?: string[];
		initialNotes?: string;
	};
	createdAt: string;
	updatedAt: string;
};

type ChecklistResponse = {
	readyForLaunch: boolean;
	items: Array<{
		key: string;
		label: string;
		completed: boolean;
		required: boolean;
	}>;
	blockers: string[];
	generatedAt: string;
};

type GuardResponse = {
	ready: boolean;
	missingRequirements: string[];
	recoveryActions: string[];
};

type ChecklistStatus =
	| 'completed'
	| 'in_progress'
	| 'awaiting_client'
	| 'awaiting_support'
	| 'blocked'
	| 'optional'
	| 'not_started';

type ChecklistOwner = 'client' | 'support' | 'system';

type ChecklistSectionKey =
	| 'workspace_setup'
	| 'website_setup'
	| 'deployment_integration'
	| 'launch_readiness';

type InternalChecklistItem = {
	key: string;
	title: string;
	section: ChecklistSectionKey;
	owner: ChecklistOwner;
	status: ChecklistStatus;
	required: boolean;
	blocking: boolean;
	dependsOn?: string[];
	description?: string;
};

type AuditLog = {
	id: string;
	at: string;
	actorEmail: string;
	action: string;
	target: string;
	details?: string;
};

const STATUS_LABELS: Record<string, string> = {
	NOT_STARTED: 'Not started',
	IN_PROGRESS: 'In progress',
	WAITING_FOR_CLIENT: 'Waiting for client',
	WAITING_FOR_SUPPORT: 'Waiting for support',
	DEPLOYING: 'Deploying',
	READY_FOR_REVIEW: 'Ready for review',
	READY_FOR_LAUNCH: 'Ready for launch',
	LIVE: 'Live',
	FAILED: 'Failed',
	ONBOARDING: 'Onboarding',
	BLOCKED: 'Blocked',
	ASSIGNED: 'Assigned',
	UNASSIGNED: 'Unassigned',
	NOT_CONNECTED: 'Not connected',
	TOKEN_GENERATED: 'Token generated',
	PENDING_VERIFICATION: 'Pending verification',
	CONNECTED: 'Connected',
	SUPPORT_REQUIRED: 'Support required',
};

const STEP_LABELS: Record<string, string> = {
	PLAN_SELECTED: 'Plan selected',
	PROFILE_CREATED: 'Profile created',
	WEBSITE_TYPE_SELECTED: 'Website type selected',
	BUSINESS_DETAILS_COMPLETED: 'Business details completed',
	CONNECTOR_TOKEN_GENERATED: 'Connection token generated',
	TEMPLATE_SELECTED: 'Template selected',
	DEPLOYMENT_STARTED: 'Deployment started',
	WORKSPACE_CREATED: 'Workspace created',
	SUPPORT_ASSIGNED: 'Support assigned',
	LAUNCH_CHECKLIST_READY: 'Launch checklist ready',
};

function toLabel(raw: string): string {
	return raw
		.replace(/[_-]+/g, ' ')
		.toLowerCase()
		.replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeToken(value: string): string {
	return value.trim().replace(/\s+/g, '_').toUpperCase();
}

function prettyValue(value: string): string {
	const key = normalizeToken(value);
	return STATUS_LABELS[key] || toLabel(value);
}

function prettyStep(stepKey: string | undefined, fallbackStep: number): string {
	if (!stepKey) return `Step ${fallbackStep}`;
	const key = normalizeToken(stepKey);
	return STEP_LABELS[key] || toLabel(stepKey);
}

function prettyWebsiteType(type?: string): string {
	if (!type) return 'Not set';
	if (type === 'NEW_WEBSITE') return 'New Website';
	if (type === 'EXISTING_WEBSITE') return 'Existing Website';
	if (type === 'CUSTOM_HEADLESS') return 'Custom / Headless';
	return toLabel(type);
}

function prettyAuditAction(value: string): string {
	const trimmed = value.trim();
	if (!trimmed) return 'Unknown action';
	const segments = trimmed.split('.').filter(Boolean);
	if (segments.length === 0) return toLabel(trimmed);
	if (segments.length === 1) return toLabel(segments[0]);
	const focus = segments.slice(1);
	return focus.map((part) => toLabel(part)).join(' - ');
}

function prettyAuditDetails(value: string | undefined): string {
	if (!value) return 'No additional details.';
	return value
		.split(';')
		.map((part) => part.trim())
		.filter(Boolean)
		.map((part) => {
			const [key, raw] = part.split('=');
			if (!raw) return toLabel(part);
			return `${toLabel(key)}: ${toLabel(raw)}`;
		})
		.join('; ');
}

function statusBadge(value?: string) {
	const raw = String(value || 'unknown').toLowerCase();
	if (raw.includes('ready') || raw.includes('live') || raw.includes('launched') || raw.includes('assigned')) return 'bg-emerald-100 text-emerald-700';
	if (raw.includes('failed') || raw.includes('blocked')) return 'bg-red-100 text-red-700';
	if (raw.includes('progress') || raw.includes('deploy')) return 'bg-blue-100 text-blue-700';
	if (raw.includes('wait') || raw.includes('pending')) return 'bg-amber-100 text-amber-700';
	return 'bg-slate-100 text-slate-700';
}

const SECTION_CONFIG: Array<{ key: ChecklistSectionKey; title: string }> = [
	{ key: 'workspace_setup', title: 'Workspace Setup' },
	{ key: 'website_setup', title: 'Website Setup' },
	{ key: 'deployment_integration', title: 'Deployment & Integration' },
	{ key: 'launch_readiness', title: 'Launch Readiness' },
];

const STATUS_META: Record<ChecklistStatus, { label: string; badgeClass: string }> = {
	completed: { label: 'Completed', badgeClass: 'bg-emerald-100 text-emerald-700' },
	in_progress: { label: 'In Progress', badgeClass: 'bg-blue-100 text-blue-700' },
	awaiting_client: { label: 'Awaiting Client', badgeClass: 'bg-amber-100 text-amber-700' },
	awaiting_support: { label: 'Awaiting Support', badgeClass: 'bg-indigo-100 text-indigo-700' },
	blocked: { label: 'Blocked', badgeClass: 'bg-red-100 text-red-700' },
	optional: { label: 'Optional', badgeClass: 'bg-slate-100 text-slate-600' },
	not_started: { label: 'Not Started', badgeClass: 'bg-slate-200 text-slate-700' },
};

const OWNER_META: Record<ChecklistOwner, { label: string; badgeClass: string }> = {
	client: { label: 'Client', badgeClass: 'bg-amber-50 text-amber-800 border border-amber-200' },
	support: { label: 'Support', badgeClass: 'bg-indigo-50 text-indigo-800 border border-indigo-200' },
	system: { label: 'System', badgeClass: 'bg-slate-100 text-slate-700 border border-slate-200' },
};

function hasProfileData(workspace: Workspace): boolean {
	if (workspace.businessProfile && Object.keys(workspace.businessProfile).length > 0) return true;
	if (workspace.collectedBusinessData && Object.keys(workspace.collectedBusinessData).length > 0) return true;
	return false;
}

function hasDomainData(workspace: Workspace): boolean {
	const fromProfile = String((workspace.businessProfile || {}).domain || '').trim();
	const fromCollected = String((workspace.collectedBusinessData || {}).domain || '').trim();
	const fromBase = String(workspace.contentBaseUrl || '').trim();
	return Boolean(fromProfile || fromCollected || fromBase);
}

function hasFrontendDomain(workspace: Workspace): boolean {
	return Boolean(String((workspace.collectedBusinessData || {}).frontendDomain || '').trim());
}

function hasBackendSubdomain(workspace: Workspace): boolean {
	return Boolean(String((workspace.collectedBusinessData || {}).backendCmsSubdomain || '').trim());
}

function isStatusAtLeastReadyForReview(onboardingStatus?: string): boolean {
	return ['READY_FOR_REVIEW', 'READY_FOR_LAUNCH', 'LIVE'].includes(String(onboardingStatus || '').toUpperCase());
}

function isStatusAtLeastReadyForLaunch(onboardingStatus?: string): boolean {
	return ['READY_FOR_LAUNCH', 'LIVE'].includes(String(onboardingStatus || '').toUpperCase());
}

function isLive(onboardingStatus?: string): boolean {
	return String(onboardingStatus || '').toUpperCase() === 'LIVE';
}

function deriveInternalChecklistItems(
	workspace: Workspace,
	checklist: ChecklistResponse | null,
	guard: GuardResponse | null,
): InternalChecklistItem[] {
	const websiteType = String(workspace.websiteType || '').toUpperCase();
	const connectorStatus = String(workspace.connectorStatus || '').toUpperCase();
	const connectionMethod = String((workspace.collectedBusinessData || {}).connectionMethod || '').toLowerCase();
	const isNewWebsite = websiteType === 'NEW_WEBSITE';
	const isExistingWebsite = websiteType === 'EXISTING_WEBSITE';
	const isCustomHeadless = websiteType === 'CUSTOM_HEADLESS';
	const manualSupportFlow = isExistingWebsite && connectionMethod === 'manual';

	const supportAssigned = String(workspace.supportAssignment?.status || '').toUpperCase() === 'ASSIGNED';
	const deploymentStarted =
		Number(workspace.currentStep || 0) >= 7 || ['DEPLOYING', 'READY_FOR_REVIEW', 'READY_FOR_LAUNCH', 'LIVE'].includes(String(workspace.onboardingStatus || '').toUpperCase());
	const deploymentCompleted = isStatusAtLeastReadyForReview(workspace.onboardingStatus);
	const guardPassed = Boolean(guard?.ready);
	const qaCompleted = isStatusAtLeastReadyForReview(workspace.onboardingStatus);
	const clientReviewReady = qaCompleted;
	const clientApproved = isStatusAtLeastReadyForLaunch(workspace.onboardingStatus);
	const launchAuthorized = isLive(workspace.onboardingStatus);
	const hasIntegrationContext = Boolean(
		isCustomHeadless ||
		String((workspace.collectedBusinessData || {}).apiDetails || '').trim() ||
		String((workspace.collectedBusinessData || {}).integrationNotes || '').trim(),
	);

	const envApplied = Boolean(workspace.deploymentReadiness?.architectureValidated);
	const connectorInstalled =
		connectorStatus === 'CONNECTED' ||
		connectorStatus === 'PENDING_VERIFICATION' ||
		connectorStatus === 'TOKEN_GENERATED' ||
		manualSupportFlow;
	const connectorVerified = connectorStatus === 'CONNECTED';
	const syncValidated = guardPassed || Boolean(workspace.deploymentReadiness?.contentMapped && workspace.deploymentReadiness?.frontendValidated);

	const professionApplied = Boolean(
		String((workspace.businessProfile || {}).professionKey || '').trim() ||
		String((workspace.collectedBusinessData || {}).professionKey || '').trim() ||
		String((workspace.collectedBusinessData || {}).businessType || '').trim(),
	);
	const modulesActivated = Array.isArray(workspace.selectedModules) && workspace.selectedModules.length > 0;
	const websitePathSelected = Boolean(workspace.websiteType);
	const templateOrConnectorSelected = Boolean(
		String(workspace.selectedTemplateId || '').trim() || connectorStatus === 'CONNECTED' || connectorStatus === 'PENDING_VERIFICATION' || connectorStatus === 'TOKEN_GENERATED',
	);
	const websiteContentPrepared =
		(isNewWebsite && Boolean(workspace.selectedTemplateId)) ||
		(isExistingWebsite && (connectorStatus === 'CONNECTED' || manualSupportFlow)) ||
		(isCustomHeadless && hasIntegrationContext);

	const requiredFrontendDomain = isNewWebsite;
	const requiredBackendSubdomain = isNewWebsite;

	const items: InternalChecklistItem[] = [
		{
			key: 'workspace_created',
			title: 'Workspace Created',
			section: 'workspace_setup',
			owner: 'system',
			status: workspace.id ? 'completed' : 'not_started',
			required: true,
			blocking: true,
			description: 'Workspace record exists and can be tracked in internal operations.',
		},
		{
			key: 'business_profile_completed',
			title: 'Business Profile Completed',
			section: 'workspace_setup',
			owner: 'client',
			status: hasProfileData(workspace) ? 'completed' : 'awaiting_client',
			required: true,
			blocking: true,
			description: 'Core business onboarding details are captured.',
		},
		{
			key: 'profession_config_applied',
			title: 'Profession Config Applied',
			section: 'workspace_setup',
			owner: 'support',
			status: professionApplied ? 'completed' : 'awaiting_support',
			required: true,
			blocking: true,
			description: 'Profession-specific setup profile is selected and applied.',
		},
		{
			key: 'modules_activated',
			title: 'Modules Activated',
			section: 'workspace_setup',
			owner: 'support',
			status: modulesActivated ? 'completed' : 'awaiting_support',
			required: true,
			blocking: true,
			description: 'Required operational modules are enabled for this workspace.',
		},
		{
			key: 'support_owner_assigned',
			title: 'Support Owner Assigned',
			section: 'workspace_setup',
			owner: 'support',
			status: supportAssigned ? 'completed' : 'awaiting_support',
			required: true,
			blocking: true,
			description: 'A support owner is assigned for deployment and handoff.',
		},

		{
			key: 'website_path_selected',
			title: 'Website Path Selected',
			section: 'website_setup',
			owner: 'client',
			status: websitePathSelected ? 'completed' : 'awaiting_client',
			required: true,
			blocking: true,
			description: 'Website delivery path is selected (new, existing, or custom headless).',
		},
		{
			key: 'template_or_connector_selected',
			title: 'Template or Connector Selected',
			section: 'website_setup',
			owner: 'support',
			status: templateOrConnectorSelected ? 'completed' : 'awaiting_support',
			required: true,
			blocking: true,
			description: 'Template or connector path is selected for workspace delivery.',
		},
		{
			key: 'website_content_prepared',
			title: 'Website Content Prepared',
			section: 'website_setup',
			owner: 'client',
			status: websiteContentPrepared ? 'completed' : 'awaiting_client',
			required: true,
			blocking: true,
			description: 'Core website content or source context is ready for deployment.',
		},
		{
			key: 'domain_submitted',
			title: 'Domain Submitted',
			section: 'website_setup',
			owner: 'client',
			status: hasDomainData(workspace) ? 'completed' : 'awaiting_client',
			required: true,
			blocking: true,
			description: 'Primary domain is provided for launch routing.',
		},
		{
			key: 'frontend_domain_connected',
			title: 'Frontend Domain Connected',
			section: 'website_setup',
			owner: 'client',
			status: requiredFrontendDomain ? (hasFrontendDomain(workspace) ? 'completed' : 'awaiting_client') : 'optional',
			required: requiredFrontendDomain,
			blocking: requiredFrontendDomain,
			description: 'Frontend domain is connected where headless frontend routing is required.',
		},
		{
			key: 'cms_backend_subdomain_connected',
			title: 'CMS / Backend Subdomain Connected',
			section: 'website_setup',
			owner: 'support',
			status: requiredBackendSubdomain ? (hasBackendSubdomain(workspace) ? 'completed' : 'awaiting_support') : 'optional',
			required: requiredBackendSubdomain,
			blocking: requiredBackendSubdomain,
			description: 'Backend CMS subdomain is connected for internal/editor operations.',
		},

		{
			key: 'deployment_started',
			title: 'Deployment Started',
			section: 'deployment_integration',
			owner: 'system',
			status: deploymentStarted ? 'completed' : 'not_started',
			required: true,
			blocking: true,
			description: 'Deployment workflow has been initiated.',
		},
		{
			key: 'deployment_completed',
			title: 'Deployment Completed',
			section: 'deployment_integration',
			owner: 'system',
			status: deploymentCompleted ? 'completed' : deploymentStarted ? 'in_progress' : 'not_started',
			required: true,
			blocking: true,
			dependsOn: ['deployment_started'],
			description: 'Deployment pipeline reached a review-ready state.',
		},
		{
			key: 'environment_variables_applied',
			title: 'Environment Variables Applied',
			section: 'deployment_integration',
			owner: 'support',
			status: envApplied ? 'completed' : deploymentStarted ? 'awaiting_support' : 'not_started',
			required: true,
			blocking: true,
			description: 'Required deployment/runtime environment configuration has been applied.',
		},
		{
			key: 'connector_installed',
			title: 'Connector Installed',
			section: 'deployment_integration',
			owner: 'support',
			status: isCustomHeadless ? 'optional' : connectorInstalled ? 'completed' : manualSupportFlow ? 'awaiting_support' : 'not_started',
			required: !isCustomHeadless,
			blocking: !isCustomHeadless,
			dependsOn: ['deployment_started'],
			description: 'Connector is installed or provisioning path is confirmed.',
		},
		{
			key: 'connector_verified',
			title: 'Connector Verified',
			section: 'deployment_integration',
			owner: 'support',
			status: isCustomHeadless ? 'optional' : connectorVerified ? 'completed' : connectorInstalled ? 'in_progress' : 'not_started',
			required: !isCustomHeadless,
			blocking: !isCustomHeadless,
			dependsOn: ['connector_installed'],
			description: 'Connector connectivity and expected capabilities are verified.',
		},
		{
			key: 'sync_validation_passed',
			title: 'Sync Validation Passed',
			section: 'deployment_integration',
			owner: 'system',
			status: syncValidated ? 'completed' : guard?.missingRequirements?.length ? 'blocked' : deploymentStarted ? 'in_progress' : 'not_started',
			required: true,
			blocking: true,
			dependsOn: ['connector_verified'],
			description: 'Data/content sync validation has passed across required surfaces.',
		},

		{
			key: 'launch_guard_passed',
			title: 'Launch Guard Passed',
			section: 'launch_readiness',
			owner: 'system',
			status: guardPassed ? 'completed' : guard?.missingRequirements?.length ? 'blocked' : 'not_started',
			required: true,
			blocking: true,
			description: 'Launch guard validation indicates no blocking deployment requirements.',
		},
		{
			key: 'internal_qa_completed',
			title: 'Internal QA Completed',
			section: 'launch_readiness',
			owner: 'support',
			status: qaCompleted ? 'completed' : deploymentCompleted ? 'in_progress' : 'awaiting_support',
			required: true,
			blocking: true,
			dependsOn: ['sync_validation_passed', 'launch_guard_passed'],
			description: 'Internal QA and readiness checks are completed by support/operations.',
		},
		{
			key: 'client_review_ready',
			title: 'Client Review Ready',
			section: 'launch_readiness',
			owner: 'support',
			status: clientReviewReady ? 'completed' : 'optional',
			required: false,
			blocking: false,
			dependsOn: ['internal_qa_completed'],
			description: 'Client-facing review package/readiness confirmation is prepared.',
		},
		{
			key: 'client_approval_received',
			title: 'Client Approval Received',
			section: 'launch_readiness',
			owner: 'client',
			status: clientApproved ? 'completed' : clientReviewReady ? 'awaiting_client' : 'not_started',
			required: true,
			blocking: true,
			dependsOn: ['client_review_ready'],
			description: 'Client has approved launch readiness and deployment go-ahead.',
		},
		{
			key: 'launch_authorized',
			title: 'Launch Authorized',
			section: 'launch_readiness',
			owner: 'support',
			status: launchAuthorized ? 'completed' : clientApproved ? 'in_progress' : 'not_started',
			required: true,
			blocking: true,
			dependsOn: ['client_approval_received'],
			description: 'Final internal authorization completed for production launch.',
		},
	];

	// Internal master/support checklist model only; a separate client-facing checklist will live in OS Setup Center.
	return items;
}

function countSectionRequired(items: InternalChecklistItem[]) {
	const required = items.filter((item) => item.required).length;
	const completed = items.filter((item) => item.required && item.status === 'completed').length;
	return { required, completed };
}

function overallReadinessLabel(items: InternalChecklistItem[]): 'Not Ready' | 'In Progress' | 'Ready for Review' | 'Ready to Launch' {
	const blockingRemaining = items.filter((item) => item.required && item.blocking && item.status !== 'completed').length;
	const internalQa = items.find((item) => item.key === 'internal_qa_completed');
	const clientApproval = items.find((item) => item.key === 'client_approval_received');

	if (blockingRemaining === 0) return 'Ready to Launch';
	if (internalQa?.status === 'completed' && (clientApproval?.status === 'awaiting_client' || clientApproval?.status === 'completed')) {
		return 'Ready for Review';
	}

	const requiredCompleted = items.filter((item) => item.required && item.status === 'completed').length;
	if (requiredCompleted > 0) return 'In Progress';
	return 'Not Ready';
}

export default function MasterDeploymentDetailPage() {
	const params = useParams<{ workspaceId: string }>();
	const workspaceId = String(params?.workspaceId || '');

	const [workspace, setWorkspace] = useState<Workspace | null>(null);
	const [checklist, setChecklist] = useState<ChecklistResponse | null>(null);
	const [guard, setGuard] = useState<GuardResponse | null>(null);
	const [auditNotes, setAuditNotes] = useState<AuditLog[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [busy, setBusy] = useState(false);
	const [copiedWorkspaceId, setCopiedWorkspaceId] = useState<string | null>(null);

	const recentNotes = useMemo(() => {
		if (!workspaceId) return [];
		return auditNotes
			.filter((item) => item.target === workspaceId)
			.slice(0, 8);
	}, [auditNotes, workspaceId]);

	const internalChecklistItems = useMemo(
		() => (workspace ? deriveInternalChecklistItems(workspace, checklist, guard) : []),
		[workspace, checklist, guard],
	);

	const groupedChecklist = useMemo(
		() =>
			SECTION_CONFIG.map((section) => {
				const items = internalChecklistItems.filter((item) => item.section === section.key);
				return {
					...section,
					items,
					progress: countSectionRequired(items),
				};
			}),
		[internalChecklistItems],
	);

	const totalRequired = internalChecklistItems.filter((item) => item.required).length;
	const totalRequiredCompleted = internalChecklistItems.filter((item) => item.required && item.status === 'completed').length;
	const blockingRemaining = internalChecklistItems.filter(
		(item) => item.required && item.blocking && item.status !== 'completed',
	).length;
	const overallReadiness = overallReadinessLabel(internalChecklistItems);

	async function loadDetails() {
		if (!workspaceId) return;
		setLoading(true);
		setError('');

		try {
			const workspaceRes = await fetch('/api/cloud/workspaces', { cache: 'no-store' });
			const workspaceData = await workspaceRes.json();
			if (!workspaceRes.ok) throw new Error(workspaceData?.error || 'Failed to load workspace list');

			const found = (Array.isArray(workspaceData.workspaces) ? workspaceData.workspaces : []).find(
				(item: Workspace) => item.id === workspaceId,
			) as Workspace | undefined;

			if (!found) throw new Error('Workspace not found');
			setWorkspace(found);

			const [checklistRes, guardRes, auditRes] = await Promise.all([
				fetch(`/api/cloud/workspaces/${workspaceId}/launch-checklist`, { cache: 'no-store' }),
				fetch(`/api/cloud/workspaces/${workspaceId}/launch-guard`, { cache: 'no-store' }),
				fetch('/api/admin/audit', { cache: 'no-store' }),
			]);

			if (checklistRes.ok) {
				setChecklist((await checklistRes.json()) as ChecklistResponse);
			}
			if (guardRes.ok) {
				setGuard((await guardRes.json()) as GuardResponse);
			}
			if (auditRes.ok) {
				const logsData = (await auditRes.json()) as { logs?: AuditLog[] };
				setAuditNotes(Array.isArray(logsData.logs) ? logsData.logs : []);
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to load workspace detail');
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		void loadDetails();
	}, [workspaceId]);

	async function refreshChecklist() {
		if (!workspaceId) return;
		setBusy(true);
		setError('');
		try {
			const [checklistRes, guardRes] = await Promise.all([
				fetch(`/api/cloud/workspaces/${workspaceId}/launch-checklist`, { cache: 'no-store' }),
				fetch(`/api/cloud/workspaces/${workspaceId}/launch-guard`, { cache: 'no-store' }),
			]);

			if (checklistRes.ok) {
				setChecklist((await checklistRes.json()) as ChecklistResponse);
			}
			if (guardRes.ok) {
				setGuard((await guardRes.json()) as GuardResponse);
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to refresh checklist');
		} finally {
			setBusy(false);
		}
	}

	async function updateSupportAssignment() {
		if (!workspaceId || !workspace) return;
		setBusy(true);
		setError('');
		try {
			const setupType = workspace.websiteType || 'NEW_WEBSITE';
			const res = await fetch(`/api/cloud/workspaces/${workspaceId}/support-assignment`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					clientId: workspace.name,
					priority: 'MEDIUM',
					reason: 'Internal update from deployment detail',
					setupType,
					requiredSkills: ['Onboarding'],
					initialNotes: 'Support assignment updated from workspace detail',
					supportOfficerId: 'support-queue',
					supportOfficerName: 'Marveo Support Queue',
				}),
			});

			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				throw new Error(data?.error || 'Support assignment update failed');
			}

			await loadDetails();
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to update support assignment');
		} finally {
			setBusy(false);
		}
	}

	async function copyWorkspaceId(value: string) {
		try {
			const copied = await copyTextToClipboard(value);
			if (!copied) {
				throw new Error('copy-failed');
			}
			setCopiedWorkspaceId(value);
			window.setTimeout(() => {
				setCopiedWorkspaceId((current) => (current === value ? null : current));
			}, 1800);
		} catch {
			setError('Could not copy workspace ID. Click inside the page and try again.');
		}
	}

	if (loading) {
		return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600">Loading workspace detail...</div>;
	}

	if (error) {
		return (
			<div className="space-y-4">
				<div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
					<p className="font-semibold">Could not load workspace detail</p>
					<p className="text-sm mt-1">{error}</p>
				</div>
				<button onClick={() => loadDetails()} className="px-4 py-2 rounded-full bg-slate-900 text-white text-sm font-semibold">
					Retry
				</button>
			</div>
		);
	}

	if (!workspace) {
		return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600">Workspace not found.</div>;
	}

	const collectedData = (workspace.collectedBusinessData as Record<string, unknown> | undefined) || undefined;
	const normalizedConnectorStatus = workspace.connectorStatus || 'NOT_CONNECTED';
	const normalizedPlatform = workspace.connectorSiteMetadata?.platform || String(collectedData?.currentPlatform || '').trim() || 'Unknown';
	const normalizedWooEnabled =
		typeof workspace.connectorSiteMetadata?.woocommerceEnabled === 'boolean'
			? workspace.connectorSiteMetadata.woocommerceEnabled
			: normalizedPlatform.toLowerCase().includes('woocommerce')
				? true
				: undefined;

	return (
		<div className="space-y-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<h1 className="text-3xl font-bold text-slate-900">Deployment Workspace Detail</h1>
					<p className="text-slate-600 mt-1">Internal view for onboarding, support, and launch readiness.</p>
				</div>
				<div className="flex gap-2">
					<Link href="/master/mvp-deployments" className="px-4 py-2 rounded-full bg-slate-100 text-slate-900 text-sm font-semibold">
						Back to queue
					</Link>
					<button
						onClick={() => copyWorkspaceId(workspace.id)}
						title="Copy workspace ID"
						className="px-4 py-2 rounded-full bg-slate-900 text-white text-sm font-semibold hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 transition-colors cursor-pointer"
					>
						{copiedWorkspaceId === workspace.id ? 'Copied!' : 'Copy workspace ID'}
					</button>
				</div>
			</div>

			<div className="grid lg:grid-cols-3 gap-4">
				<div className="rounded-2xl border border-slate-200 bg-white p-4">
					<p className="text-sm text-slate-500">Workspace</p>
					<p className="text-xl font-semibold text-slate-900 mt-1">{workspace.name}</p>
					<p className="text-xs text-slate-500 mt-1">{workspace.id}</p>
					<p className="text-sm text-slate-700 mt-3">Plan: {workspace.planId || 'starter'}</p>
					<p className="text-sm text-slate-700">Website type: {prettyWebsiteType(workspace.websiteType)}</p>
					<p className="text-sm text-slate-700">Template/connector: {workspace.selectedTemplateId || 'Not selected'}</p>
					<p className="text-sm text-slate-700">Connector status: {prettyValue(normalizedConnectorStatus)}</p>
					<p className="text-sm text-slate-700">Detected platform: {normalizedPlatform}</p>
					<p className="text-sm text-slate-700">Created: {new Date(workspace.createdAt).toLocaleString()}</p>
				</div>

				<div className="rounded-2xl border border-slate-200 bg-white p-4">
					<p className="text-sm text-slate-500">Onboarding and deployment</p>
					<div className="mt-2 flex flex-wrap gap-2">
						<span className={`text-xs font-semibold px-2 py-1 rounded-full ${statusBadge(workspace.onboardingStatus || workspace.status)}`}>
							{prettyValue(workspace.onboardingStatus || workspace.status)}
						</span>
						<span className={`text-xs font-semibold px-2 py-1 rounded-full ${statusBadge(guard?.ready ? 'READY' : 'WAITING')}`}>
							{guard?.ready ? 'Launch guard ready' : 'Launch guard pending'}
						</span>
						<span className={`text-xs font-semibold px-2 py-1 rounded-full ${statusBadge(checklist?.readyForLaunch ? 'READY_FOR_LAUNCH' : 'REVIEW')}`}>
							{checklist?.readyForLaunch ? 'Ready for launch' : 'Needs review'}
						</span>
					</div>
					<p className="text-sm text-slate-700 mt-3">Current step: {prettyStep(workspace.onboardingStepKey, workspace.currentStep)}</p>
					<p className="text-sm text-slate-700">Launch blockers: {checklist?.blockers?.length || guard?.missingRequirements?.length || 0}</p>
					<p className="text-sm text-slate-700">WooCommerce: {typeof normalizedWooEnabled === 'boolean' ? (normalizedWooEnabled ? 'Enabled' : 'Not detected') : 'Unknown'}</p>
					<p className="text-sm text-slate-700">Inventory scan: pages {workspace.connectorSiteMetadata?.pageCount ?? '-'}, products {workspace.connectorSiteMetadata?.productCount ?? '-'}, menus {workspace.connectorSiteMetadata?.menuCount ?? '-'}</p>
				</div>

				<div className="rounded-2xl border border-slate-200 bg-white p-4">
					<p className="text-sm text-slate-500">Support assignment</p>
					<div className="mt-2">
						<span className={`text-xs font-semibold px-2 py-1 rounded-full ${statusBadge(workspace.supportAssignment?.status || 'UNASSIGNED')}`}>
							{prettyValue(workspace.supportAssignment?.status || 'UNASSIGNED')}
						</span>
					</div>
					<p className="text-sm text-slate-700 mt-3">Officer: {workspace.supportAssignment?.supportOfficerName || 'Not assigned'}</p>
					<p className="text-sm text-slate-700">Priority: {workspace.supportAssignment?.priority ? toLabel(workspace.supportAssignment.priority) : 'Not set'}</p>
					<p className="text-sm text-slate-700">Reason: {workspace.supportAssignment?.reason || 'Not set'}</p>
					<button
						onClick={() => updateSupportAssignment()}
						disabled={busy}
						className="mt-4 px-4 py-2 rounded-full bg-indigo-100 text-indigo-800 text-sm font-semibold disabled:opacity-60"
					>
						Assign/update support placeholder
					</button>
				</div>
			</div>

			<div className="space-y-4">
				<div className="rounded-2xl border border-slate-200 bg-white p-4">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<div>
							<p className="text-sm text-slate-500">Internal deployment checklist</p>
							<p className="text-xs text-slate-500 mt-1">Master/Support internal readiness model. Client-facing checklist will be delivered separately in OS Setup Center.</p>
						</div>
						<button
							onClick={() => refreshChecklist()}
							disabled={busy}
							className="px-3 py-1.5 rounded-full bg-slate-100 text-slate-800 text-xs font-semibold disabled:opacity-60"
						>
							Refresh checklist
						</button>
					</div>

					<div className="mt-4 grid gap-3 sm:grid-cols-3">
						<div className="rounded-xl border border-slate-100 p-3">
							<p className="text-xs uppercase tracking-wide text-slate-500">Required Completed</p>
							<p className="mt-1 text-lg font-semibold text-slate-900">{totalRequiredCompleted} / {totalRequired}</p>
						</div>
						<div className="rounded-xl border border-slate-100 p-3">
							<p className="text-xs uppercase tracking-wide text-slate-500">Blocking Remaining</p>
							<p className="mt-1 text-lg font-semibold text-slate-900">{blockingRemaining}</p>
						</div>
						<div className="rounded-xl border border-slate-100 p-3">
							<p className="text-xs uppercase tracking-wide text-slate-500">Overall Readiness</p>
							<p className="mt-1 text-lg font-semibold text-slate-900">{overallReadiness}</p>
						</div>
					</div>
				</div>

				<div className="grid gap-4 lg:grid-cols-2">
					{groupedChecklist.map((section) => (
						<div key={section.key} className="rounded-2xl border border-slate-200 bg-white p-4">
							<div className="flex items-center justify-between gap-2">
								<p className="text-sm font-semibold text-slate-900">{section.title}</p>
								<p className="text-xs text-slate-500">
									{section.progress.completed} / {section.progress.required} required completed
								</p>
							</div>
							<div className="mt-3 space-y-2">
								{section.items.map((item) => {
									const statusMeta = STATUS_META[item.status];
									const ownerMeta = OWNER_META[item.owner];

									return (
										<div key={item.key} className="rounded-xl border border-slate-100 px-3 py-3">
											<div className="flex flex-wrap items-center justify-between gap-2">
												<p className="text-sm font-medium text-slate-800">{item.title}</p>
												<div className="flex flex-wrap items-center gap-2">
													<span className={`text-[11px] font-semibold px-2 py-1 rounded-full ${ownerMeta.badgeClass}`}>{ownerMeta.label}</span>
													<span className={`text-[11px] font-semibold px-2 py-1 rounded-full ${statusMeta.badgeClass}`}>{statusMeta.label}</span>
												</div>
											</div>
											{item.description ? <p className="mt-1 text-xs text-slate-600">{item.description}</p> : null}
											<div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
												<span>{item.required ? 'Required' : 'Optional'}</span>
												<span>•</span>
												<span>{item.blocking ? 'Blocking' : 'Non-blocking'}</span>
												{item.dependsOn?.length ? (
													<>
														<span>•</span>
														<span>Depends on: {item.dependsOn.map(toLabel).join(', ')}</span>
													</>
												) : null}
											</div>
										</div>
									);
								})}
							</div>
						</div>
					))}
				</div>

				<div className="rounded-2xl border border-slate-200 bg-white p-4">
					<p className="text-sm text-slate-500">Operational guidance</p>
					<div className="mt-3 space-y-3">
						<div>
							<p className="text-xs uppercase tracking-wide text-slate-500">Internal blockers</p>
							<p className="text-sm text-slate-700 mt-1">
								{internalChecklistItems.filter((item) => item.required && item.blocking && item.status !== 'completed').length
									? internalChecklistItems
										.filter((item) => item.required && item.blocking && item.status !== 'completed')
										.map((item) => item.title)
										.join('; ')
									: 'No internal blocking items.'}
							</p>
						</div>
						<div>
							<p className="text-xs uppercase tracking-wide text-slate-500">Launch guard missing requirements</p>
							<p className="text-sm text-slate-700 mt-1">{guard?.missingRequirements?.length ? guard.missingRequirements.map((item) => toLabel(item)).join('; ') : 'No launch guard blockers.'}</p>
						</div>
						<div>
							<p className="text-xs uppercase tracking-wide text-slate-500">Recovery actions</p>
							<p className="text-sm text-slate-700 mt-1">{guard?.recoveryActions?.length ? guard.recoveryActions.map((item) => toLabel(item)).join('; ') : 'No recovery actions provided.'}</p>
						</div>
					</div>
				</div>
			</div>

			<div className="grid lg:grid-cols-2 gap-4">
				<div className="rounded-2xl border border-slate-200 bg-white p-4">
					<p className="text-sm text-slate-500">Business setup summary</p>
					<div className="mt-3 space-y-2 text-sm text-slate-700">
						<p><span className="font-semibold text-slate-900">Business type:</span> {String((workspace.businessProfile || {}).businessType || (workspace.collectedBusinessData || {}).businessType || 'Not provided')}</p>
						<p><span className="font-semibold text-slate-900">Primary domain:</span> {String((workspace.businessProfile || {}).domain || (workspace.collectedBusinessData || {}).domain || workspace.contentBaseUrl || 'Not provided')}</p>
						<p><span className="font-semibold text-slate-900">Connection method:</span> {String((workspace.collectedBusinessData || {}).connectionMethod || 'Not selected')}</p>
						<p><span className="font-semibold text-slate-900">Frontend domain:</span> {String((workspace.collectedBusinessData || {}).frontendDomain || 'Not connected')}</p>
						<p><span className="font-semibold text-slate-900">Backend subdomain:</span> {String((workspace.collectedBusinessData || {}).backendCmsSubdomain || 'Not connected')}</p>
					</div>
				</div>

				<div className="rounded-2xl border border-slate-200 bg-white p-4">
					<p className="text-sm text-slate-500">Operational readiness summary</p>
					<div className="mt-3 space-y-2 text-sm text-slate-700">
						<p><span className="font-semibold text-slate-900">Modules selected:</span> {Array.isArray(workspace.selectedModules) && workspace.selectedModules.length > 0 ? workspace.selectedModules.length : 0}</p>
						<p><span className="font-semibold text-slate-900">Architecture:</span> {workspace.architecture ? toLabel(workspace.architecture) : 'Not set'}</p>
						<p><span className="font-semibold text-slate-900">Connector verification:</span> {prettyValue(normalizedConnectorStatus)}</p>
						<p><span className="font-semibold text-slate-900">Launch guard:</span> {guard?.ready ? 'Passed' : 'Pending'}</p>
						<p><span className="font-semibold text-slate-900">Last updated:</span> {new Date(workspace.updatedAt).toLocaleString()}</p>
					</div>
				</div>
			</div>

			<div className="rounded-2xl border border-slate-200 bg-white p-4">
				<p className="text-sm text-slate-500">Recent audit activity</p>
				{recentNotes.length === 0 ? (
					<p className="text-sm text-slate-600 mt-3">No audit notes found for this workspace yet.</p>
				) : (
					<ul className="mt-3 space-y-2">
						{recentNotes.map((log) => (
							<li key={log.id} className="rounded-xl border border-slate-100 px-3 py-2">
								<p className="text-xs text-slate-500">{new Date(log.at).toLocaleString()} • {log.actorEmail}</p>
								<p className="text-sm font-semibold text-slate-800 mt-1">{prettyAuditAction(log.action)}</p>
								<p className="text-sm text-slate-700 mt-1">{prettyAuditDetails(log.details)}</p>
							</li>
						))}
					</ul>
				)}
			</div>
		</div>
	);
}
