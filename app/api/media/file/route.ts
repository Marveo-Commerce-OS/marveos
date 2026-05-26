import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const pathname = String(searchParams.get('pathname') || '').trim();

  if (!pathname) {
    return NextResponse.json({ error: 'pathname is required' }, { status: 400 });
  }

  return NextResponse.redirect(new URL(`/api/media/file/${encodeURIComponent(pathname)}`, req.url));
}

