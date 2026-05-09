'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getConfig } from '@/src/config/client';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const config = getConfig();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
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
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to send reset email');
        setLoading(false);
        return;
      }
      setSubmitted(true);
    } catch (err) {
      console.error('Error:', err);
      setError('Connection failed. Please try again.');
      setLoading(false);
    }
  }

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Back button */}
        <div className="mb-6">
          <Link href="/login" className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-2">
            ← Back to Sign In
          </Link>
        </div>

        <div className="backdrop-blur-2xl bg-white/10 rounded-3xl shadow-2xl border border-white/20 p-8">
          <h2 className="text-2xl font-bold text-white mb-2">Reset Your Password</h2>
          <p className="text-gray-300 text-sm mb-8">Enter your email address and we'll send you a link to reset your password.</p>

          {submitted ? (
            <div className="text-center">
              <div className="mb-4 p-3 bg-green-500/20 backdrop-blur-xl border border-green-400/30 rounded-2xl text-green-200 text-sm">
                ✓ Check your email for password reset instructions
              </div>
              <p className="text-gray-400 text-sm mb-6">If you don't see the email, check your spam folder.</p>
              <Link href="/login" className="text-blue-400 hover:text-blue-300 text-sm font-medium">
                Return to Sign In
              </Link>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-6 p-4 bg-red-500/20 backdrop-blur-xl border border-red-400/30 rounded-2xl text-red-200 text-sm font-medium">
                  <div className="flex items-start gap-3">
                    <span>⚠️</span>
                    <span>{error}</span>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-white/90 mb-2">Email Address</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    className="w-full h-12 px-4 rounded-xl backdrop-blur-xl bg-white/10 border border-white/20 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all text-white placeholder-gray-400/60 disabled:opacity-50"
                    placeholder="your@email.com"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  style={{ backgroundColor: config.clientPrimaryColor }}
                  className="w-full h-12 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-blue-500/50 transition-all disabled:opacity-60 disabled:cursor-not-allowed mt-6 transform hover:scale-[1.02] active:scale-95"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Sending...
                    </span>
                  ) : (
                    'Send Reset Link'
                  )}
                </button>
              </form>
            </>
          )}

          <div className="mt-6 pt-6 border-t border-white/10">
            <p className="text-xs text-gray-400 text-center">
              Don't have an account? <br /> Contact your administrator
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
