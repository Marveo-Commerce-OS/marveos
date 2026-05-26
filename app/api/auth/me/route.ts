import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { readAdminStore, updateAdminStore } from '@/lib/adminStore';
import { getConfig } from '@/src/config/client';
import { normalizeStoredMediaUrl } from '@/lib/mediaUrls';
import { normalizeTicketSignature, resolveTicketSignature } from '@/lib/tickets/signature';

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
  const sessionRoles = Array.isArray(session.user?.roles) ? session.user.roles.map((role) => String(role).trim().toUpperCase()) : [];

  let name = fallbackName;
  let email = fallbackEmail;
  let avatarUrl: string | undefined;
  let role = sessionRoles[0] || '';
  let signature = '';

  if (session.authSource === 'native' && userId) {
    const store = await readAdminStore();
    const identity = store.nativeAuth.identities[userId];
    if (identity) {
      name = identity.name || name;
      email = identity.email || email;
      avatarUrl = identity.avatarUrl || undefined;
      role = String(store.users[userId]?.masterRole || identity.roles[0] || role || '').trim().toUpperCase();
      signature = resolveTicketSignature({
        storedSignature: store.users[userId]?.ticketSignature || '',
        displayName: name,
        role,
      });
    }
  } else if (session.authSource === 'wordpress_bridge') {
    const wp = await tryFetchWordPressProfile(session.token);
    if (wp?.name) name = wp.name;
    if (wp?.email) email = wp.email;
    if (wp?.avatarUrl) avatarUrl = wp.avatarUrl;
    signature = resolveTicketSignature({
      storedSignature: '',
      displayName: name,
      role,
    });
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
      role,
      ticketSignature: signature,
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
  const stored = normalizeStoredMediaUrl(normalized);
  if (stored === null) return null;
  return stored;
}

function normalizeProfileSignature(value: unknown): string {
  return normalizeTicketSignature(value);
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
    ticketSignature?: unknown;
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

  const ticketSignature = normalizeProfileSignature(body.ticketSignature);

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
    users: {
      ...current.users,
      [userId]: {
        ...(current.users[userId] ?? { active: true, portals: ['b2c'] }),
        ticketSignature,
      },
    },
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
  const nextRole = String(updated.users[userId]?.masterRole || nextIdentity.roles[0] || '').trim().toUpperCase();

  return NextResponse.json({
    ok: true,
    user: {
      id: nextIdentity.id,
      displayName: nextIdentity.name,
      email: nextIdentity.email,
      avatarUrl: nextIdentity.avatarUrl,
      authSource: 'native',
      roles: Array.isArray(session.user?.roles) ? session.user?.roles : [],
      role: nextRole,
      ticketSignature: resolveTicketSignature({
        storedSignature: updated.users[userId]?.ticketSignature || '',
        displayName: nextIdentity.name,
        role: nextRole,
      }),
      requirePasswordChange: false,
    },
  });
}
