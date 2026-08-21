'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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

  // Buffered chunks and transfer bookkeeping survive a pause/resume cycle.
  const chunksRef = useRef<Uint8Array[]>([]);
  const receivedRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

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

  // Streams the proxied file, tracking real byte progress. `startAt` lets a
  // resumed transfer pick up from the bytes already buffered.
  const transfer = useCallback(
    async (v: ResolvedTweet, sel: VideoVariant, startAt: number) => {
      const filename = buildFilename(v, sel);
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch(
          `/api/download?src=${encodeURIComponent(sel.url)}&filename=${encodeURIComponent(filename)}`,
          {
            signal: controller.signal,
            headers: startAt > 0 ? { Range: `bytes=${startAt}-` } : {},
          }
        );

        if (!res.ok && res.status !== 206) throw new Error('upstream');
        if (!res.body) throw new Error('nobody');

        // Content-Length covers only the requested range, so add what we hold.
        const lengthHeader = Number(res.headers.get('content-length') ?? 0);
        const total = lengthHeader ? lengthHeader + startAt : 0;

        setDl({ status: 'running', received: startAt, total, filename });

        const reader = res.body.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunksRef.current.push(value);
            receivedRef.current += value.byteLength;
            setDl((prev) =>
              prev && prev.status === 'running'
                ? { ...prev, received: receivedRef.current }
                : prev
            );
          }
        }

        // Assemble and hand the blob to the browser as a real download.
        const blob = new Blob(chunksRef.current as BlobPart[], { type: 'video/mp4' });
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);

        setDl({
          status: 'done',
          received: receivedRef.current,
          total: receivedRef.current,
          filename,
        });

        setRecents(
          addRecent({
            tweetId: v.tweetId,
            handle: v.author.handle,
            url: `https://x.com/${v.author.handle}/status/${v.tweetId}`,
            label: `@${v.author.handle}${v.durationLabel ? ` · ${v.durationLabel}` : ''}`,
            tier: `${sel.height}p`,
            savedAt: Date.now(),
          })
        );
      } catch (err) {
        // An abort is a deliberate pause/cancel, not a failure.
        if ((err as Error)?.name === 'AbortError') return;
        setDl((prev) => ({
          status: 'error',
          received: receivedRef.current,
          total: prev?.total ?? 0,
          filename,
          message: 'Transfer failed. Check your connection and try again.',
        }));
      }
    },
    []
  );

  function handleDownload() {
    if (!video || !variant) return;
    chunksRef.current = [];
    receivedRef.current = 0;
    setScreen('downloading');
    setDl({
      status: 'running',
      received: 0,
      total: 0,
      filename: buildFilename(video, variant),
    });
    void transfer(video, variant, 0);
  }

  function handlePause() {
    abortRef.current?.abort();
    abortRef.current = null;
    setDl((prev) => (prev ? { ...prev, status: 'paused' } : prev));
  }

  function handleResume() {
    if (!video || !variant) return;
    setDl((prev) => (prev ? { ...prev, status: 'running' } : prev));
    void transfer(video, variant, receivedRef.current);
  }

  function reset(target: Screen) {
    abortRef.current?.abort();
    abortRef.current = null;
    chunksRef.current = [];
    receivedRef.current = 0;
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
          onPause={handlePause}
          onResume={handleResume}
          onCancel={() => reset('paste')}
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
