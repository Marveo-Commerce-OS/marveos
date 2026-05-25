export const dynamic = 'force-dynamic';

import { getControlCenterSnapshot } from '../_lib/controlCenter';
import { readAdminStore } from '@/lib/adminStore';
import BillingSubscriptionsClient from './BillingSubscriptionsClient';
import BillingPlansManagerClient from './BillingPlansManagerClient';

export default async function MasterBillingPage() {
  const snapshot = await getControlCenterSnapshot();
  const store = await readAdminStore();
  const commercial = store.cloud.commercial;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Plans & Billing</h1>
        <p className="mt-2 text-sm text-slate-600">Platform-native subscription operations across organizations, plans, intervals, trials, and payment references.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Default New-Workspace Plan</p>
          <p className="mt-2 text-2xl font-bold capitalize text-slate-900">{snapshot.accountPlan}</p>
          <p className="mt-2 text-xs text-slate-500">Client onboarding default</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Active Commercial Plans</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{commercial.plans.filter((plan) => plan.active !== false).length}</p>
          <p className="mt-2 text-xs text-slate-500">Plans visible to public pricing API</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Client Subscription Summary</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{Object.keys(commercial.subscriptions).length} subscriptions</p>
          <p className="mt-2 text-xs text-slate-500">Live client billing records</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
        <h2 className="text-lg font-semibold text-slate-900">Payment operations</h2>
        <ul className="mt-3 space-y-2">
          <li>Plan lifecycle and pricing are managed in this module and persisted in platform state.</li>
          <li>Subscription status transitions persist in platform state.</li>
          <li>Trial expiry, suspension, reactivation, and cleanup actions are operational.</li>
        </ul>
      </div>

      <BillingPlansManagerClient />

      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
        <h2 className="text-lg font-semibold text-slate-900">Regional pricing and trial controls</h2>
        <p className="mt-2">
          Marketing pricing uses these backend plan definitions. Frontend fallbacks are for graceful degradation only.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="px-3 py-2 font-semibold">Plan</th>
                <th className="px-3 py-2 font-semibold">Trial</th>
                <th className="px-3 py-2 font-semibold">Trial days</th>
                <th className="px-3 py-2 font-semibold">Workspace limit</th>
                <th className="px-3 py-2 font-semibold">Regional prices</th>
              </tr>
            </thead>
            <tbody>
              {commercial.plans.map((plan) => (
                <tr key={plan.id} className="border-b border-slate-100 last:border-b-0">
                  <td className="px-3 py-2 font-medium text-slate-900">
                    <div>{plan.name}</div>
                    <div className="text-xs text-slate-500">{plan.id}</div>
                  </td>
                  <td className="px-3 py-2">{plan.trialEnabled ? 'Enabled' : 'Disabled'}</td>
                  <td className="px-3 py-2">{plan.trialDurationDays ?? commercial.trialDefaults.trialDurationDays}</td>
                  <td className="px-3 py-2">{plan.workspaceLimit === 999 ? 'Unlimited' : plan.workspaceLimit}</td>
                  <td className="px-3 py-2">
                    <div className="space-y-1">
                      {plan.regions.map((region) => (
                        <div key={`${plan.id}-${region.country}`} className="text-xs text-slate-600">
                          {region.country}: {region.currency} monthly {region.monthly.amount} · annual {region.annual.amount}{typeof region.annualDiscountPercent === 'number' ? ` · save ${region.annualDiscountPercent}%` : ''}
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-700">
        <h2 className="text-lg font-semibold text-slate-900">Feature entitlements by plan</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {commercial.plans.map((plan) => (
            <div key={plan.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">{plan.name}</p>
              <p className="mt-1 text-xs text-slate-500">Plan ID: {plan.id}</p>
              <p className="mt-1 text-xs text-slate-500">Workspace limit: {plan.workspaceLimit === 999 ? 'Unlimited' : plan.workspaceLimit}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {plan.featureEntitlements.map((feature) => (
                  <span key={`${plan.id}-${feature}`} className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700">
                    {feature}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <BillingSubscriptionsClient />
    </div>
  );
}
