'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

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

function copyText(value: string) {
	void navigator.clipboard.writeText(value);
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

	const queueRows = useMemo(() => {
		return workspaces.map((workspace) => {
			const checklist = checklistByWorkspace[workspace.id];
			const guard = guardByWorkspace[workspace.id];
			return {
				workspace,
				checklist,
				guard,
			};
		});
	}, [workspaces, checklistByWorkspace, guardByWorkspace]);

	async function loadQueue() {
		setLoading(true);
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
			setLoading(false);
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
		try {
			const setupType = workspace.websiteType || (workspace.status === 'onboarding' ? 'EXISTING_WEBSITE' : 'NEW_WEBSITE');
			await fetch(`/api/cloud/workspaces/${workspace.id}/support-assignment`, {
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
				}),
			});
			await loadQueue();
		} finally {
			setBusyWorkspace('');
		}
	}

	async function copyWorkspaceId(workspaceId: string) {
		try {
			copyText(workspaceId);
			setCopiedWorkspaceId(workspaceId);
			window.setTimeout(() => {
				setCopiedWorkspaceId((current) => (current === workspaceId ? null : current));
			}, 1800);
		} catch {
			setError('Could not copy workspace ID. Please copy it manually.');
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
						onClick={() => loadQueue()}
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

			{loading ? (
				<div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600">Loading deployment queue...</div>
			) : queueRows.length === 0 ? (
				<div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600">No onboarding workspaces found yet.</div>
			) : (
				<div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
					<div className="overflow-x-auto">
						<table className="w-full min-w-[1250px]">
							<thead className="bg-slate-50 border-b border-slate-200">
								<tr>
									{['Workspace', 'Plan', 'Website Type', 'Onboarding Status', 'Current Step', 'Deployment', 'Support', 'Launch Readiness', 'Blockers', 'Created', 'Actions'].map((header) => (
										<th key={header} className="px-4 py-3 text-left text-xs uppercase tracking-wide text-slate-500 font-semibold">
											{header}
										</th>
									))}
								</tr>
							</thead>
							<tbody>
								{queueRows.map(({ workspace, checklist, guard }) => (
									<tr key={workspace.id} className="border-b border-slate-100 align-top hover:bg-slate-50/70 transition-colors">
										<td className="px-4 py-3">
											<p className="font-semibold text-slate-900">{workspace.name}</p>
											<p className="text-xs text-slate-500 mt-1">{workspace.id}</p>
										</td>
										<td className="px-4 py-3 text-sm text-slate-700 capitalize">{workspace.planId || globalPlan}</td>
										<td className="px-4 py-3 text-sm text-slate-700">{prettyWebsiteType(workspace.websiteType)}</td>
										<td className="px-4 py-3">
											<span className={`text-xs font-semibold px-2 py-1 rounded-full ${badgeClass(workspace.onboardingStatus || workspace.status)}`}>
												{prettyStatus(workspace.onboardingStatus || workspace.status)}
											</span>
										</td>
										<td className="px-4 py-3 text-sm text-slate-700">{prettyStep(workspace.onboardingStepKey, workspace.currentStep)}</td>
										<td className="px-4 py-3">
											<span className={`text-xs font-semibold px-2 py-1 rounded-full ${badgeClass(guard?.ready ? 'READY' : workspace.status)}`}>
												{guard?.ready ? 'Ready' : prettyStatus(workspace.status)}
											</span>
										</td>
										<td className="px-4 py-3">
											<span className={`text-xs font-semibold px-2 py-1 rounded-full ${badgeClass(workspace.supportAssignment?.status || 'UNASSIGNED')}`}>
												{prettyStatus(workspace.supportAssignment?.status || 'UNASSIGNED')}
											</span>
											{workspace.supportAssignment?.supportOfficerName && (
												<p className="text-xs text-slate-500 mt-1">{workspace.supportAssignment.supportOfficerName}</p>
											)}
										</td>
										<td className="px-4 py-3">
											<span className={`text-xs font-semibold px-2 py-1 rounded-full ${badgeClass(checklist?.readyForLaunch ? 'READY_FOR_LAUNCH' : 'WAITING')}`}>
												{checklist?.readyForLaunch ? 'Ready for launch' : 'Needs review'}
											</span>
										</td>
										<td className="px-4 py-3 text-xs text-slate-600 max-w-xs">
											<ul className="space-y-1">
												{prettyBlockers(checklist, guard).map((item) => (
													<li key={`${workspace.id}-${item}`} className="leading-4">{item}</li>
												))}
											</ul>
										</td>
										<td className="px-4 py-3 text-sm text-slate-700">{new Date(workspace.createdAt).toLocaleDateString()}</td>
										<td className="px-4 py-3">
											<div className="flex flex-col gap-2">
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
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			)}
		</div>
	);
}
