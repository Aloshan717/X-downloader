'use client';

import { useCallback, useEffect, useState } from 'react';
import PasteScreen from '@/components/PasteScreen';
import PreviewScreen from '@/components/PreviewScreen';
import DownloadScreen, { type DownloadState } from '@/components/DownloadScreen';
import { isValidTweetUrl } from '@/lib/validate';
import { addRecent, clearRecents, loadRecents } from '@/lib/recent';
import type { RecentItem, ResolvedTweet, Screen, VideoVariant } from '@/lib/types';

const RESOLVE_ERRORS: Record<string, string> = {
  invalid_url: 'That doesn’t look like an X post link.',
  no_video: 'That post doesn’t contain a video.',
  restricted: 'X won’t serve this post without a signed-in account.',
  not_found: 'Post not found — it may be deleted.',
  fetch_failed: 'Couldn’t reach X. Your session may have expired.',
  unauthorized: 'Session expired. Reload and sign in again.',
};

export default function Home() {
  const [screen, setScreen] = useState<Screen>('paste');
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [diag, setDiag] = useState('');
  const [busy, setBusy] = useState(false);
  const [recents, setRecents] = useState<RecentItem[]>([]);
  const [video, setVideo] = useState<ResolvedTweet | null>(null);
  const [variant, setVariant] = useState<VideoVariant | null>(null);
  const [dl, setDl] = useState<DownloadState | null>(null);

  useEffect(() => {
    setRecents(loadRecents());
  }, []);

  const resolve = useCallback(async (target: string) => {
    setBusy(true);
    setError('');
    setDiag('');
    try {
      const res = await fetch('/api/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: target }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(RESOLVE_ERRORS[body?.error] ?? 'Something went wrong.');
        // A one-line trace of what each lookup path reported, for debugging a
        // deployment. Contains no part of the session cookies.
        const d = body?.diag;
        setDiag(
          d
            ? [
                `public=${d.publicError ?? '-'}`,
                `creds=${d.credsPresent ? 'yes' : 'NO'}`,
                `tried=${d.accountTried ? 'yes' : 'no'}`,
                d.accountStatus ? `http=${d.accountStatus}` : '',
                d.accountDetail ? `detail=${d.accountDetail}` : '',
              ]
                .filter(Boolean)
                .join(' · ')
            : ''
        );
        return;
      }
      const data = body as ResolvedTweet;
      setVideo(data);
      setVariant(data.variants[data.variants.length - 1] ?? null);
      setScreen('preview');
    } catch {
      setError('Network error. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }, []);

  function handleSubmit() {
    const target = url.trim();
    if (!isValidTweetUrl(target)) {
      setError(RESOLVE_ERRORS.invalid_url);
      return;
    }
    void resolve(target);
  }

  function handlePickRecent(item: RecentItem) {
    setUrl(item.url);
    void resolve(item.url);
  }

  function buildFilename(v: ResolvedTweet, sel: VideoVariant) {
    return `xtract-${v.author.handle}-${v.tweetId}-${sel.width}x${sel.height}.mp4`;
  }

  // A home-screen web app has no download UI of its own, and iOS in particular
  // is unreliable about starting one in place.
  function isStandalone(): boolean {
    if (typeof window === 'undefined') return false;
    const iosStandalone = (
      window.navigator as Navigator & { standalone?: boolean }
    ).standalone;
    return (
      iosStandalone === true ||
      window.matchMedia?.('(display-mode: standalone)').matches === true
    );
  }

  // Hand the transfer to the browser's own download manager rather than
  // streaming it here. Page JavaScript is suspended as soon as the app is
  // backgrounded, which stopped any download the moment you switched apps; a
  // browser download survives that, and survives closing Xtract entirely.
  function handleDownload() {
    if (!video || !variant) return;
    const filename = buildFilename(video, variant);
    const href = `/api/download?src=${encodeURIComponent(
      variant.url
    )}&filename=${encodeURIComponent(filename)}`;

    let handedOff = false;
    try {
      const anchor = document.createElement('a');
      anchor.href = href;
      anchor.download = filename;
      // From a home-screen launch, send it to a full browser context so it
      // lands in that browser's downloads instead of nowhere.
      if (isStandalone()) {
        anchor.target = '_blank';
        anchor.rel = 'noopener';
      }
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      handedOff = true;
    } catch {
      handedOff = false;
    }

    setScreen('downloading');
    setDl({ filename, needsManualTap: !handedOff, href });

    // Recorded on hand-off: the browser owns the transfer from here, so we
    // never learn whether it finished.
    setRecents(
      addRecent({
        tweetId: video.tweetId,
        handle: video.author.handle,
        url: `https://x.com/${video.author.handle}/status/${video.tweetId}`,
        label: `@${video.author.handle}${
          video.durationLabel ? ` · ${video.durationLabel}` : ''
        }`,
        tier: `${variant.height}p`,
        savedAt: Date.now(),
      })
    );
  }

  function reset(target: Screen) {
    setDl(null);
    setScreen(target);
    if (target === 'paste') {
      setVideo(null);
      setVariant(null);
      setUrl('');
      setError('');
    }
  }

  return (
    <main className="shell">
      <header className="hd">
        <span className="wordmark">Xtract</span>
        <span className="lbl">X · Video · Downloader</span>
      </header>

      {screen === 'paste' && (
        <PasteScreen
          url={url}
          error={error}
          diag={diag}
          busy={busy}
          recents={recents}
          onUrlChange={(next) => {
            setUrl(next);
            if (error) setError('');
            if (diag) setDiag('');
          }}
          onSubmit={handleSubmit}
          onPickRecent={handlePickRecent}
          onClearRecents={() => setRecents(clearRecents())}
        />
      )}

      {screen === 'preview' && video && (
        <PreviewScreen
          video={video}
          selected={variant}
          onSelect={setVariant}
          onDownload={handleDownload}
          onBack={() => reset('paste')}
        />
      )}

      {screen === 'downloading' && video && variant && dl && (
        <DownloadScreen
          video={video}
          variant={variant}
          state={dl}
          onDone={() => reset('paste')}
        />
      )}

      <style jsx>{`
        .shell {
          max-width: 520px;
          margin: 0 auto;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }
        .hd {
          display: flex;
          align-items: baseline;
          gap: 14px;
          padding: 22px 18px 14px;
          border-bottom: 1px solid var(--divider);
        }
        .wordmark {
          font-family: var(--font-heading), sans-serif;
          font-weight: 700;
          font-size: 22px;
          letter-spacing: 0.03em;
          text-transform: uppercase;
        }
        .hd :global(.lbl) {
          letter-spacing: 0.22em;
        }
      `}</style>
    </main>
  );
}
