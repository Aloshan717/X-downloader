'use client';

import BlueprintMarks from './BlueprintMarks';
import type { ResolvedTweet, VideoVariant } from '@/lib/types';

export type DownloadState = {
  status: 'running' | 'paused' | 'done' | 'error';
  received: number;
  total: number;
  filename: string;
  message?: string;
};

type Props = {
  video: ResolvedTweet;
  variant: VideoVariant;
  state: DownloadState;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onDone: () => void;
};

function formatBytes(bytes: number): string {
  if (!bytes) return '0 MB';
  const mb = bytes / 1_000_000;
  return mb < 10 ? `${mb.toFixed(1)} MB` : `${Math.round(mb)} MB`;
}

export default function DownloadScreen({
  video,
  variant,
  state,
  onPause,
  onResume,
  onCancel,
  onDone,
}: Props) {
  const pct = state.total
    ? Math.min(100, Math.round((state.received / state.total) * 100))
    : 0;
  const done = state.status === 'done';
  const errored = state.status === 'error';

  const statusLabel = errored
    ? 'Failed'
    : done
      ? 'Complete · saved'
      : state.status === 'paused'
        ? 'Paused'
        : 'Running · Transfer';

  return (
    <div className="scr">
      <div className="kicker">
        <span className={`dot${state.status === 'running' ? ' pulse' : ''}`} />
        {statusLabel}
      </div>
      <h2 className="screen-title">
        {errored ? (
          <>
            Download
            <br />
            failed.
          </>
        ) : done ? (
          <>
            Saved to your
            <br />
            downloads.
          </>
        ) : (
          <>
            Downloading
            <br />
            at {variant.height}p.
          </>
        )}
      </h2>

      <div className="divider-lbl">
        <span className="lbl">Current · 01</span>
      </div>

      <div className="bp dl-item">
        <BlueprintMarks />
        <div className="dl-head">
          <div className="dl-thumb">
            {video.thumbnailUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={video.thumbnailUrl} alt="" />
            )}
          </div>
          <div className="dl-info">
            <div className="dl-title">
              @{video.author.handle}
              {video.text ? ` · ${video.text.slice(0, 48)}` : ''}
            </div>
            <div className="dl-sub">
              {variant.width}×{variant.height} · Native ·{' '}
              {state.total ? formatBytes(state.total) : '—'}
            </div>
          </div>
        </div>

        <div className="prog-track">
          <div
            className={`prog-fill${done ? ' done' : ''}`}
            style={{ width: `${done ? 100 : pct}%` }}
          />
        </div>
        <div className="prog-meta">
          <span>
            {formatBytes(state.received)}
            {state.total ? ` / ${formatBytes(state.total)}` : ''}
          </span>
          <span className="pct">{done ? '100%' : `${pct}%`}</span>
        </div>

        {state.message && <div className="dl-msg">{state.message}</div>}

        <div className="dl-actions">
          {state.status === 'running' && (
            <button className="icn-btn on" onClick={onPause} type="button">
              Pause
            </button>
          )}
          {state.status === 'paused' && (
            <button className="icn-btn on" onClick={onResume} type="button">
              Resume
            </button>
          )}
          {(done || errored) && (
            <button className="icn-btn on" onClick={onDone} type="button">
              Done
            </button>
          )}
          <button className="icn-btn" onClick={onCancel} type="button">
            {done || errored ? 'Close' : 'Cancel'}
          </button>
        </div>
      </div>

      {done && (
        <div className="bp success">
          <BlueprintMarks />
          <div className="tick">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12l5 5L20 7" />
            </svg>
          </div>
          <h3>Saved</h3>
          <p>
            {state.filename} · {formatBytes(state.received)}
          </p>
          <p className="hint">
            Find it in your downloads, then use the share sheet to save it into
            Photos.
          </p>
        </div>
      )}

      <div className="footnote">
        <span className="lbl">Note</span>
        Keep this screen open while the transfer runs — leaving the app may stop
        it.
      </div>

      <style jsx>{`
        .scr {
          display: flex;
          flex-direction: column;
          padding: 20px 18px 32px;
        }
        .dl-item {
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .dl-head {
          display: flex;
          gap: 12px;
          align-items: flex-start;
        }
        .dl-thumb {
          flex-shrink: 0;
          width: 76px;
          height: 46px;
          background: var(--accent-900);
          overflow: hidden;
        }
        .dl-thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .dl-info {
          flex: 1;
          min-width: 0;
        }
        .dl-title {
          font-family: var(--font-heading), sans-serif;
          font-weight: 600;
          font-size: 14.5px;
          line-height: 1.2;
          margin-bottom: 4px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .dl-sub {
          font-family: var(--font-mono), monospace;
          font-size: 10.5px;
          font-weight: 500;
          line-height: 1.3;
          letter-spacing: 0.06em;
          color: var(--muted);
          text-transform: uppercase;
        }
        .prog-track {
          position: relative;
          height: 4px;
          background: var(--neutral-200);
        }
        .prog-fill {
          position: absolute;
          inset: 0 auto 0 0;
          background: var(--accent);
          transition: width 0.15s linear;
        }
        .prog-fill.done {
          background: var(--accent-700);
        }
        .prog-meta {
          display: flex;
          justify-content: space-between;
          font-family: var(--font-mono), monospace;
          font-size: 10.5px;
          font-weight: 500;
          color: var(--muted);
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .prog-meta .pct {
          color: var(--ink);
          font-weight: 600;
        }
        .dl-msg {
          font-family: var(--font-mono), monospace;
          font-size: 10.5px;
          line-height: 1.4;
          color: var(--accent-700);
        }
        .dl-actions {
          display: flex;
          gap: 6px;
          margin-top: 4px;
        }
        .dl-actions :global(.icn-btn) {
          flex: 1;
        }
        .success {
          padding: 22px 18px;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 10px;
          margin-top: 16px;
        }
        .tick {
          width: 34px;
          height: 34px;
          border: 1px solid var(--accent);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--accent);
        }
        .tick svg {
          width: 20px;
          height: 20px;
        }
        .success h3 {
          font-family: var(--font-heading), sans-serif;
          font-weight: 700;
          font-size: 20px;
          margin: 0;
          text-transform: uppercase;
        }
        .success p {
          font-size: 12.5px;
          line-height: 1.5;
          color: var(--muted-strong);
          margin: 0;
          word-break: break-all;
        }
        .success .hint {
          color: var(--muted);
        }
      `}</style>
    </div>
  );
}
