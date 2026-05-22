'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

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

function pretty(value: unknown): string {
	return JSON.stringify(value, null, 2);
}

function statusBadge(value?: string) {
	const raw = String(value || 'unknown').toLowerCase();
	if (raw.includes('ready') || raw.includes('live') || raw.includes('launched') || raw.includes('assigned')) return 'bg-emerald-100 text-emerald-700';
	if (raw.includes('failed') || raw.includes('blocked')) return 'bg-red-100 text-red-700';
	if (raw.includes('progress') || raw.includes('deploy')) return 'bg-blue-100 text-blue-700';
	if (raw.includes('wait') || raw.includes('pending')) return 'bg-amber-100 text-amber-700';
	return 'bg-slate-100 text-slate-700';
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
			await navigator.clipboard.writeText(value);
			setCopiedWorkspaceId(value);
			window.setTimeout(() => {
				setCopiedWorkspaceId((current) => (current === value ? null : current));
			}, 1800);
		} catch {
			setError('Could not copy workspace ID. Please copy it manually.');
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

			<div className="grid lg:grid-cols-2 gap-4">
				<div className="rounded-2xl border border-slate-200 bg-white p-4">
					<div className="flex items-center justify-between">
						<p className="text-sm text-slate-500">Launch checklist</p>
						<button
							onClick={() => refreshChecklist()}
							disabled={busy}
							className="px-3 py-1.5 rounded-full bg-slate-100 text-slate-800 text-xs font-semibold disabled:opacity-60"
						>
							Refresh checklist
						</button>
					</div>
					{checklist ? (
						<div className="mt-3 space-y-2">
							{checklist.items.map((item) => (
								<div key={item.key} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2">
									<p className="text-sm text-slate-700">{item.label}</p>
									<span className={`text-xs font-semibold px-2 py-1 rounded-full ${item.completed ? 'bg-emerald-100 text-emerald-700' : item.required ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'}`}>
										{item.completed ? 'Done' : item.required ? 'Pending' : 'Optional'}
									</span>
								</div>
							))}
						</div>
					) : (
						<p className="text-sm text-slate-600 mt-3">Checklist not available.</p>
					)}
				</div>

				<div className="rounded-2xl border border-slate-200 bg-white p-4">
					<p className="text-sm text-slate-500">Blockers and guidance</p>
					<div className="mt-3 space-y-3">
						<div>
							<p className="text-xs uppercase tracking-wide text-slate-500">Checklist blockers</p>
							<p className="text-sm text-slate-700 mt-1">{checklist?.blockers?.length ? checklist.blockers.map((item) => toLabel(item)).join('; ') : 'No checklist blockers.'}</p>
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
					<p className="text-sm text-slate-500">Business profile</p>
					<pre className="mt-3 rounded-xl bg-slate-950 text-slate-100 text-xs p-3 overflow-x-auto">{pretty(workspace.businessProfile || {})}</pre>
				</div>

				<div className="rounded-2xl border border-slate-200 bg-white p-4">
					<p className="text-sm text-slate-500">Collected setup payload</p>
					<pre className="mt-3 rounded-xl bg-slate-950 text-slate-100 text-xs p-3 overflow-x-auto">{pretty(workspace.collectedBusinessData || {})}</pre>
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
