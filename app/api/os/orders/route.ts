import { NextRequest, NextResponse } from 'next/server';
import { updateOrderStatus } from '@/modules/orders';
import { requireOrdersWorkspaceMutation } from '@/modules/orders';

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return badRequest('Invalid JSON body');

  const workspaceId = String((body as { workspaceId?: unknown }).workspaceId || '').trim();
  const subscriptionId = String((body as { subscriptionId?: unknown }).subscriptionId || '').trim() || undefined;
  const idRaw = (body as { id?: unknown }).id;
  const statusRaw = (body as { status?: unknown }).status;

  const id = Number(idRaw);
  const status = String(statusRaw || '').trim();
  if (!workspaceId) return badRequest('workspaceId is required');
  if (!Number.isFinite(id) || id <= 0) return badRequest('id must be a positive number');
  if (!status) return badRequest('status is required');

  const access = await requireOrdersWorkspaceMutation({ workspaceId, subscriptionId });
  if ('error' in access) return access.error;

  const result = await updateOrderStatus({
    id,
    status,
    token: access.session.token,
    actorEmail: access.session.user?.user_email ?? 'unknown',
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json({
    workspaceId,
    order: result.data,
  });
}
