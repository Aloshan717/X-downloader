import { NextResponse } from 'next/server';
import { extractTweetId } from '@/lib/validate';
import { resolveTweet } from '@/lib/twitter.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATUS: Record<string, number> = {
  invalid_url: 400,
  no_video: 404,
  restricted: 403,
  not_found: 404,
  fetch_failed: 502,
};

export async function POST(request: Request) {
  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_url' }, { status: 400 });
  }

  const tweetId = extractTweetId(body.url ?? '');
  if (!tweetId) {
    return NextResponse.json({ error: 'invalid_url' }, { status: 400 });
  }

  const result = await resolveTweet(tweetId);
  if (!result.ok) {
    // diag carries no secrets, and this route is behind the password gate.
    return NextResponse.json(
      { error: result.error, diag: result.diag },
      { status: STATUS[result.error] ?? 502 }
    );
  }

  return NextResponse.json(result.data);
}
