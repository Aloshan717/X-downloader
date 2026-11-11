'use client';

import BlueprintMarks from './BlueprintMarks';
import type { ResolvedTweet, VideoVariant } from '@/lib/types';

export type DownloadState = {
  filename: string;
  /** Set when the browser refused the hand-off and we fell back to a link. */
  needsManualTap?: boolean;
  href?: string;
};

type Props = {
  video: ResolvedTweet;
  variant: VideoVariant;
  state: DownloadState;
  onDone: () => void;
};

export default function DownloadScreen({ video, variant, state, onDone }: Props) {
  return (
    <div className="scr">
      <div className="kicker">
        <span className="dot" />
        Handed to your browser
      </div>
      <h2 className="screen-title">
        Downloading
        <br />
        in the background.
      </h2>

      <div className="divider-lbl">
        <span className="lbl">File</span>
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
            <div className="dl-title">@{video.author.handle}</div>
            <div className="dl-sub">
              {variant.width}×{variant.height} · Native
            </div>
          </div>
        </div>
        <div className="fname">{state.filename}</div>
      </div>

      {state.needsManualTap && state.href && (
        <a className="btn-primary manual" href={state.href} download={state.filename}>
          Tap to start <span className="mono">↓</span>
        </a>
      )}

      <div className="bp note">
        <BlueprintMarks />
        <span className="lbl">You can leave</span>
        <p>
          Your browser is doing the transfer now, not Xtract. Switch apps or
          close this — it keeps going.
        </p>
        <p className="where">
          When it finishes it&rsquo;s in your browser&rsquo;s downloads, and from
          there you can move it into Photos or Gallery.
        </p>
      </div>

      <button className="btn-primary" onClick={onDone} type="button">
        Done <span className="mono">→</span>
      </button>

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
        }
        .dl-sub {
          font-family: var(--font-mono), monospace;
          font-size: 10.5px;
          font-weight: 500;
          letter-spacing: 0.06em;
          color: var(--muted);
          text-transform: uppercase;
        }
        .fname {
          font-family: var(--font-mono), monospace;
          font-size: 10px;
          line-height: 1.45;
          color: var(--muted);
          word-break: break-all;
          border-top: 1px solid var(--divider);
          padding-top: 8px;
        }
        .manual {
          text-decoration: none;
        }
        .note {
          padding: 16px 14px;
          margin-top: 16px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .note p {
          font-size: 12.5px;
          line-height: 1.5;
          color: var(--muted-strong);
          margin: 0;
        }
        .note .where {
          color: var(--muted);
        }
      `}</style>
    </div>
  );
}
