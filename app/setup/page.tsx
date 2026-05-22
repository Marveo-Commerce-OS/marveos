import { redirect } from 'next/navigation';
import { getRuntimeDeploymentStatus } from '@/src/lib/deploymentStatus';

export default async function SetupStatusPage() {
  const status = await getRuntimeDeploymentStatus();
  const mvpOnboardingEnabled = process.env.NEXT_PUBLIC_ENABLE_MVP_ONBOARDING !== 'false';

  if (status.setup_completed && status.validation_passed) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-3xl rounded-3xl bg-white/90 backdrop-blur border border-slate-200 shadow-xl p-8 md:p-10">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">Deployment Setup</p>
        <h1 className="mt-3 text-3xl md:text-4xl font-bold text-slate-900">Complete the deployment profile before continuing</h1>
        <p className="mt-4 text-slate-600">
          Marvéo is blocking the dashboard until the selected deployment mode is saved and validated.
          Complete the WordPress plugin setup wizard, then return here.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-5">
            <p className="text-sm text-slate-500">Mode</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{status.mode}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-5">
            <p className="text-sm text-slate-500">Validation</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{status.validation_passed ? 'Passed' : 'Pending'}</p>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <p className="font-semibold text-amber-900">Missing requirements</p>
          {status.missing_requirements.length > 0 ? (
            <ul className="mt-3 space-y-2 text-sm text-amber-900 list-disc list-inside">
              {status.missing_requirements.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-amber-900">No missing requirements are currently reported.</p>
          )}
        </div>

        <div className={`mt-8 grid gap-3 ${mvpOnboardingEnabled ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
          <a
            href="/login"
            className="inline-flex items-center justify-center rounded-full px-5 py-3 bg-slate-900 text-white font-semibold hover:bg-slate-800 transition-colors"
          >
            Back to login
          </a>
          <a
            href="/setup/activate"
            className="inline-flex items-center justify-center rounded-full px-5 py-3 bg-slate-100 text-slate-900 font-semibold hover:bg-slate-200 transition-colors"
          >
            Open setup flow
          </a>
          {mvpOnboardingEnabled && (
            <a
              href="/setup/mvp"
              className="inline-flex items-center justify-center rounded-full px-5 py-3 bg-indigo-100 text-indigo-900 font-semibold hover:bg-indigo-200 transition-colors"
            >
              Open MVP onboarding
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
