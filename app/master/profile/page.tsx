'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect } from 'react';
import { useRef } from 'react';
import { useState } from 'react';

function toRoleLabel(raw: string): string {
  const normalized = String(raw || '').trim();
  if (!normalized) return '';
  return normalized
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function MasterProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [form, setForm] = useState({
    displayName: '',
    email: '',
    avatarUrl: '',
    role: '',
    ticketSignature: '',
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' });
        const body = (await res.json().catch(() => null)) as {
          ok?: boolean;
          user?: { displayName?: string; email?: string; avatarUrl?: string; role?: string; ticketSignature?: string };
        } | null;
        if (!res.ok || !body?.ok || !body.user || cancelled) return;
        setForm({
          displayName: body.user.displayName || '',
          email: body.user.email || '',
          avatarUrl: body.user.avatarUrl || '',
          role: body.user.role || '',
          ticketSignature: body.user.ticketSignature || '',
        });
      } catch {
        if (!cancelled) {
          setError('Failed to load profile details.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');

    try {
      const res = await fetch('/api/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: form.displayName,
          email: form.email,
          avatarUrl: form.avatarUrl,
          ticketSignature: form.ticketSignature,
        }),
      });
      const body = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        user?: { displayName?: string; email?: string; avatarUrl?: string; role?: string; ticketSignature?: string };
      } | null;
      if (!res.ok || !body?.ok || !body.user) throw new Error(body?.error || 'Failed to update profile.');

      setForm({
        displayName: body.user.displayName || '',
        email: body.user.email || '',
        avatarUrl: body.user.avatarUrl || '',
        role: body.user.role || '',
        ticketSignature: body.user.ticketSignature || '',
      });
      setNotice('Profile updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  }

  async function uploadAvatar(file: File) {
    setUploadingAvatar(true);
    setError('');
    setNotice('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/media/upload', {
        method: 'POST',
        body: formData,
      });

      const body = (await res.json().catch(() => null)) as { source_url?: string; error?: string } | null;
      if (!res.ok || !body?.source_url) {
        throw new Error(body?.error || 'Avatar upload failed.');
      }

      setForm((prev) => ({ ...prev, avatarUrl: body.source_url || '' }));
      setNotice('Avatar uploaded. Save profile to apply.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Avatar upload failed.');
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Profile</h1>
        <p className="mt-2 text-sm text-slate-600">Update your profile details and manage password security.</p>
      </div>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
      {notice ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{notice}</div> : null}

      <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
        <label className="block text-sm text-slate-700">
          Display name
          <input
            type="text"
            value={form.displayName}
            onChange={(e) => setForm((prev) => ({ ...prev, displayName: e.target.value }))}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
            required
            disabled={saving || loading}
          />
        </label>
        <label className="block text-sm text-slate-700">
          Email
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
            required
            disabled={saving || loading}
          />
        </label>
        <label className="block text-sm text-slate-700">
          Role
          <input
            type="text"
            value={toRoleLabel(form.role) || 'N/A'}
            readOnly
            className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2"
          />
        </label>
        <label className="block text-sm text-slate-700">
          Ticket signature
          <textarea
            value={form.ticketSignature}
            onChange={(e) => setForm((prev) => ({ ...prev, ticketSignature: e.target.value }))}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2"
            rows={4}
            disabled={saving || loading}
          />
          <p className="mt-1 text-xs text-slate-500">Automatically appended to outgoing ticket replies. Use multiple lines, for example: Best Regards, Name, Role.</p>
        </label>
        <label className="block text-sm text-slate-700">
          Avatar (optional)
          <div className="mt-2 flex flex-wrap items-center gap-4 rounded-xl border border-slate-300 bg-slate-50 p-3">
            <div className="relative h-14 w-14 overflow-hidden rounded-full bg-slate-200">
              {form.avatarUrl ? (
                <Image src={form.avatarUrl} alt="Profile avatar" fill className="object-cover" sizes="56px" unoptimized />
              ) : (
                <Image src="/images/avatar-placeholder.svg" alt="Avatar placeholder" fill className="object-cover" sizes="56px" />
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    void uploadAvatar(file);
                  }
                }}
                disabled={saving || loading || uploadingAvatar}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={saving || loading || uploadingAvatar}
                className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
              >
                {uploadingAvatar ? 'Uploading...' : 'Upload avatar'}
              </button>
              {form.avatarUrl ? (
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, avatarUrl: '' }))}
                  disabled={saving || loading || uploadingAvatar}
                  className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                >
                  Remove
                </button>
              ) : null}
            </div>
          </div>
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={saving || loading || uploadingAvatar}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save profile'}
          </button>
          <Link
            href="/password/change?surface=master&next=/master/profile"
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Change password (OTP required)
          </Link>
        </div>
      </form>
    </div>
  );
}

