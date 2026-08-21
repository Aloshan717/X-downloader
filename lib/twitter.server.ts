import 'server-only';
import { xCredentials } from './auth';
import type {
  ResolvedTweet,
  ResolveDiag,
  ResolveError,
  VideoVariant,
} from './types';

// Two ways of reading a post, tried in order:
//  1. The public syndication endpoint that powers embedded tweets. No login,
//     but X withholds sensitive/age-restricted media from it.
//  2. The GraphQL endpoint the web client uses, with the operator's own session
//     cookies. Sees whatever that account can see. Only enabled behind a
//     password (see xCredentials).
const SYNDICATION = 'https://cdn.syndication.twimg.com/tweet-result';
const GRAPHQL_HOST = 'https://api.x.com/graphql';

// The public bearer the X web client ships with; it identifies the app, not a user.
const WEB_BEARER =
  'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// X rotates the GraphQL operation id periodically. Overridable by env so a
// break can be fixed by editing a Vercel variable, without a code change.
const QUERY_ID = process.env.X_QUERY_ID || '_8aYOgEDz35BrBcBal1-_w';
const QUERY_NAME = process.env.X_QUERY_NAME || 'TweetResultByRestId';

function syndicationToken(id: string): string {
  return ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, '');
}

function dimensionsFromUrl(url: string): { width: number; height: number } | null {
  const match = url.match(/\/(\d{2,5})x(\d{2,5})\//);
  if (!match) return null;
  return { width: Number(match[1]), height: Number(match[2]) };
}

function formatDuration(ms: number | undefined): string {
  if (!ms || !Number.isFinite(ms)) return '';
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

type RawVariant = { bitrate?: number; content_type?: string; url?: string };

// Progressive MP4s only, deduped by width keeping the best bitrate, ascending.
function normalizeVariants(raw: RawVariant[] | undefined): VideoVariant[] {
  if (!raw?.length) return [];
  const seen = new Set<number>();
  return raw
    .filter((v) => v.content_type === 'video/mp4' && v.url)
    .map((v) => {
      const dims = dimensionsFromUrl(v.url!);
      return dims ? { ...dims, bitrate: v.bitrate ?? 0, url: v.url! } : null;
    })
    .filter((v): v is VideoVariant => v !== null)
    .sort((a, b) => b.bitrate - a.bitrate)
    .filter((v) => {
      if (seen.has(v.width)) return false;
      seen.add(v.width);
      return true;
    })
    .sort((a, b) => a.width - b.width);
}

type Outcome =
  | { ok: true; data: ResolvedTweet }
  | { ok: false; error: ResolveError; diag?: ResolveDiag };

// What the authenticated attempt reported, so a failure can be told apart from
// missing credentials.
type AccountAttempt = {
  outcome: Outcome;
  status?: number;
  detail?: string;
};

// ── 1. Public syndication ────────────────────────────────────────
async function viaSyndication(tweetId: string): Promise<Outcome> {
  const params = new URLSearchParams({
    id: tweetId,
    token: syndicationToken(tweetId),
    lang: 'en',
  });

  let res: Response;
  try {
    res = await fetch(`${SYNDICATION}?${params}`, {
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

  let json: {
    __typename?: string;
    text?: string;
    created_at?: string;
    user?: { screen_name?: string; name?: string; profile_image_url_https?: string };
    mediaDetails?: Array<{
      type?: string;
      media_url_https?: string;
      video_info?: { duration_millis?: number; variants?: RawVariant[] };
    }>;
  };
  try {
    json = await res.json();
  } catch {
    return { ok: false, error: 'fetch_failed' };
  }

  // A tombstone means X is withholding it from anonymous embeds, which is
  // different from the post not existing.
  if (!json?.user) return { ok: false, error: 'restricted' };

  const media = (json.mediaDetails ?? []).find(
    (m) => m.type === 'video' || m.type === 'animated_gif'
  );
  if (!media) return { ok: false, error: 'no_video' };

  const variants = normalizeVariants(media.video_info?.variants);
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
      durationLabel: formatDuration(media.video_info?.duration_millis),
      codec: 'H.264',
      variants,
      via: 'public',
    },
  };
}

// ── 2. Authenticated GraphQL ─────────────────────────────────────
// The feature flags are required and X rejects requests that omit ones it
// expects. Overridable by env for the same reason as QUERY_ID.
const DEFAULT_FEATURES = {
  creator_subscriptions_tweet_preview_api_enabled: true,
  communities_web_enable_tweet_community_results_fetch: true,
  c9s_tweet_anatomy_moderator_badge_enabled: true,
  articles_preview_enabled: true,
  responsive_web_edit_tweet_api_enabled: true,
  graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
  view_counts_everywhere_api_enabled: true,
  longform_notetweets_consumption_enabled: true,
  responsive_web_twitter_article_tweet_consumption_enabled: true,
  tweet_awards_web_tipping_enabled: false,
  creator_subscriptions_quote_tweet_preview_enabled: false,
  freedom_of_speech_not_reach_fetch_enabled: true,
  standardized_nudges_misinfo: true,
  tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
  rweb_video_timestamps_enabled: true,
  longform_notetweets_rich_text_read_enabled: true,
  longform_notetweets_inline_media_enabled: true,
  responsive_web_graphql_exclude_directive_enabled: true,
  verified_phone_label_enabled: false,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  responsive_web_graphql_timeline_navigation_enabled: true,
  responsive_web_enhance_cards_enabled: false,
};

function features(): string {
  const override = process.env.X_FEATURES;
  if (override) return override;
  return JSON.stringify(DEFAULT_FEATURES);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
async function viaAccount(tweetId: string): Promise<AccountAttempt> {
  const creds = xCredentials();
  if (!creds) {
    return { outcome: { ok: false, error: 'restricted' }, detail: 'no_credentials' };
  }

  const params = new URLSearchParams({
    variables: JSON.stringify({
      tweetId,
      withCommunity: false,
      includePromotedContent: false,
      withVoice: false,
    }),
    features: features(),
  });

  let res: Response;
  try {
    res = await fetch(`${GRAPHQL_HOST}/${QUERY_ID}/${QUERY_NAME}?${params}`, {
      headers: {
        Authorization: `Bearer ${WEB_BEARER}`,
        Cookie: `auth_token=${creds.authToken}; ct0=${creds.csrfToken}`,
        'x-csrf-token': creds.csrfToken,
        'x-twitter-auth-type': 'OAuth2Session',
        'x-twitter-active-user': 'yes',
        'x-twitter-client-language': 'en',
        'User-Agent': BROWSER_UA,
        Accept: '*/*',
      },
      cache: 'no-store',
    });
  } catch (err) {
    return {
      outcome: { ok: false, error: 'fetch_failed' },
      detail: `network:${(err as Error)?.name ?? 'error'}`,
    };
  }

  const body = await res.text().catch(() => '');

  if (!res.ok) {
    // 401/403 almost always mean the session cookies have expired.
    return {
      outcome: { ok: false, error: 'fetch_failed' },
      status: res.status,
      detail: body.slice(0, 180),
    };
  }

  let json: any;
  try {
    json = JSON.parse(body);
  } catch {
    return {
      outcome: { ok: false, error: 'fetch_failed' },
      status: res.status,
      detail: 'unparseable_body',
    };
  }

  // A 200 can still carry GraphQL errors (bad query id, missing feature flags).
  if (json?.errors?.length) {
    return {
      outcome: { ok: false, error: 'fetch_failed' },
      status: res.status,
      detail: String(json.errors[0]?.message ?? 'graphql_error').slice(0, 180),
    };
  }

  let result = json?.data?.tweetResult?.result;
  // Limited-visibility posts nest the real tweet one level deeper.
  if (result?.__typename === 'TweetWithVisibilityResults') result = result.tweet;
  if (!result) {
    return {
      outcome: { ok: false, error: 'not_found' },
      status: res.status,
      detail: 'empty_result',
    };
  }
  if (result.__typename === 'TweetTombstone') {
    return {
      outcome: { ok: false, error: 'restricted' },
      status: res.status,
      detail: 'tombstone',
    };
  }

  const legacy = result.legacy ?? {};
  const user =
    result.core?.user_results?.result?.legacy ??
    result.core?.user_results?.result?.core ??
    {};

  const media = (legacy.extended_entities?.media ?? legacy.entities?.media ?? []).find(
    (m: any) => m.type === 'video' || m.type === 'animated_gif'
  );
  if (!media) {
    return {
      outcome: { ok: false, error: 'no_video' },
      status: res.status,
      detail: 'no_media_in_result',
    };
  }

  const variants = normalizeVariants(media.video_info?.variants);
  if (!variants.length) {
    return {
      outcome: { ok: false, error: 'no_video' },
      status: res.status,
      detail: 'no_mp4_variants',
    };
  }

  return {
    status: res.status,
    outcome: {
      ok: true,
      data: {
        tweetId,
        author: {
          handle: user.screen_name ?? user.screenName ?? 'unknown',
          name: user.name ?? '',
          avatarUrl: user.profile_image_url_https ?? '',
        },
        postedAt: legacy.created_at ?? '',
        text: legacy.full_text ?? legacy.text ?? '',
        thumbnailUrl: media.media_url_https ?? '',
        durationLabel: formatDuration(media.video_info?.duration_millis),
        codec: 'H.264',
        variants,
        via: 'account',
      },
    },
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function resolveTweet(tweetId: string): Promise<Outcome> {
  const publicAttempt = await viaSyndication(tweetId);
  if (publicAttempt.ok) return publicAttempt;

  const credsPresent = Boolean(xCredentials());
  const diag: ResolveDiag = {
    publicError: publicAttempt.error,
    credsPresent,
    accountTried: false,
  };

  // Only worth a second call when the post exists but was withheld, and only
  // when a session is configured.
  const worthRetrying =
    publicAttempt.error === 'restricted' || publicAttempt.error === 'not_found';
  if (!worthRetrying || !credsPresent) {
    return { ...publicAttempt, diag };
  }

  const attempt = await viaAccount(tweetId);
  if (attempt.outcome.ok) return attempt.outcome;

  // Prefer the authenticated answer, but don't let its failure mask a clearer
  // public one (e.g. a genuinely deleted post). Either way, keep the detail.
  return {
    ...publicAttempt,
    diag: {
      ...diag,
      accountTried: true,
      accountStatus: attempt.status,
      accountDetail: attempt.detail,
    },
  };
}
