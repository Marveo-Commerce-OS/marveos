import Link from 'next/link';

const steps = [
  'Download Connector Plugin (.zip) from the onboarding page.',
  'Log into WordPress Admin and upload the plugin from Plugins > Add New > Upload Plugin.',
  'Activate Marveo Connector.',
  'Generate a secure connection token in WordPress connector settings.',
  'Paste the Generated Secure Connection Token into Marveo onboarding.',
  'Save connector settings in WordPress.',
  'Return to onboarding and click Verify WordPress Connection.',
];

export default function ConnectorInstallationGuidePage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-4xl space-y-8">
        <header className="space-y-3">
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Marveo Docs</p>
          <h1 className="text-3xl font-bold">WordPress Connector Installation Guide</h1>
          <p className="text-slate-300">
            Use this guide for Existing Website onboarding when connecting a WordPress or WooCommerce site to Marveo.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-xl font-semibold">Recommended Setup Order</h2>
          <ol className="mt-4 list-decimal space-y-3 pl-5 text-slate-200">
            {steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-3">
          <h2 className="text-xl font-semibold">Troubleshooting</h2>
          <ul className="list-disc space-y-2 pl-5 text-slate-200">
            <li>Find the token in WordPress Admin → Marvéo Connector → Connection Token.</li>
            <li>Do not share the token publicly. It securely links your WordPress site to Marvéo.</li>
            <li>If verification fails, confirm the WordPress site is reachable from Marveo.</li>
            <li>Confirm the token in WordPress exactly matches the Generated Secure Connection Token pasted into onboarding.</li>
            <li>The submitted domain must match the verified site origin for verification to continue.</li>
            <li>Save settings in WordPress before clicking Verify WordPress Connection.</li>
            <li>If WordPress is not ready, use the guided Marvéo specialist setup option in onboarding.</li>
          </ul>
        </section>

        <div className="flex flex-wrap gap-3">
          <Link href="/setup/mvp" className="rounded-full bg-cyan-700 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-600">
            Back to Setup
          </Link>
          <a href="/plugin-packages/marveo-connector-1.0.16.zip" className="rounded-full bg-slate-700 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-600">
            Download Connector Plugin (.zip)
          </a>
        </div>
      </div>
    </main>
  );
}
