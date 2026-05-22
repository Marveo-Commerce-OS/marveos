import { NextRequest, NextResponse } from 'next/server';
import { getSession, isAdmin, isSuperAdmin } from '@/lib/auth';
import { readAdminStore, updateAdminStore } from '@/lib/adminStore';

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

function forbidden() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

async function ensureAdminSession() {
  const session = await getSession();
  if (!session) return { error: unauthorized() };

  const admin = await isAdmin(session.token);
  if (!admin) return { error: forbidden() };

  return { session };
}

export async function GET() {
  const store = await readAdminStore();
  return NextResponse.json({
    lookups: store.cloud.lookups,
  });
}

export async function PUT(req: NextRequest) {
  const auth = await ensureAdminSession();
  if ('error' in auth) return auth.error;

  const superAdmin = await isSuperAdmin(auth.session.token);
  if (!superAdmin) return forbidden();

  const body = await req.json();

  const businessTypes = Array.isArray(body?.businessTypes)
    ? body.businessTypes.map((item: unknown) => String(item).trim()).filter(Boolean)
    : null;

  const businessModels = Array.isArray(body?.businessModels)
    ? body.businessModels.map((item: unknown) => String(item).trim()).filter(Boolean)
    : null;

  const countries = Array.isArray(body?.countries)
    ? body.countries
        .map((item: unknown) => {
          const row = item as { code?: unknown; name?: unknown };
          return {
            code: String(row?.code ?? '').trim().toUpperCase(),
            name: String(row?.name ?? '').trim(),
          };
        })
        .filter((item: { code: string; name: string }) => item.code.length > 0 && item.name.length > 0)
    : null;

  if (!businessTypes && !businessModels && !countries) {
    return badRequest('At least one of businessTypes, businessModels, or countries must be provided.');
  }

  const next = await updateAdminStore((current) => ({
    ...current,
    cloud: {
      ...current.cloud,
      lookups: {
        ...current.cloud.lookups,
        ...(businessTypes ? { businessTypes } : {}),
        ...(businessModels ? { businessModels } : {}),
        ...(countries ? { countries } : {}),
      },
    },
  }));

  return NextResponse.json({
    success: true,
    lookups: next.cloud.lookups,
  });
}

export { PUT as POST };
