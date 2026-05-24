import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { readAdminStore, updateAdminStore } from '@/lib/adminStore';
import { getConfig } from '@/src/config/client';

function getWpApiUrl(): string {
  const config = getConfig();
  return config.wordpressApiUrl || 'https://localhost/wp-json';
}

async function tryFetchWordPressProfile(token: string): Promise<{ name?: string; email?: string; avatarUrl?: string } | null> {
  if (!token) return null;
  try {
    const wpBase = `${getWpApiUrl()}/wp/v2`;
    const res = await fetch(`${wpBase}/users/me?context=edit`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const body = (await res.json().catch(() => null)) as {
      name?: unknown;
      email?: unknown;
      avatar_urls?: Record<string, unknown>;
    } | null;
    if (!body) return null;
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const avatarUrlCandidate = body.avatar_urls && typeof body.avatar_urls === 'object'
      ? Object.entries(body.avatar_urls as Record<string, unknown>)
          .sort(([a], [b]) => Number(b) - Number(a))[0]?.[1]
      : undefined;
    const avatarUrl = typeof avatarUrlCandidate === 'string' ? avatarUrlCandidate.trim() : '';
    return {
      name: name || undefined,
      email: email || undefined,
      avatarUrl: avatarUrl || undefined,
    };
  } catch {
    return null;
  }
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const fallbackName = session.user?.user_display_name ?? '';
  const fallbackEmail = session.user?.user_email ?? '';
  const userId = session.user?.id != null ? String(session.user.id) : undefined;

  let name = fallbackName;
  let email = fallbackEmail;
  let avatarUrl: string | undefined;

  if (session.authSource === 'native' && userId) {
    const store = await readAdminStore();
    const identity = store.nativeAuth.identities[userId];
    if (identity) {
      name = identity.name || name;
      email = identity.email || email;
      avatarUrl = identity.avatarUrl || undefined;
    }
  } else if (session.authSource === 'wordpress_bridge') {
    const wp = await tryFetchWordPressProfile(session.token);
    if (wp?.name) name = wp.name;
    if (wp?.email) email = wp.email;
    if (wp?.avatarUrl) avatarUrl = wp.avatarUrl;
  }

  return NextResponse.json({
    ok: true,
    user: {
      id: userId,
      displayName: name,
      email,
      avatarUrl,
      authSource: session.authSource,
      roles: Array.isArray(session.user?.roles) ? session.user?.roles : [],
      requirePasswordChange: Boolean((session.user as { requirePasswordChange?: boolean } | null)?.requirePasswordChange),
    },
  });
}

function normalizeProfileName(value: unknown): string | null {
  const normalized = String(value || '').trim();
  if (!normalized) return null;
  return normalized;
}

function normalizeProfileEmail(value: unknown): string | null {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return null;
  return normalized;
}

function normalizeAvatarUrl(value: unknown): string | null {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  if (!/^https?:\/\//i.test(normalized) && !normalized.startsWith('/')) return null;
  return normalized;
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (session.authSource !== 'native') {
    return NextResponse.json({ error: 'Profile editing is only supported for native accounts.' }, { status: 400 });
  }

  const userId = session.user?.id != null ? String(session.user.id) : '';
  if (!userId) return NextResponse.json({ error: 'Invalid session user.' }, { status: 400 });

  const body = (await req.json().catch(() => null)) as {
    displayName?: unknown;
    email?: unknown;
    avatarUrl?: unknown;
  } | null;
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const displayName = normalizeProfileName(body.displayName);
  if (!displayName) return NextResponse.json({ error: 'displayName is required.' }, { status: 400 });

  const email = normalizeProfileEmail(body.email);
  if (!email) return NextResponse.json({ error: 'email is required and must be valid.' }, { status: 400 });

  const avatarUrl = normalizeAvatarUrl(body.avatarUrl);
  if (avatarUrl === null) {
    return NextResponse.json({ error: 'avatarUrl must be a valid URL.' }, { status: 400 });
  }

  const store = await readAdminStore();
  const identity = store.nativeAuth.identities[userId];
  if (!identity) return NextResponse.json({ error: 'Profile not found.' }, { status: 404 });

  const emailConflict = Object.values(store.nativeAuth.identities).some((row) =>
    row.id !== userId && row.email.trim().toLowerCase() === email,
  );
  if (emailConflict) {
    return NextResponse.json({ error: 'email is already in use by another account.' }, { status: 400 });
  }

  const updated = await updateAdminStore((current) => ({
    ...current,
    nativeAuth: {
      ...current.nativeAuth,
      identities: {
        ...current.nativeAuth.identities,
        [userId]: {
          ...current.nativeAuth.identities[userId],
          name: displayName,
          email,
          avatarUrl: avatarUrl || undefined,
          updatedAt: new Date().toISOString(),
        },
      },
    },
  }));

  const nextIdentity = updated.nativeAuth.identities[userId];

  return NextResponse.json({
    ok: true,
    user: {
      id: nextIdentity.id,
      displayName: nextIdentity.name,
      email: nextIdentity.email,
      avatarUrl: nextIdentity.avatarUrl,
      authSource: 'native',
      roles: Array.isArray(session.user?.roles) ? session.user?.roles : [],
      requirePasswordChange: false,
    },
  });
}
