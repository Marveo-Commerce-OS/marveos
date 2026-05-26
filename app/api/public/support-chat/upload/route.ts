import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { appendAuditLog } from '@/lib/adminStore';
import { enforceRateLimit } from '@/lib/security/requestGuards';
import { resolveCorsHeaders } from '../_cors';

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

function badRequest(req: NextRequest, message: string) {
  return NextResponse.json({ error: message }, { status: 400, headers: resolveCorsHeaders(req) });
}

function normalizeEmail(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function toSafeFilename(name: string): string {
  const raw = String(name || 'upload').trim();
  const sanitized = raw.replace(/[^\w.\-]+/g, '-');
  return sanitized.length ? sanitized : 'upload';
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: resolveCorsHeaders(req) });
}

export async function POST(req: NextRequest) {
  const limited = enforceRateLimit(req, 'public:support-chat:upload');
  if (limited) {
    const headers = resolveCorsHeaders(req);
    for (const [k, v] of Object.entries(headers)) limited.headers.set(k, v);
    return limited;
  }

  const formData = await req.formData();
  const file = formData.get('file');
  const email = normalizeEmail(formData.get('email'));

  if (!(file instanceof File)) return badRequest(req, 'Missing file.');
  if (!email) return badRequest(req, 'email is required.');
  if (!ALLOWED_MIME_TYPES.has(file.type || '')) {
    return badRequest(req, 'Unsupported file type. Allowed: JPG, PNG, WEBP, PDF.');
  }
  if (file.size > MAX_FILE_BYTES) {
    return badRequest(req, 'File too large. Max size is 5MB.');
  }

  const token = (process.env.BLOB_READ_WRITE_TOKEN || '').trim();
  if (!token) {
    return NextResponse.json({ error: 'Upload storage is not configured.' }, { status: 500, headers: resolveCorsHeaders(req) });
  }

  try {
    const key = `live-chat/${Date.now()}-${toSafeFilename(file.name)}`;
    const result = await put(key, file, {
      access: 'private',
      contentType: file.type || 'application/octet-stream',
      token,
    });

    const sourceUrl = `/api/media/file/${encodeURIComponent(result.pathname)}`;

    await appendAuditLog({
      actorEmail: email,
      action: 'live-chat.public.uploaded',
      target: `live_upload:${result.pathname}`,
      details: `size=${file.size};type=${file.type || 'unknown'}`,
    });

    return NextResponse.json({
      ok: true,
      attachment: {
        id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: file.name,
        url: sourceUrl,
        size: file.size,
        contentType: file.type || 'application/octet-stream',
        uploadedAt: new Date().toISOString(),
      },
    }, { headers: resolveCorsHeaders(req) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed.';
    return NextResponse.json({ error: message }, { status: 500, headers: resolveCorsHeaders(req) });
  }
}
