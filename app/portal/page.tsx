'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getConfig } from '@/src/config/client';

export default function PortalPage() {
  const router = useRouter();
  const config = getConfig();
  const [showComingSoon, setShowComingSoon] = useState(false);
  const workspaceSections = useMemo(
    () => [
      'Dashboard',
      'My Setup',
      'Launch Progress',
      'Website Setup',
      'Website Pages',
      'Products and Services',
      'Media',
      'Settings',
      'Support',
      'Grant Support Access',
    ],
    [],
  );

  return (
    <div className="min-h-screen bg-white flex flex-col">

      {/* Top bar */}
      <header className="w-full px-8 py-5 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div 
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: config.clientPrimaryColor }}
          >
            <span className="text-white text-xs font-bold">
              {(config.clientName || config.appName)[0].toUpperCase()}
            </span>
          </div>
          <span className="text-gray-900 font-bold text-lg font-['Space_Grotesk']">
            {config.clientName || config.appName}
          </span>
        </div>
        <button
          onClick={async () => {
            await fetch('/api/auth/logout', { method: 'POST' });
            router.push('/login');
          }}
          className="text-sm text-gray-400 hover:text-gray-600 transition-colors font-['Space_Grotesk']"
        >
          Sign out
        </button>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16">

        <div className="text-center mb-12">
          <p className="text-xs font-semibold uppercase tracking-widest mb-3 font-['Space_Grotesk']" style={{ color: config.clientPrimaryColor }}>
            Client Workspace
          </p>
          <h1 className="text-4xl font-bold text-gray-900 font-['Space_Grotesk']">
            Your Marveo workspace
          </h1>
          <p className="text-gray-400 mt-3 text-base font-['Space_Grotesk']">
            Manage your storefront content and launch readiness from a client-safe workspace surface.
          </p>
        </div>

        <div className="w-full max-w-3xl rounded-3xl border border-gray-100 bg-white p-8 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900 font-['Space_Grotesk']">Workspace areas</h2>
          <p className="mt-2 text-sm text-gray-500 font-['Space_Grotesk']">
            Client modules are being rolled into this surface. Internal operations tools remain in the Master Platform.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {workspaceSections.map((section) => (
              <div key={section} className="rounded-2xl border border-gray-100 px-4 py-3 text-sm font-medium text-gray-700 font-['Space_Grotesk']">
                {section}
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setShowComingSoon(true)}
              className="rounded-full px-4 py-2 text-sm font-semibold text-white font-['Space_Grotesk']"
              style={{ backgroundColor: config.clientPrimaryColor }}
            >
              Open workspace modules
            </button>
            <button
              type="button"
              onClick={() => setShowComingSoon(true)}
              className="rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 font-['Space_Grotesk']"
            >
              Contact support
            </button>
          </div>
        </div>

        {/* Coming soon toast */}
        {showComingSoon && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-gray-900 text-white px-6 py-4 rounded-2xl shadow-2xl text-sm font-['Space_Grotesk'] animate-in fade-in slide-in-from-bottom-4 duration-300">
            <svg className="w-5 h-5 text-amber-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
            </svg>
            <span>Client workspace modules are being finalized in this surface.</span>
            <button onClick={() => setShowComingSoon(false)} className="ml-2 text-gray-400 hover:text-white transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="px-8 py-5 border-t border-gray-100 text-center">
        <p className="text-xs text-gray-500/50 font-['Space_Grotesk']">{config.appName} · {config.brandByline}</p>
      </footer>

    </div>
  );
}
