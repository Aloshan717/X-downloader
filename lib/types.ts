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
};

export type ResolveError =
  | 'invalid_url'
  | 'no_video'
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
