'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getConfig } from '@/src/config/client';

export default function PortalPage() {
  const router = useRouter();
  const config = getConfig();
  const [showComingSoon, setShowComingSoon] = useState(false);

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
            Operations Dashboard
          </p>
          <h1 className="text-4xl font-bold text-gray-900 font-['Space_Grotesk']">
            Where are you heading?
          </h1>
          <p className="text-gray-400 mt-3 text-base font-['Space_Grotesk']">
            Select the portal you want to manage today.
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-6 w-full max-w-2xl">

          {/* Main Portal Card */}
          <button
            onClick={() => router.push('/dashboard')}
            className="group flex-1 relative bg-white border-2 border-gray-100 rounded-3xl p-8 text-left transition-all duration-200 hover:shadow-xl hover:-translate-y-1"
            style={{
              borderColor: config.clientPrimaryColor,
            }}
          >
            <div 
              className="w-12 h-12 rounded-2xl flex items-center justify-center mb-6 transition-colors duration-200"
              style={{ 
                backgroundColor: `${config.clientPrimaryColor}15`,
              }}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ color: config.clientPrimaryColor }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            </div>

            <div className="mb-4">
              <h2 className="text-xl font-bold text-gray-900 font-['Space_Grotesk']">
                {config.clientName || 'Main Store'}
              </h2>
              <p className="text-gray-400 text-sm mt-2 font-['Space_Grotesk'] leading-relaxed">
                Manage products, orders, customers, content, and store settings from one place.
              </p>
            </div>

            <div className="flex items-center gap-2 text-sm font-semibold font-['Space_Grotesk'] group-hover:gap-3 transition-all" style={{ color: config.clientPrimaryColor }}>
              Enter dashboard
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </div>
          </button>

          {/* Coming Soon Card */}
          <button
            onClick={() => setShowComingSoon(true)}
            className="group flex-1 relative bg-white border-2 border-gray-100 hover:border-gray-300 rounded-3xl p-8 text-left transition-all duration-200 hover:shadow-lg hover:-translate-y-1"
          >
            <div className="w-12 h-12 bg-gray-50 group-hover:bg-gray-100 rounded-2xl flex items-center justify-center mb-6 transition-colors duration-200">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>

            <div className="mb-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full font-['Space_Grotesk']">Advanced</span>
                <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full font-['Space_Grotesk']">Coming Soon</span>
              </div>
              <h2 className="text-xl font-bold text-gray-900 font-['Space_Grotesk']">Multi-Location</h2>
              <p className="text-gray-400 text-sm mt-2 font-['Space_Grotesk'] leading-relaxed">
                Manage multiple branches, locations and sites from a centralized interface.
              </p>
            </div>

            <div className="flex items-center gap-2 text-gray-400 text-sm font-semibold font-['Space_Grotesk']">
              Coming soon
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
              </svg>
            </div>
          </button>
        </div>

        {/* Coming soon toast */}
        {showComingSoon && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-gray-900 text-white px-6 py-4 rounded-2xl shadow-2xl text-sm font-['Space_Grotesk'] animate-in fade-in slide-in-from-bottom-4 duration-300">
            <svg className="w-5 h-5 text-amber-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
            </svg>
            <span>Advanced features are under development. Check back soon.</span>
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
