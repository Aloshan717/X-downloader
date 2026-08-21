import type { RecentItem } from './types';

const KEY = 'xtract.recents';
const LIMIT = 6;

export function loadRecents(): RecentItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as RecentItem[]) : [];
  } catch {
    return [];
  }
}

function persist(items: RecentItem[]): RecentItem[] {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // Private-mode quota errors shouldn't break a completed download.
  }
  return items;
}

export function addRecent(item: RecentItem): RecentItem[] {
  const deduped = loadRecents().filter((r) => r.tweetId !== item.tweetId);
  return persist([item, ...deduped].slice(0, LIMIT));
}

export function clearRecents(): RecentItem[] {
  return persist([]);
}
