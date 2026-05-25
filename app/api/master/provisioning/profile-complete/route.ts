import { NextRequest, NextResponse } from 'next/server';
import { requireMasterAccess } from '@/lib/permissions/access';
import { provisionAfterProfileCompletion } from '@/lib/provisioning';

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const access = await requireMasterAccess();
  if ('error' in access) return access.error;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return badRequest('Invalid JSON body');

  const onboardingSessionId = String((body as { onboardingSessionId?: unknown }).onboardingSessionId || '').trim();
  const workspaceId = String((body as { workspaceId?: unknown }).workspaceId || '').trim();
  const professionKey = String((body as { professionKey?: unknown }).professionKey || '').trim();
  const workspaceName = String((body as { workspaceName?: unknown }).workspaceName || '').trim();
  const allowProfessionOverride = Boolean((body as { allowProfessionOverride?: unknown }).allowProfessionOverride);
  const onboardingAnswers =
    (body as { onboardingAnswers?: unknown }).onboardingAnswers
    && typeof (body as { onboardingAnswers?: unknown }).onboardingAnswers === 'object'
    && !Array.isArray((body as { onboardingAnswers?: unknown }).onboardingAnswers)
      ? ((body as { onboardingAnswers?: unknown }).onboardingAnswers as Record<string, unknown>)
      : undefined;

  if (!onboardingSessionId && !workspaceId) return badRequest('onboardingSessionId or workspaceId is required');
  if (!workspaceName) return badRequest('workspaceName is required');

  const result = await provisionAfterProfileCompletion({
    onboardingSessionId: onboardingSessionId || undefined,
    workspaceId: workspaceId || undefined,
    professionKey: professionKey || undefined,
    workspaceName,
    onboardingAnswers,
    allowProfessionOverride,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.reason }, { status: 422 });
  }

  return NextResponse.json({ ok: true, result });
}
