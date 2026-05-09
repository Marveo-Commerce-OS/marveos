'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getConfig } from '@/src/config/client';

export default function LoginPage() {
  const router = useRouter();
  const config = getConfig();
  const demoMode = process.env.NEXT_PUBLIC_MARVEO_DEMO_MODE === 'true';
  const demoUsername = process.env.NEXT_PUBLIC_MARVEO_DEMO_USERNAME || 'demo-admin';
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

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
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Invalid credentials');
        setLoading(false);
        return;
      }
      router.push(data.redirect || '/portal');
    } catch (err) {
      console.error('Login error:', err);
      setError('Connection failed. Please check your internet and try again.');
      setLoading(false);
    }
  }

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo Section */}
        <div className="flex flex-col items-center mb-12">
          <div className="relative w-16 h-16 mb-6 rounded-2xl backdrop-blur-xl bg-white/10 border border-white/20 flex items-center justify-center shadow-2xl">
            {config.clientLogo ? (
              <Image 
                src={config.clientLogo} 
                alt={config.clientName} 
                width={48}
                height={48}
                className="object-contain" 
                priority 
              />
            ) : (
              <h1 className="text-2xl font-bold" style={{ color: config.clientPrimaryColor }}>
                {config.appName[0]}
              </h1>
            )}
          </div>
          <h1 className="text-3xl font-bold text-white text-center mb-2">{config.clientName}</h1>
          <p className="text-gray-400 text-sm text-center">{config.brandByline}</p>
        </div>

        {/* Login Card - Glassmorphism */}
        <div className="backdrop-blur-2xl bg-white/10 rounded-3xl shadow-2xl border border-white/20 p-8 hover:bg-white/[0.15] transition-all duration-300">
          <h2 className="text-2xl font-bold text-white mb-2">Operations Portal</h2>
          <p className="text-gray-300 text-sm mb-8">Secure access for authorized managers</p>

          {demoMode && (
            <div className="mb-6 p-4 bg-emerald-500/15 backdrop-blur-xl border border-emerald-300/30 rounded-2xl text-emerald-100 text-sm">
              <p className="font-semibold">Demo mode enabled</p>
              <p className="mt-1 text-xs">Username: {demoUsername}</p>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-red-500/20 backdrop-blur-xl border border-red-400/30 rounded-2xl text-red-200 text-sm font-medium animate-in fade-in">
              <div className="flex items-start gap-3">
                <span className="text-lg mt-0.5">⚠️</span>
                <span>{error}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-white/90 mb-2">Username or Email</label>
              <input
                type="text"
                required
                value={form.username}
                onChange={(e) => setForm(p => ({ ...p, username: e.target.value }))}
                disabled={loading}
                className="w-full h-12 px-4 rounded-xl backdrop-blur-xl bg-white/10 border border-white/20 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all text-white placeholder-gray-400/60 disabled:opacity-50"
                placeholder="your username"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-white/90 mb-2">Password</label>
              <input
                type="password"
                required
                value={form.password}
                onChange={(e) => setForm(p => ({ ...p, password: e.target.value }))}
                disabled={loading}
                className="w-full h-12 px-4 rounded-xl backdrop-blur-xl bg-white/10 border border-white/20 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all text-white placeholder-gray-400/60 disabled:opacity-50"
                placeholder="••••••••"
              />
              <div className="flex justify-end mt-2">
                <Link href="/login/forgot-password" className="text-xs text-gray-400 hover:text-gray-300 transition-colors">
                  Forgot password?
                </Link>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{ 
                backgroundColor: config.clientPrimaryColor,
              }}
              className="w-full h-12 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-blue-500/50 transition-all disabled:opacity-60 disabled:cursor-not-allowed mt-6 transform hover:scale-[1.02] active:scale-95"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Verifying...
                </span>
              ) : (
                'Sign In to Portal'
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-white/10">
            <p className="text-xs text-gray-400 text-center">
              Need help? Contact your administrator
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
