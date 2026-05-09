import { NextRequest, NextResponse } from 'next/server';
import { getSession, getCurrentWpUser, isSuperAdmin } from '@/lib/auth';
import { ADMIN_MODULE_KEYS, appendAuditLog, readAdminStore, updateAdminStore } from '@/lib/adminStore';
import { getWordPressApiBase } from '@/src/lib/endpoints';

const WP_API_URL = getWordPressApiBase();

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

  const store = mergeForms(await readAdminStore());

  return NextResponse.json({
    tracking: store.tracking,
    smtp: store.smtp,
    forms: store.forms,
    maintenance: store.maintenance,
    module_access: store.roleModuleVisibility,
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

  // Accept role visibility from either `module_access` (frontend) or `accessControl.roleModuleVisibility` (legacy)
  const rawRoleVisibility = (body?.module_access ?? body?.accessControl?.roleModuleVisibility) as RoleModuleVisibilityPayload | undefined;
  const sanitizedRoleModuleVisibility = rawRoleVisibility
    ? Object.fromEntries(
        Object.entries(rawRoleVisibility).map(([role, modules]) => [
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
        useWordPressMailer: Boolean(body?.smtp?.useWordPressMailer ?? current.smtp.useWordPressMailer),
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
      maintenance: body.maintenance
        ? {
            site_under_construction: Boolean(body.maintenance.site_under_construction ?? current.maintenance.site_under_construction),
            under_construction_title: String(body.maintenance.under_construction_title ?? current.maintenance.under_construction_title),
            under_construction_message: String(body.maintenance.under_construction_message ?? current.maintenance.under_construction_message),
          }
        : current.maintenance,
    }));

    await appendAuditLog({
      actorEmail: actor?.email ?? session.user?.user_email ?? 'unknown',
      action: 'settings.updated',
      target: 'ecommerce-admin-settings',
      details: 'Updated tracking, SMTP, forms routing, backend access settings, or maintenance mode.',
    });

    return NextResponse.json({
      success: true,
      tracking: next.tracking,
      smtp: next.smtp,
      forms: next.forms,
      maintenance: next.maintenance,
      module_access: next.roleModuleVisibility,
      accessControl: {
        roleModuleVisibility: next.roleModuleVisibility,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to persist admin settings.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Frontend uses POST; alias it to PUT for compatibility
export { PUT as POST };
