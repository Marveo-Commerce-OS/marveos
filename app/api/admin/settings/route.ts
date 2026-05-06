import { NextRequest, NextResponse } from 'next/server';
import { getSession, getCurrentWpUser, isSuperAdmin } from '@/lib/auth';
import { ADMIN_MODULE_KEYS, appendAuditLog, readAdminStore, updateAdminStore } from '@/lib/adminStore';

const WP_API_URL = process.env.NEXT_PUBLIC_WP_API_URL || 'https://central.prag.global/wp-json';

interface FormPayload {
  formKey?: unknown;
  formName?: unknown;
  fromEmail?: unknown;
  senderName?: unknown;
  recipients?: unknown;
}

interface RoleModuleVisibilityPayload {
  [role: string]: Partial<Record<(typeof ADMIN_MODULE_KEYS)[number], boolean>>;
}

async function discoverForms() {
  try {
    const res = await fetch(WP_API_URL, { cache: 'no-store' });
    if (!res.ok) return [];
    const root = await res.json();
    const routes = Object.keys(root?.routes ?? {}) as string[];

    const known = routes
      .filter((route) => route.includes('distributor') || route.includes('contact') || route.includes('checkout'))
      .slice(0, 20)
      .map((route) => ({
        formKey: route.replace(/[^a-z0-9]+/gi, '-').toLowerCase(),
        formName: route,
      }));

    return known;
  } catch {
    return [];
  }
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ok = await isSuperAdmin(session.token);
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const discovered = await discoverForms();
  const mergeForms = (current: Awaited<ReturnType<typeof readAdminStore>>) => {
    if (discovered.length === 0) return current;

    const existingKeys = new Set(current.forms.map((f) => f.formKey));
    const mergedForms = [...current.forms];
    for (const form of discovered) {
      if (existingKeys.has(form.formKey)) continue;
      mergedForms.push({
        formKey: form.formKey,
        formName: form.formName,
        fromEmail: '',
        senderName: '',
        recipients: [],
      });
    }

    return {
      ...current,
      forms: mergedForms,
    };
  };

  let store;
  try {
    store = await updateAdminStore(mergeForms);
  } catch {
    // Read-only fallback for environments where writes are unavailable.
    store = mergeForms(await readAdminStore());
  }

  return NextResponse.json({
    tracking: store.tracking,
    smtp: store.smtp,
    forms: store.forms,
    accessControl: {
      roleModuleVisibility: store.roleModuleVisibility,
    },
  });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ok = await isSuperAdmin(session.token);
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const actor = await getCurrentWpUser(session.token);
  const body = await req.json();

  const incomingRoleModuleVisibility = body?.accessControl?.roleModuleVisibility as RoleModuleVisibilityPayload | undefined;
  const sanitizedRoleModuleVisibility = incomingRoleModuleVisibility
    ? Object.fromEntries(
        Object.entries(incomingRoleModuleVisibility).map(([role, modules]) => [
          String(role),
          Object.fromEntries(
            ADMIN_MODULE_KEYS.map((key) => [key, Boolean(modules?.[key])]),
          ),
        ]),
      )
    : undefined;

  try {
    const next = await updateAdminStore((current) => ({
      ...current,
      tracking: {
        ...current.tracking,
        ...(body.tracking ?? {}),
      },
      smtp: {
        ...current.smtp,
        ...(body.smtp ?? {}),
      },
      forms: Array.isArray(body.forms)
        ? (body.forms as FormPayload[]).map((f) => ({
            formKey: String(f.formKey ?? ''),
            formName: String(f.formName ?? ''),
            fromEmail: String(f.fromEmail ?? ''),
            senderName: String(f.senderName ?? ''),
            recipients: Array.isArray(f.recipients) ? f.recipients.map((r: unknown) => String(r).trim()).filter(Boolean) : [],
          }))
        : current.forms,
      roleModuleVisibility: sanitizedRoleModuleVisibility ?? current.roleModuleVisibility,
    }));

    await appendAuditLog({
      actorEmail: actor?.email ?? session.user?.user_email ?? 'unknown',
      action: 'settings.updated',
      target: 'ecommerce-admin-settings',
      details: 'Updated tracking, SMTP, forms routing, or backend access settings.',
    });

    return NextResponse.json({
      success: true,
      tracking: next.tracking,
      smtp: next.smtp,
      forms: next.forms,
      accessControl: {
        roleModuleVisibility: next.roleModuleVisibility,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to persist admin settings.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
