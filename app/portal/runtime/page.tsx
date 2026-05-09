'use client';

import { MarveoProvider } from '@/components/MarveoProvider';
import { MarveoRenderer } from '@/components/MarveoRenderer';

export default function RuntimePortalPage() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 md:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Marveo Runtime</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Dynamic Component Rendering</h1>
          <p className="mt-2 text-slate-600">
            This view renders runtime-driven pages from connector APIs without hardcoded page layouts.
          </p>
        </header>

        <MarveoProvider>
          <MarveoRenderer slug="home" />
        </MarveoProvider>
      </div>
    </div>
  );
}
