import { NextRequest, NextResponse } from 'next/server';
import { getSession, isAdmin } from '@/lib/auth';
import { probeConnectorSite } from '@/lib/connectorProbe';

async function ensureAdminSession() {
  const session = await getSession();
  if (!session) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const admin = await isAdmin(session.token);
  if (!admin) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { session };
}

// POST /api/cloud/connector/preflight
// Body: { domain: string }
// Non-persistent connector check for onboarding preflight.
export async function POST(req: NextRequest) {
  const auth = await ensureAdminSession();
  if ('error' in auth) return auth.error;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const domain = String(body?.domain || '').trim();
  if (!domain) {
    return NextResponse.json({ error: 'domain is required' }, { status: 400 });
  }

  const result = await probeConnectorSite(domain);
  if (!result.ok) {
    return NextResponse.json(
      {
        verified: false,
        connectorStatus: result.connectorStatus || 'FAILED',
        error: result.verificationError || 'Connector preflight failed.',
        siteOrigin: result.siteOrigin || null,
      },
      { status: 200 },
    );
  }

  return NextResponse.json({
    verified: true,
    connectorStatus: 'CONNECTED',
    siteOrigin: result.siteOrigin,
    siteMetadata: result.metadata,
  });
}
