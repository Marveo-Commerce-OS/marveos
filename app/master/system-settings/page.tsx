export const dynamic = 'force-dynamic';

import { getControlCenterSnapshot } from '../_lib/controlCenter';
import { readAdminStore } from '@/lib/adminStore';

export default async function MasterSystemSettingsPage() {
  const snapshot = await getControlCenterSnapshot();
  const store = await readAdminStore();
  const commercial = store.cloud.commercial;
  const platformSettings = store.platformSettings;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">System Settings</h1>
        <p className="mt-2 text-sm text-slate-600">Internal Marveo platform configuration and operational controls.</p>
        <p className="mt-3 inline-flex rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
          Read-only operational view backed by persisted platform settings
        </p>
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
          <p className="mt-2 text-sm text-slate-700">Configuration mode: Read-only</p>
          <p className="mt-3 text-xs text-slate-500">Role access checks run on normalized Marveo-native roles.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">Platform-native operational settings</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Trial duration</p>
            <p className="mt-2 text-xl font-bold text-slate-900">{platformSettings.trialDurationDays} days</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pricing visibility</p>
            <p className="mt-2 text-xl font-bold text-slate-900">{platformSettings.pricingVisibility}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Regional pricing</p>
            <p className="mt-2 text-xl font-bold text-slate-900">{platformSettings.regionalPricingEnabled ? 'Enabled' : 'Disabled'}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payment provider</p>
            <p className="mt-2 text-xl font-bold text-slate-900">{platformSettings.paymentProvider.provider}</p>
            <p className="mt-1 text-xs text-slate-500">Mode: {platformSettings.paymentProvider.mode} · Configured: {platformSettings.paymentProvider.configured ? 'Yes' : 'No'}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Demo mode state</p>
            <p className="mt-2 text-xl font-bold text-slate-900">{platformSettings.demoMode.enabled ? 'Enabled' : 'Disabled'}</p>
            <p className="mt-1 text-xs text-slate-500">Operational mutations: {platformSettings.demoMode.allowOperationalMutations ? 'Allowed' : 'Blocked'}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Template publish rules</p>
            <p className="mt-2 text-sm text-slate-700">Artifact validation: {platformSettings.templatePublishRules.requireArtifactValidation ? 'Required' : 'Not required'}</p>
            <p className="mt-1 text-sm text-slate-700">Support approval: {platformSettings.templatePublishRules.requireSupportApproval ? 'Required' : 'Not required'}</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500">Settings are persisted in platform-native state. Editing UI remains intentionally read-only for this safety phase.</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">Commercial onboarding source-of-truth</h2>
        <p className="mt-2 text-sm text-slate-700">
          Plans, trial defaults, regional currencies, workspace limits, and feature entitlements are configured in Master backend state.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Plans</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{commercial.plans.length}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Country/Currency map</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{Object.keys(commercial.countryCurrencyMap).length}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Default trial days</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{commercial.trialDefaults.trialDurationDays}</p>
          </div>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Country to currency map</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(commercial.countryCurrencyMap).map(([country, currency]) => (
                <span key={`${country}-${currency}`} className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700">
                  {country}: {currency}
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Support defaults</p>
            <p className="mt-3 text-sm text-slate-700">
              Default priority: <span className="font-semibold">{platformSettings.supportDefaults.defaultPriority}</span>
            </p>
            <p className="mt-1 text-sm text-slate-700">
              Default setup type: <span className="font-semibold">{platformSettings.supportDefaults.defaultSetupType}</span>
            </p>
            <p className="mt-1 text-sm text-slate-700">
              Default assignee: <span className="font-semibold">{platformSettings.supportDefaults.defaultAssigneeId || 'Unassigned'}</span>
            </p>
          </div>
        </div>
        <p className="mt-4 text-xs text-slate-500">Commercial values shown here are real persisted platform records.</p>
      </div>
    </div>
  );
}
