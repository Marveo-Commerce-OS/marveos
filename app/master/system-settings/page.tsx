export const dynamic = 'force-dynamic';

import { getControlCenterSnapshot } from '../_lib/controlCenter';

export default async function MasterSystemSettingsPage() {
  const snapshot = await getControlCenterSnapshot();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">System Settings</h1>
        <p className="mt-2 text-sm text-slate-600">Internal Marveo platform configuration and operational controls.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">Maintenance mode</h2>
          <p className="mt-3 text-sm text-slate-700">
            Site under construction: <span className="font-semibold">{snapshot.maintenance.site_under_construction ? 'Enabled' : 'Disabled'}</span>
          </p>
          <p className="mt-2 text-sm text-slate-700">Title: {snapshot.maintenance.under_construction_title}</p>
          <p className="mt-2 text-sm text-slate-700">Message: {snapshot.maintenance.under_construction_message}</p>
          <p className="mt-3 text-xs text-slate-500">Live data</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">Role visibility map</h2>
          <p className="mt-3 text-sm text-slate-700">Configured roles: {Object.keys(snapshot.roleVisibility).length}</p>
          <p className="mt-2 text-sm text-slate-700">Configuration editing UI: Coming soon</p>
          <p className="mt-3 text-xs text-slate-500">Partially connected (read-only in this phase)</p>
        </div>
      </div>
    </div>
  );
}
