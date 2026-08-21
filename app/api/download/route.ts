import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Without this allowlist the route would be an open proxy anyone could point
// at internal or arbitrary hosts.
const ALLOWED_HOSTS = new Set(['video.twimg.com']);

function safeFilename(raw: string | null): string {
  const fallback = 'xtract-video.mp4';
  if (!raw) return fallback;
  const cleaned = raw.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 120);
  return cleaned.endsWith('.mp4') ? cleaned : `${cleaned || 'xtract-video'}.mp4`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const src = searchParams.get('src');

  if (!src) {
    return NextResponse.json({ error: 'missing_src' }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(src);
  } catch {
    return NextResponse.json({ error: 'invalid_src' }, { status: 400 });
  }

  if (target.protocol !== 'https:' || !ALLOWED_HOSTS.has(target.hostname)) {
    return NextResponse.json({ error: 'forbidden_host' }, { status: 400 });
  }

  // Forward Range so the client can genuinely resume a paused transfer.
  const range = request.headers.get('range');
  const upstream = await fetch(target.toString(), {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      ...(range ? { Range: range } : {}),
    },
    cache: 'no-store',
  });

  if (!upstream.ok && upstream.status !== 206) {
    return NextResponse.json({ error: 'upstream_failed' }, { status: 502 });
  }

  const headers = new Headers();
  headers.set('Content-Type', upstream.headers.get('content-type') ?? 'video/mp4');
  headers.set(
    'Content-Disposition',
    `attachment; filename="${safeFilename(searchParams.get('filename'))}"`
  );
  for (const key of ['content-length', 'content-range', 'accept-ranges'] as const) {
    const value = upstream.headers.get(key);
    if (value) headers.set(key, value);
  }

  // Stream straight through rather than buffering the whole file server-side.
  return new NextResponse(upstream.body, { status: upstream.status, headers });
}
