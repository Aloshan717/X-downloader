// Isomorphic: used by the paste screen for instant feedback and by /api/resolve
// as the authoritative check. Accepts x.com, twitter.com and their mobile hosts.
const STATUS_URL =
  /^https?:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\/(?:i\/web\/|[A-Za-z0-9_]{1,20}\/)status(?:es)?\/(\d{1,25})/i;

export function extractTweetId(raw: string): string | null {
  const url = raw.trim();
  if (!url) return null;
  const match = url.match(STATUS_URL);
  return match ? match[1] : null;
}

export function isValidTweetUrl(raw: string): boolean {
  return extractTweetId(raw) !== null;
}
