'use client';

import { Suspense, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { getConfig } from '@/src/config/client';

type PublicBranding = {
  brandName: string;
  brandByline: string;
  primaryColor: string;
  portalLoginLogoUrl: string;
};

function MasterLoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const config = getConfig();
  const demoMode = process.env.NEXT_PUBLIC_MARVEO_DEMO_MODE === 'true';
  const demoUsername = process.env.NEXT_PUBLIC_MARVEO_DEMO_USERNAME || 'demo-admin';
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [branding, setBranding] = useState<PublicBranding>({
    brandName: config.clientName,
    brandByline: config.brandByline,
    primaryColor: config.clientPrimaryColor,
    portalLoginLogoUrl: config.clientLogo || '',
  });
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const debugParams = useMemo(() => {
    if (process.env.NODE_ENV === 'production') return null;
    return {
      from: searchParams.get('from') || 'n/a',
      reason: searchParams.get('error') || 'n/a',
      roles: searchParams.get('roles') || 'n/a',
    };
  }, [searchParams]);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/branding', { cache: 'no-store' });
        const body = (await res.json().catch(() => null)) as Partial<PublicBranding> | null;
        if (!res.ok || !body || cancelled) return;
        setBranding((prev) => ({
          brandName: body.brandName || prev.brandName,
          brandByline: body.brandByline || prev.brandByline,
          primaryColor: body.primaryColor || prev.primaryColor,
          portalLoginLogoUrl: body.portalLoginLogoUrl || prev.portalLoginLogoUrl,
        }));
      } catch {
        // ignore branding fetch failures and fall back to env config
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [config.brandByline, config.clientLogo, config.clientName, config.clientPrimaryColor]);

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
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_24%_18%,rgba(79,142,247,0.22),transparent_45%),radial-gradient(circle_at_82%_36%,rgba(30,64,175,0.14),transparent_42%)]" />
      <div className="pointer-events-none absolute inset-0 [background:linear-gradient(to_right,rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.08)_1px,transparent_1px)] [background-size:56px_56px]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-blue-500/10 to-transparent" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl items-center px-4 py-10 sm:px-8">
        <div className="grid w-full gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <section className="max-w-2xl space-y-6 text-center md:text-left">
            <div className="space-y-5">
              {branding.portalLoginLogoUrl ? (
                <div className="relative mx-auto h-16 w-48 sm:h-20 sm:w-60 md:mx-0">
                  <Image
                    src={branding.portalLoginLogoUrl}
                    alt={branding.brandName || 'Marveo'}
                    fill
                    className="object-contain object-center md:object-left"
                    priority
                    unoptimized
                  />
                </div>
              ) : null}
              <h1 className="font-[family-name:var(--font-sora)] bg-gradient-to-br from-blue-50 via-blue-200 to-blue-400 bg-clip-text text-5xl font-extrabold leading-[0.95] tracking-[-0.03em] text-transparent sm:text-6xl lg:text-7xl">
                One Workspace.
                <br />
                Every Operation.
              </h1>
              <p className="mx-auto max-w-xl text-base leading-7 text-slate-300 sm:text-lg md:mx-0">
                Access the Control Center to manage clients, deployments, and operations from one secure console.
              </p>
              <p className="mx-auto max-w-xl text-sm font-medium text-blue-200 md:mx-0">
                Commerce orchestration | Workflow automation | Global scale
              </p>
            </div>
          </section>

          <section className="relative lg:justify-self-end lg:w-full lg:max-w-md">
            <div className="pointer-events-none absolute -right-4 -top-6 hidden h-24 w-44 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl lg:block" />
            <div className="pointer-events-none absolute -left-6 bottom-10 hidden h-14 w-14 rounded-full bg-emerald-400/35 blur-xl lg:block" />
            <div className="relative rounded-3xl border border-white/15 bg-white/10 p-6 shadow-2xl backdrop-blur-2xl sm:p-8">
              <h2 className="font-[family-name:var(--font-sora)] text-2xl font-bold text-white">Master Platform Login</h2>
              <p className="mt-2 text-sm text-slate-300">Internal operations access for Control Center users.</p>

              {demoMode && (
                <div className="mt-4 rounded-2xl border border-emerald-300/40 bg-emerald-500/15 p-3 text-xs text-emerald-100">
                  Demo mode enabled. Username: {demoUsername}
                </div>
              )}

              {debugParams && (debugParams.reason !== 'n/a' || debugParams.from !== 'n/a') && (
                <div className="mt-4 rounded-2xl border border-amber-300/40 bg-amber-500/15 p-3 text-xs text-amber-100">
                  <p className="font-semibold">Dev debug</p>
                  <p>from: {debugParams.from}</p>
                  <p>reason: {debugParams.reason}</p>
                  <p>roles: {debugParams.roles}</p>
                </div>
              )}

              {error && (
                <div className="mt-4 rounded-2xl border border-red-300/40 bg-red-500/15 p-3 text-sm text-red-100">{error}</div>
              )}

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-white">Username or Email</label>
                  <input
                    type="text"
                    required
                    value={form.username}
                    onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
                    disabled={loading}
                    className="h-12 w-full rounded-xl border border-white/20 bg-white/10 px-4 text-white placeholder:text-slate-400"
                    placeholder="username/email address"
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
                    className="h-12 w-full rounded-xl border border-white/20 bg-white/10 px-4 text-white placeholder:text-slate-400"
                    placeholder="••••••••"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="h-12 w-full rounded-xl text-sm font-semibold text-white"
                  style={{ backgroundColor: branding.primaryColor }}
                >
                  {loading ? 'Verifying...' : 'Sign in to Master Platform'}
                </button>
              </form>

              <p className="mt-5 text-center text-xs text-slate-300">
                Client user? Use <Link href="/login" className="font-semibold text-white underline">portal login</Link>.
              </p>
            </div>
          </section>
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
