export type VideoVariant = {
  width: number;
  height: number;
  bitrate: number;
  url: string;
};

export type ResolvedTweet = {
  tweetId: string;
  author: { handle: string; name: string; avatarUrl: string };
  postedAt: string;
  text: string;
  thumbnailUrl: string;
  durationLabel: string;
  codec: string;
  variants: VideoVariant[];
  /** Which path produced this — useful when diagnosing a failure. */
  via: 'public' | 'account';
};

export type ResolveError =
  | 'invalid_url'
  | 'no_video'
  | 'restricted'
  | 'not_found'
  | 'fetch_failed';

export type RecentItem = {
  tweetId: string;
  handle: string;
  url: string;
  label: string;
  tier: string;
  savedAt: number;
};

export type Screen = 'paste' | 'preview' | 'downloading';
