const TERMS_SECTIONS = [
  {
    title: 'Service Scope',
    body: 'Marveo provisions your workspace, baseline modules, and onboarding records based on the profile you submit. Final production readiness may still require connector validation, domain/DNS updates, and operator review inside Setup Center.',
  },
  {
    title: 'Data Responsibility',
    body: 'You confirm that the business profile, contact information, and operational settings you provide are accurate. Marveo uses this information to configure modules, notifications, and onboarding artifacts.',
  },
  {
    title: 'Security And Access',
    body: 'You are responsible for securing business email accounts, connector tokens, and login credentials. If access details are exposed or lost, rotate credentials immediately and contact support.',
  },
  {
    title: 'Operational Notifications',
    body: 'Marveo attempts to send onboarding and provisioning notifications to the business contact and configured operations recipients. Email delivery depends on valid SMTP/provider configuration and recipient availability.',
  },
  {
    title: 'Post-Onboarding Setup',
    body: 'Website connection and advanced launch tasks continue in OS > Setup Center after workspace creation. Acceptance of these terms confirms you understand that onboarding completion does not guarantee a public launch without final checks.',
  },
  {
    title: 'Support And Changes',
    body: 'Marveo may update onboarding procedures, terms text, and operational policies over time. Continued use of the setup flow indicates acceptance of the current version at the time of onboarding.',
  },
] as const;

export default function OnboardingTermsPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100 md:px-8">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Marveo Legal Draft</p>
        <h1 className="mt-2 text-3xl font-bold">Onboarding Terms</h1>
        <p className="mt-3 text-sm text-slate-300">
          Draft operational terms for onboarding. This page is intentionally editable and can be revised by legal or operations teams.
        </p>

        <div className="mt-6 space-y-4">
          {TERMS_SECTIONS.map((section) => (
            <section key={section.title} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
              <h2 className="text-lg font-semibold text-white">{section.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">{section.body}</p>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
