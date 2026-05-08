'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { getConfig } from '@/src/config/client';

export default function LoginPage() {
  const router = useRouter();
  const config = getConfig();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
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
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="relative w-48 h-16 mb-2">
            {config.clientLogo ? (
              <Image 
                src={config.clientLogo} 
                alt={config.clientName} 
                fill 
                className="object-contain" 
                priority 
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <h1 className="text-2xl font-bold" style={{ color: config.clientPrimaryColor }}>
                  {config.appName}
                </h1>
              </div>
            )}
          </div>
          <p className="text-gray-400/50 text-sm mt-1">{config.brandByline}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Sign in to {config.clientName}</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input
                type="text"
                required
                value={form.username}
                onChange={(e) => setForm(p => ({ ...p, username: e.target.value }))}
                className="w-full h-12 px-4 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all text-sm"
                placeholder="WordPress username"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                required
                value={form.password}
                onChange={(e) => setForm(p => ({ ...p, password: e.target.value }))}
                className="w-full h-12 px-4 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all text-sm"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-sky-700 text-white rounded-xl font-semibold hover:bg-sky-800 transition-colors disabled:opacity-60 mt-2"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Only administrators and shop managers can access this panel.
        </p>
      </div>
    </div>
  );
}
