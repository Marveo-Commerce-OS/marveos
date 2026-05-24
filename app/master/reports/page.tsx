export const dynamic = 'force-dynamic';

import { getControlCenterSnapshot } from '../_lib/controlCenter';
import ReportsBoard, { type ReportRow } from './ReportsBoard';

export default async function MasterReportsPage() {
	const snapshot = await getControlCenterSnapshot();

	const incidentRows: ReportRow[] = snapshot.workspaces
		.filter((workspace) => {
			const failed = workspace.status === 'blocked' || workspace.onboardingStatus === 'FAILED' || workspace.connectorStatus === 'FAILED';
			const complaint = Boolean(workspace.supportRequired) && workspace.supportAssignment?.status !== 'ASSIGNED';
			return failed || complaint;
		})
		.slice(0, 20)
		.map((workspace) => {
			const failed = workspace.status === 'blocked' || workspace.onboardingStatus === 'FAILED' || workspace.connectorStatus === 'FAILED';
			return {
				id: workspace.id,
				name: workspace.name,
				country: workspace.country,
				incidentType: (failed ? 'Incident' : 'Complaint') as 'Incident' | 'Complaint',
				severity: (failed ? 'high' : 'medium') as 'high' | 'medium' | 'low',
				status: workspace.status,
				supportStatus: workspace.supportAssignment?.status || 'UNASSIGNED',
				updatedAt: workspace.updatedAt,
			};
		});

	return (
		<div className="space-y-6">
			<div>
				<p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Business Intelligence</p>
				<h1 className="mt-2 text-3xl font-bold text-slate-900">Reports</h1>
				<p className="mt-2 max-w-3xl text-sm text-slate-600">
					Incident, complaint, and commercial intelligence for leadership-level review and action planning.
				</p>
			</div>
			<ReportsBoard
				rows={incidentRows}
				snapshotMetrics={{
					failedDeployments: snapshot.metrics.failedDeployments,
					openSupportAssignments: snapshot.metrics.openSupportAssignments,
					launchBlockers: snapshot.metrics.launchBlockers,
					connectedWebsites: snapshot.metrics.connectedWebsites,
					systemStatus: snapshot.metrics.systemStatus,
					plansSold: snapshot.metrics.plansSold,
					plansAvailable: snapshot.metrics.plansAvailable,
				}}
			/>
		</div>
	);
}
