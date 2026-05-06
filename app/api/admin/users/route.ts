import { NextRequest, NextResponse } from 'next/server';
import { getSession, getCurrentWpUser, isSuperAdmin } from '@/lib/auth';
import { appendAuditLog, readAdminStore, updateAdminStore } from '@/lib/adminStore';

const WP_API_URL = process.env.NEXT_PUBLIC_WP_API_URL || 'https://central.prag.global/wp-json';

const ROLE_OPTIONS = [
  'administrator',
  'shop_manager',
  'editor',
  'author',
  'contributor',
  'subscriber',
  'customer',
] as const;

interface WpUserRecord {
  id: number;
  name: string;
  slug: string;
  email: string;
  roles?: string[];
}

async function fetchAllWpUsers(token: string): Promise<WpUserRecord[]> {
  const users: WpUserRecord[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const wpRes = await fetch(`${WP_API_URL}/wp/v2/users?per_page=100&page=${page}&context=edit`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });

    if (!wpRes.ok) {
      throw new Error(String(wpRes.status));
    }

    const pageUsers = (await wpRes.json()) as WpUserRecord[];
    users.push(...pageUsers);

    const totalHeader = Number(wpRes.headers.get('X-WP-TotalPages') ?? '1');
    totalPages = Number.isFinite(totalHeader) && totalHeader > 0 ? totalHeader : 1;
    page += 1;
  }

  return users;
}

function sanitizeRole(role: string) {
  return ROLE_OPTIONS.includes(role as (typeof ROLE_OPTIONS)[number]) ? role : 'customer';
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ok = await isSuperAdmin(session.token);
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let wpUsers: WpUserRecord[] = [];
  try {
    wpUsers = await fetchAllWpUsers(session.token);
  } catch (error) {
    const status = Number((error as Error).message);
    return NextResponse.json({ error: 'Failed to fetch users from WordPress.' }, { status: Number.isFinite(status) ? status : 500 });
  }
  const store = await readAdminStore();

  const users = wpUsers.map((user) => {
    const state = store.users[String(user.id)] ?? { active: true, portals: ['b2c'] };
    return {
      id: user.id,
      name: user.name,
      username: user.slug,
      email: user.email,
      roles: Array.isArray(user.roles) ? user.roles : [],
      active: state.active,
      portals: state.portals,
    };
  });

  return NextResponse.json({
    users,
    roles: ROLE_OPTIONS,
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ok = await isSuperAdmin(session.token);
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const payload = {
    username: String(body.username ?? '').trim(),
    name: String(body.name ?? '').trim(),
    email: String(body.email ?? '').trim(),
    password: String(body.password ?? '').trim(),
    roles: [sanitizeRole(String(body.role ?? 'customer'))],
  };

  if (!payload.username || !payload.email || !payload.password) {
    return NextResponse.json({ error: 'username, email and password are required.' }, { status: 400 });
  }

  const wpRes = await fetch(`${WP_API_URL}/wp/v2/users`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!wpRes.ok) {
    const err = await wpRes.text();
    return NextResponse.json({ error: err || 'Failed to create user.' }, { status: wpRes.status });
  }

  const created = await wpRes.json();
  await updateAdminStore((current) => ({
    ...current,
    users: {
      ...current.users,
      [String(created.id)]: {
        active: true,
        portals: Array.isArray(body.portals) && body.portals.length > 0 ? body.portals : ['b2c'],
      },
    },
  }));

  const actor = await getCurrentWpUser(session.token);
  await appendAuditLog({
    actorEmail: actor?.email ?? session.user?.user_email ?? 'unknown',
    action: 'user.created',
    target: `user:${created.id}`,
    details: `Created ${created.email} with role ${payload.roles[0]}.`,
  });

  return NextResponse.json({ success: true, user: created });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ok = await isSuperAdmin(session.token);
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const userIds = Array.isArray(body.userIds)
    ? body.userIds.map((value: unknown) => Number(value)).filter((value: number) => Number.isFinite(value) && value > 0)
    : [];
  const singleUserId = Number(body.userId);
  const targetIds = userIds.length > 0
    ? Array.from(new Set(userIds))
    : (Number.isFinite(singleUserId) && singleUserId > 0 ? [singleUserId] : []);

  if (targetIds.length === 0) {
    return NextResponse.json({ error: 'Missing userId or userIds.' }, { status: 400 });
  }

  const nextPassword = typeof body.password === 'string' ? body.password.trim() : '';
  if (nextPassword && nextPassword.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
  }

  if ((typeof body.role === 'string' || Boolean(nextPassword)) && targetIds.length === 1) {
    const wpUpdatePayload: { roles?: string[]; password?: string } = {};
    if (typeof body.role === 'string') {
      wpUpdatePayload.roles = [sanitizeRole(body.role)];
    }
    if (nextPassword) {
      wpUpdatePayload.password = nextPassword;
    }

    const wpRes = await fetch(`${WP_API_URL}/wp/v2/users/${targetIds[0]}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(wpUpdatePayload),
    });

    if (!wpRes.ok) {
      const err = await wpRes.text();
      return NextResponse.json({ error: err || 'Failed to update user.' }, { status: wpRes.status });
    }
  }

  const updatedStore = await updateAdminStore((current) => {
    const users = { ...current.users };

    for (const userId of targetIds) {
      const existing = users[String(userId)] ?? { active: true, portals: ['b2c'] as ('b2c' | 'b2b')[] };
      const nextPortals = Array.isArray(body.portals)
        ? body.portals
            .filter((portal: unknown): portal is 'b2c' | 'b2b' => portal === 'b2c' || portal === 'b2b')
        : existing.portals;
      users[String(userId)] = {
        active: typeof body.active === 'boolean' ? body.active : existing.active,
        portals: nextPortals,
      };
    }

    return {
      ...current,
      users,
    };
  });

  const actor = await getCurrentWpUser(session.token);
  await appendAuditLog({
    actorEmail: actor?.email ?? session.user?.user_email ?? 'unknown',
    action: targetIds.length > 1 ? 'user.bulk.updated' : 'user.updated',
    target: targetIds.length > 1 ? `users:${targetIds.join(',')}` : `user:${targetIds[0]}`,
    details: `Updated access state. active=${typeof body.active === 'boolean' ? (body.active ? 'yes' : 'no') : 'unchanged'}. password=${nextPassword ? 'reset' : 'unchanged'}.`,
  });

  return NextResponse.json({
    success: true,
    updated: targetIds.map((id) => ({
      userId: id,
      active: updatedStore.users[String(id)]?.active ?? true,
      portals: updatedStore.users[String(id)]?.portals ?? ['b2c'],
    })),
  });
}
