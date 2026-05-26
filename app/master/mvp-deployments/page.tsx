'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { copyTextToClipboard } from '@/lib/client/clipboard';

type Workspace = {
	id: string;
	name: string;
	planId?: string;
	websiteType?: 'NEW_WEBSITE' | 'EXISTING_WEBSITE' | 'CUSTOM_HEADLESS';
	onboardingStatus?: string;
	onboardingStepKey?: string;
	currentStep: number;
	status: string;
	createdAt: string;
	supportAssignment?: {
		status: 'UNASSIGNED' | 'ASSIGNED';
		supportOfficerName?: string;
	};
};

type ChecklistResult = {
	readyForLaunch: boolean;
	blockers: string[];
};

type GuardResult = {
	ready: boolean;
	missingRequirements: string[];
};

const ONBOARDING_STATUS_LABELS: Record<string, string> = {
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
};

const ONBOARDING_STEP_LABELS: Record<string, string> = {
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

function prettyStatus(value: string): string {
	const key = normalizeToken(value);
	return ONBOARDING_STATUS_LABELS[key] || toLabel(value);
}

function prettyStep(stepKey: string | undefined, fallbackStep: number): string {
	if (!stepKey) return `Step ${fallbackStep}`;
	const key = normalizeToken(stepKey);
	return ONBOARDING_STEP_LABELS[key] || toLabel(stepKey);
}

function prettyBlockers(checklist: ChecklistResult | undefined, guard: GuardResult | undefined): string[] {
	const source = checklist?.blockers?.length ? checklist.blockers : guard?.missingRequirements || [];
	if (source.length === 0) return ['No blockers'];
	return source.slice(0, 2).map((item) => toLabel(item));
}

function badgeClass(status: string): string {
	const key = status.toLowerCase();
	if (key.includes('ready') || key.includes('live') || key.includes('launched') || key.includes('assigned')) return 'bg-emerald-100 text-emerald-700';
	if (key.includes('fail') || key.includes('blocked')) return 'bg-red-100 text-red-700';
	if (key.includes('progress') || key.includes('deploy')) return 'bg-blue-100 text-blue-700';
	if (key.includes('waiting') || key.includes('pending')) return 'bg-amber-100 text-amber-700';
	return 'bg-slate-100 text-slate-700';
}

function prettyWebsiteType(type?: string) {
	if (!type) return 'Not set';
	if (type === 'NEW_WEBSITE') return 'New Website';
	if (type === 'EXISTING_WEBSITE') return 'Existing Website';
	return 'Custom / Headless';
}

async function copyText(value: string) {
	return copyTextToClipboard(value);
}

export default function MasterDeploymentsPage() {
	const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
	const [checklistByWorkspace, setChecklistByWorkspace] = useState<Record<string, ChecklistResult>>({});
	const [guardByWorkspace, setGuardByWorkspace] = useState<Record<string, GuardResult>>({});
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [busyWorkspace, setBusyWorkspace] = useState('');
	const [globalPlan, setGlobalPlan] = useState('starter');
	const [copiedWorkspaceId, setCopiedWorkspaceId] = useState<string | null>(null);
	const [searchTerm, setSearchTerm] = useState('');

	const queueRows = useMemo(() => {
		const term = searchTerm.trim().toLowerCase();
		const baseRows = workspaces.map((workspace) => {
			const checklist = checklistByWorkspace[workspace.id];
			const guard = guardByWorkspace[workspace.id];
			return {
				workspace,
				checklist,
				guard,
			};
		});
		if (!term) return baseRows;
		return baseRows.filter(({ workspace }) => {
			const blob = [
				workspace.name,
				workspace.id,
				workspace.planId || '',
				workspace.websiteType || '',
				workspace.onboardingStatus || workspace.status,
				workspace.supportAssignment?.supportOfficerName || '',
			].join(' ').toLowerCase();
			return blob.includes(term);
		});
	}, [workspaces, checklistByWorkspace, guardByWorkspace, searchTerm]);

	async function loadQueue(options?: { silent?: boolean }) {
		const silent = Boolean(options?.silent);
		if (!silent) setLoading(true);
		setError('');
		try {
			const res = await fetch('/api/cloud/workspaces', { cache: 'no-store' });
			const data = await res.json();
			if (!res.ok) throw new Error(data?.error || 'Failed to load deployment queue');

			const rows = Array.isArray(data.workspaces) ? (data.workspaces as Workspace[]) : [];
			setWorkspaces(rows);
			setGlobalPlan(String(data.plan || 'starter'));

			const checklistEntries = await Promise.all(
				rows.map(async (workspace) => {
					try {
						const checklistRes = await fetch(`/api/cloud/workspaces/${workspace.id}/launch-checklist`, { cache: 'no-store' });
						if (!checklistRes.ok) {
							return [workspace.id, { readyForLaunch: false, blockers: ['Checklist unavailable'] }] as const;
						}
						const checklistData = (await checklistRes.json()) as ChecklistResult;
						return [workspace.id, checklistData] as const;
					} catch {
						return [workspace.id, { readyForLaunch: false, blockers: ['Checklist request failed'] }] as const;
					}
				}),
			);

			const guardEntries = await Promise.all(
				rows.map(async (workspace) => {
					try {
						const guardRes = await fetch(`/api/cloud/workspaces/${workspace.id}/launch-guard`, { cache: 'no-store' });
						if (!guardRes.ok) {
							return [workspace.id, { ready: false, missingRequirements: ['Launch guard unavailable'] }] as const;
						}
						const guardData = (await guardRes.json()) as GuardResult;
						return [workspace.id, guardData] as const;
					} catch {
						return [workspace.id, { ready: false, missingRequirements: ['Launch guard request failed'] }] as const;
					}
				}),
			);

			setChecklistByWorkspace(Object.fromEntries(checklistEntries));
			setGuardByWorkspace(Object.fromEntries(guardEntries));
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to load queue');
		} finally {
			if (!silent) setLoading(false);
		}
	}

	useEffect(() => {
		void loadQueue();
	}, []);

	async function refreshChecklist(workspaceId: string) {
		setBusyWorkspace(workspaceId);
		try {
			const checklistRes = await fetch(`/api/cloud/workspaces/${workspaceId}/launch-checklist`, { cache: 'no-store' });
			if (checklistRes.ok) {
				const checklist = (await checklistRes.json()) as ChecklistResult;
				setChecklistByWorkspace((prev) => ({ ...prev, [workspaceId]: checklist }));
			}

			const guardRes = await fetch(`/api/cloud/workspaces/${workspaceId}/launch-guard`, { cache: 'no-store' });
			if (guardRes.ok) {
				const guard = (await guardRes.json()) as GuardResult;
				setGuardByWorkspace((prev) => ({ ...prev, [workspaceId]: guard }));
			}
		} finally {
			setBusyWorkspace('');
		}
	}

	async function assignSupportPlaceholder(workspace: Workspace) {
		setBusyWorkspace(workspace.id);
		const previousSupport = workspace.supportAssignment;
		setWorkspaces((current) =>
			current.map((row) =>
				row.id === workspace.id
					? {
						...row,
						supportAssignment: {
							status: 'ASSIGNED',
							supportOfficerName: 'Marveo Support Queue',
						},
					}
					: row,
			),
		);
		try {
			const setupType = workspace.websiteType || (workspace.status === 'onboarding' ? 'EXISTING_WEBSITE' : 'NEW_WEBSITE');
			const res = await fetch(`/api/cloud/workspaces/${workspace.id}/support-assignment`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					clientId: workspace.name,
					priority: 'MEDIUM',
					reason: 'Internal queue assignment update',
					setupType,
					requiredSkills: ['Onboarding'],
					initialNotes: 'Placeholder assignment from deployment queue',
					supportOfficerId: 'support-queue',
					supportOfficerName: 'Marveo Support Queue',
					supportOfficerType: 'CUSTOMER_SUPPORT',
				}),
			});
			if (!res.ok) {
				const payload = (await res.json().catch(() => null)) as { error?: string } | null;
				throw new Error(payload?.error || 'Support assignment update failed');
			}
			void loadQueue({ silent: true });
		} catch (err) {
			setWorkspaces((current) =>
				current.map((row) =>
					row.id === workspace.id
						? {
							...row,
							supportAssignment: previousSupport,
						}
						: row,
				),
			);
			setError(err instanceof Error ? err.message : 'Support assignment update failed');
		} finally {
			setBusyWorkspace('');
		}
	}

	async function copyWorkspaceId(workspaceId: string) {
		try {
			const copied = await copyText(workspaceId);
			if (!copied) {
				throw new Error('copy-failed');
			}
			setCopiedWorkspaceId(workspaceId);
			window.setTimeout(() => {
				setCopiedWorkspaceId((current) => (current === workspaceId ? null : current));
			}, 1800);
		} catch {
			setError('Could not copy workspace ID. Click inside the page and try again.');
		}
	}

	return (
		<div className="space-y-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<h1 className="text-3xl font-bold text-slate-900">Deployment Queue</h1>
					<p className="text-slate-600 mt-1">Internal operations view for onboarding, support, and launch readiness.</p>
				</div>
				<div className="flex gap-2">
					<button
						onClick={() => void loadQueue({ silent: true })}
						disabled={loading}
						className="px-4 py-2 rounded-full bg-slate-900 text-white text-sm font-semibold disabled:opacity-60"
					>
						Refresh queue
					</button>
					<Link href="/master/workspaces" className="px-4 py-2 rounded-full bg-slate-100 text-slate-900 text-sm font-semibold">
						View workspaces
					</Link>
				</div>
			</div>

			<div className="rounded-2xl border border-slate-200 bg-white p-4">
				<p className="text-sm text-slate-600">Active plan</p>
				<p className="text-xl font-semibold text-slate-900 capitalize">{globalPlan}</p>
			</div>

			{error && (
				<div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
					<p className="font-semibold">Could not load queue</p>
					<p className="text-sm mt-1">{error}</p>
				</div>
			)}

			<div className="rounded-2xl border border-slate-200 bg-white p-4">
				<label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Filter deployment queue</label>
				<input
					value={searchTerm}
					onChange={(e) => setSearchTerm(e.target.value)}
					placeholder="Search by workspace, id, plan, status, support"
					className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
				/>
			</div>

			{loading ? (
				<div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600">Loading deployment queue...</div>
			) : queueRows.length === 0 ? (
				<div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600">No onboarding workspaces found yet.</div>
			) : (
				<div className="rounded-2xl border border-slate-200 bg-white p-4">
					<div className="space-y-3">
						{queueRows.map(({ workspace, checklist, guard }) => (
							<div key={workspace.id} className="rounded-xl border border-slate-200 p-4">
								<div className="flex flex-wrap items-start justify-between gap-3">
									<div>
										<p className="font-semibold text-slate-900">{workspace.name}</p>
										<p className="text-xs text-slate-500 mt-1">{workspace.id}</p>
									</div>
									<div className="flex flex-wrap items-center gap-2 text-xs">
										<span className={`font-semibold px-2 py-1 rounded-full ${badgeClass(workspace.onboardingStatus || workspace.status)}`}>{prettyStatus(workspace.onboardingStatus || workspace.status)}</span>
										<span className={`font-semibold px-2 py-1 rounded-full ${badgeClass(checklist?.readyForLaunch ? 'READY_FOR_LAUNCH' : 'WAITING')}`}>{checklist?.readyForLaunch ? 'Ready for launch' : 'Needs review'}</span>
									</div>
								</div>

								<div className="mt-3 grid gap-3 text-sm text-slate-700 md:grid-cols-2 xl:grid-cols-4">
									<div>
										<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Plan / Website</p>
										<p className="capitalize">{workspace.planId || globalPlan}</p>
										<p className="text-xs text-slate-500">{prettyWebsiteType(workspace.websiteType)}</p>
									</div>
									<div>
										<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Step / Deployment</p>
										<p>{prettyStep(workspace.onboardingStepKey, workspace.currentStep)}</p>
										<p className="text-xs text-slate-500">{guard?.ready ? 'Ready' : prettyStatus(workspace.status)}</p>
									</div>
									<div>
										<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Support</p>
										<p>{prettyStatus(workspace.supportAssignment?.status || 'UNASSIGNED')}</p>
										<p className="text-xs text-slate-500">{workspace.supportAssignment?.supportOfficerName || 'Unassigned'}</p>
									</div>
									<div>
										<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Blockers</p>
										<p className="text-xs leading-5">{prettyBlockers(checklist, guard).join('; ')}</p>
									</div>
								</div>

								<div className="mt-3 flex flex-wrap items-center gap-2">
									<button
										onClick={() => refreshChecklist(workspace.id)}
										disabled={busyWorkspace === workspace.id}
										className="text-xs px-3 py-1.5 rounded-full bg-slate-100 text-slate-800 font-semibold hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
									>
										Refresh checklist
									</button>
									<button
										onClick={() => assignSupportPlaceholder(workspace)}
										disabled={busyWorkspace === workspace.id}
										className="text-xs px-3 py-1.5 rounded-full bg-indigo-100 text-indigo-800 font-semibold hover:bg-indigo-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
									>
										Assign/update support
									</button>
									<Link href={`/master/mvp-deployments/${workspace.id}`} className="text-xs px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold text-center hover:bg-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 transition-colors cursor-pointer">
										View workspace
									</Link>
									<button
										onClick={() => copyWorkspaceId(workspace.id)}
										title="Copy workspace ID"
										className="text-xs px-3 py-1.5 rounded-full bg-slate-200 text-slate-800 font-semibold hover:bg-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 transition-colors cursor-pointer"
									>
										{copiedWorkspaceId === workspace.id ? 'Copied!' : 'Copy workspace ID'}
									</button>
								</div>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
