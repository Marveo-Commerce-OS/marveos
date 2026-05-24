'use client';

import Link from 'next/link';
import { Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function PasswordChangeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const surface = searchParams.get('surface') === 'master' ? 'master' : 'portal';
  const firstLogin = searchParams.get('firstLogin') === '1';
  const nextPath = useMemo(() => {
    const requested = searchParams.get('next');
    if (requested && requested.startsWith('/')) return requested;
    return surface === 'master' ? '/master' : '/portal';
  }, [searchParams, surface]);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpRequested, setOtpRequested] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function requestOtp() {
    setSendingOtp(true);
    setError('');
    setNotice('');
    try {
      const res = await fetch('/api/auth/change-password/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ surface }),
      });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !body?.ok) throw new Error(body?.error || 'Failed to send verification code.');
      setOtpRequested(true);
      setNotice('Verification code sent to your email.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send verification code.');
    } finally {
      setSendingOtp(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');

    try {
      if (!otpRequested) {
        throw new Error('Request a verification code before updating your password.');
      }
      if (newPassword !== confirmPassword) {
        throw new Error('New password and confirmation do not match.');
      }
      if (otpCode.length !== 6) {
        throw new Error('Enter the 6-digit verification code sent to your email.');
      }

      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, otpCode }),
      });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !body?.ok) throw new Error(body?.error || 'Failed to change password.');

      setNotice('Password updated successfully. Redirecting...');
      setTimeout(() => router.push(nextPath), 600);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 px-4 py-10 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_14%,rgba(79,142,247,0.25),transparent_42%),radial-gradient(circle_at_80%_28%,rgba(30,64,175,0.16),transparent_45%)]" />
      <div className="pointer-events-none absolute inset-0 [background:linear-gradient(to_right,rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.08)_1px,transparent_1px)] [background-size:56px_56px]" />

      <div className="relative mx-auto max-w-xl rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
        <h1 className="font-[family-name:var(--font-sora)] text-3xl font-bold">
          {firstLogin ? 'Set Your Permanent Password' : 'Update Password'}
        </h1>
        <p className="mt-2 text-sm text-slate-300">
          {firstLogin
            ? `First login detected. Complete secure setup with OTP verification before continuing to ${surface === 'master' ? 'Control Center' : 'Portal'}.`
            : 'For security, password updates require your current password and a one-time verification code.'}
        </p>

        <div className="mt-5 rounded-2xl border border-blue-300/30 bg-blue-500/10 p-4 text-sm text-blue-100">
          <p className="font-semibold">Flow</p>
          <p className="mt-1">1) Request OTP  2) Enter current and new password  3) Confirm code and submit</p>
        </div>

        {error ? <div className="mt-4 rounded-2xl border border-red-300/30 bg-red-500/10 p-4 text-sm text-red-100">{error}</div> : null}
        {notice ? <div className="mt-4 rounded-2xl border border-emerald-300/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">{notice}</div> : null}

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Step 1: Request verification code</p>
              <p className="text-xs text-slate-400">The code expires in 10 minutes.</p>
            </div>
            <button
              type="button"
              onClick={requestOtp}
              disabled={sendingOtp || saving}
              className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {sendingOtp ? 'Sending...' : (otpRequested ? 'Resend OTP code' : 'Send OTP code')}
            </button>
          </div>
        </div>

        <form onSubmit={submit} className="mt-4 space-y-4">
          <label className="block text-sm text-slate-200">
            Current password
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-white"
              required
              disabled={saving}
            />
          </label>
          <label className="block text-sm text-slate-200">
            New password
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-white"
              minLength={8}
              required
              disabled={saving}
            />
          </label>
          <label className="block text-sm text-slate-200">
            Confirm new password
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-white"
              minLength={8}
              required
              disabled={saving}
            />
          </label>
          <label className="block text-sm text-slate-200">
            Verification code
            <input
              type="text"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D+/g, '').slice(0, 6))}
              className="mt-1 w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-white tracking-[0.3em]"
              inputMode="numeric"
              placeholder="123456"
              required
              disabled={saving}
            />
          </label>
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-full bg-white px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60"
          >
            {saving ? 'Updating...' : 'Update password'}
          </button>
        </form>

        {!firstLogin ? (
          <p className="mt-4 text-center text-xs text-slate-400">
            Return to <Link href={nextPath} className="underline">your workspace</Link>
          </p>
        ) : null}
      </div>
    </div>
  );
}

export default function PasswordChangePage() {
  return (
    <Suspense fallback={null}>
      <PasswordChangeContent />
    </Suspense>
  );
}