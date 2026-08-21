import 'server-only';
import type { ResolvedTweet, ResolveError, VideoVariant } from './types';

// X's public syndication endpoint — the same unauthenticated API its own embed
// widgets use. No login or API key involved.
const SYNDICATION = 'https://cdn.syndication.twimg.com/tweet-result';

// The token the widget JS derives from the tweet id. Without it the endpoint 404s.
function syndicationToken(id: string): string {
  return ((Number(id) / 1e15) * Math.PI)
    .toString(36)
    .replace(/(0+|\.)/g, '');
}

// Variant URLs encode their dimensions in the path: /vid/avc1/1280x720/hash.mp4
function dimensionsFromUrl(url: string): { width: number; height: number } | null {
  const match = url.match(/\/(\d{2,5})x(\d{2,5})\//);
  if (!match) return null;
  return { width: Number(match[1]), height: Number(match[2]) };
}

function formatDuration(ms: number | undefined): string {
  if (!ms || !Number.isFinite(ms)) return '';
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

type SyndicationResponse = {
  __typename?: string;
  text?: string;
  created_at?: string;
  user?: { screen_name?: string; name?: string; profile_image_url_https?: string };
  mediaDetails?: Array<{
    type?: string;
    media_url_https?: string;
    video_info?: {
      duration_millis?: number;
      variants?: Array<{ bitrate?: number; content_type?: string; url?: string }>;
    };
  }>;
};

export async function resolveTweet(
  tweetId: string
): Promise<{ ok: true; data: ResolvedTweet } | { ok: false; error: ResolveError }> {
  const params = new URLSearchParams({
    id: tweetId,
    token: syndicationToken(tweetId),
    lang: 'en',
  });

  let res: Response;
  try {
    res = await fetch(`${SYNDICATION}?${params}`, {
      // A browser-like UA is required; the endpoint blocks unrecognised clients.
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        Accept: 'application/json',
      },
      cache: 'no-store',
    });
  } catch {
    return { ok: false, error: 'fetch_failed' };
  }

  if (res.status === 404) return { ok: false, error: 'not_found' };
  if (!res.ok) return { ok: false, error: 'fetch_failed' };

  let json: SyndicationResponse;
  try {
    json = (await res.json()) as SyndicationResponse;
  } catch {
    return { ok: false, error: 'fetch_failed' };
  }

  // Tombstoned/protected tweets come back without a user payload.
  if (!json || !json.user) return { ok: false, error: 'not_found' };

  const media = (json.mediaDetails ?? []).find(
    (m) => m.type === 'video' || m.type === 'animated_gif'
  );
  if (!media?.video_info?.variants?.length) {
    return { ok: false, error: 'no_video' };
  }

  const seen = new Set<number>();
  const variants: VideoVariant[] = media.video_info.variants
    .filter((v) => v.content_type === 'video/mp4' && v.url)
    .map((v) => {
      const dims = dimensionsFromUrl(v.url!);
      if (!dims) return null;
      return { ...dims, bitrate: v.bitrate ?? 0, url: v.url! };
    })
    .filter((v): v is VideoVariant => v !== null)
    // Dedupe by width, keeping the highest bitrate rendition of each size.
    .sort((a, b) => b.bitrate - a.bitrate)
    .filter((v) => {
      if (seen.has(v.width)) return false;
      seen.add(v.width);
      return true;
    })
    .sort((a, b) => a.width - b.width);

  if (!variants.length) return { ok: false, error: 'no_video' };

  return {
    ok: true,
    data: {
      tweetId,
      author: {
        handle: json.user.screen_name ?? 'unknown',
        name: json.user.name ?? '',
        avatarUrl: json.user.profile_image_url_https ?? '',
      },
      postedAt: json.created_at ?? '',
      text: json.text ?? '',
      thumbnailUrl: media.media_url_https ?? '',
      durationLabel: formatDuration(media.video_info.duration_millis),
      codec: 'H.264',
      variants,
    },
  };
}
