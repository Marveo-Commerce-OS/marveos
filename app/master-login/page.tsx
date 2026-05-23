'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { getConfig } from '@/src/config/client';

function MasterLoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const config = getConfig();
  const demoMode = process.env.NEXT_PUBLIC_MARVEO_DEMO_MODE === 'true';
  const demoUsername = process.env.NEXT_PUBLIC_MARVEO_DEMO_USERNAME || 'demo-admin';
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  const debugParams = useMemo(() => {
    if (process.env.NODE_ENV === 'production') return null;
    return {
      from: searchParams.get('from') || 'n/a',
      reason: searchParams.get('error') || 'n/a',
      roles: searchParams.get('roles') || 'n/a',
    };
  }, [searchParams]);

  useEffect(() => {
    setMounted(true);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, loginSurface: 'master' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Invalid credentials');
        setLoading(false);
        return;
      }
      router.push(data.redirect || '/master');
    } catch {
      setError('Connection failed. Please check your internet and try again.');
      setLoading(false);
    }
  }

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-300 font-semibold">Marveo Internal</p>
          <h1 className="mt-2 text-3xl font-bold text-white">Marveo Control Center Login</h1>
          <p className="mt-2 text-sm text-slate-300">For internal operations team access to the Master Platform.</p>
        </div>

        <div className="rounded-2xl border border-white/20 bg-white/10 p-6 backdrop-blur-xl">
          {demoMode && (
            <div className="mb-4 rounded-xl border border-emerald-300/40 bg-emerald-500/15 p-3 text-xs text-emerald-100">
              Demo mode enabled. Username: {demoUsername}
            </div>
          )}

          {debugParams && (debugParams.reason !== 'n/a' || debugParams.from !== 'n/a') && (
            <div className="mb-4 rounded-xl border border-amber-300/40 bg-amber-500/15 p-3 text-xs text-amber-100">
              <p className="font-semibold">Dev debug</p>
              <p>from: {debugParams.from}</p>
              <p>reason: {debugParams.reason}</p>
              <p>roles: {debugParams.roles}</p>
            </div>
          )}

          {error && (
            <div className="mb-4 rounded-xl border border-red-300/40 bg-red-500/15 p-3 text-sm text-red-100">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-semibold text-white">Username or Email</label>
              <input
                type="text"
                required
                value={form.username}
                onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
                disabled={loading}
                className="h-11 w-full rounded-xl border border-white/20 bg-white/10 px-3 text-white placeholder:text-slate-400"
                placeholder="internal username"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-white">Password</label>
              <input
                type="password"
                required
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                disabled={loading}
                className="h-11 w-full rounded-xl border border-white/20 bg-white/10 px-3 text-white placeholder:text-slate-400"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="h-11 w-full rounded-xl text-sm font-semibold text-white"
              style={{ backgroundColor: config.clientPrimaryColor }}
            >
              {loading ? 'Verifying...' : 'Sign in to Master Platform'}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-slate-300">
            Client user? Use <Link href="/login" className="font-semibold text-white underline">portal login</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function MasterLoginPage() {
  return (
    <Suspense fallback={null}>
      <MasterLoginPageContent />
    </Suspense>
  );
}
