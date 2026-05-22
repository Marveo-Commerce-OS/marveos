export const dynamic = 'force-dynamic';

import { getControlCenterSnapshot } from '../_lib/controlCenter';

export default async function MasterTemplatesPage() {
  const snapshot = await getControlCenterSnapshot();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Templates</h1>
        <p className="mt-2 text-sm text-slate-600">Template catalog management for new workspace provisioning.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Business</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">Catalog</p>
          <p className="mt-2 text-xs text-slate-500">Coming soon. Not yet connected.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ecommerce</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">Catalog</p>
          <p className="mt-2 text-xs text-slate-500">Coming soon. Not yet connected.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Landing Page</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">Catalog</p>
          <p className="mt-2 text-xs text-slate-500">Coming soon. Not yet connected.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
        <h2 className="text-lg font-semibold text-slate-900">Current usage signal</h2>
        <p className="mt-2">Workspaces with selected templates: <span className="font-semibold">{snapshot.templatesInUse}</span></p>
        <p className="mt-2 text-xs text-slate-500">This usage value is live. Catalog CRUD controls are not connected in this phase.</p>
      </div>
    </div>
  );
}
