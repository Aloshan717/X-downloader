'use client';

import BlueprintMarks from './BlueprintMarks';
import type { ResolvedTweet, VideoVariant } from '@/lib/types';

type Props = {
  video: ResolvedTweet;
  selected: VideoVariant | null;
  onSelect: (variant: VideoVariant) => void;
  onDownload: () => void;
  onBack: () => void;
};

function estimateSize(variant: VideoVariant, durationLabel: string): string {
  const [m, s] = durationLabel.split(':').map(Number);
  const seconds = (m || 0) * 60 + (s || 0);
  if (!seconds || !variant.bitrate) return '—';
  const mb = (variant.bitrate * seconds) / 8 / 1_000_000;
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

function formatPosted(iso: string): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const diffH = Math.floor((Date.now() - date.getTime()) / 3_600_000);
  if (diffH < 1) return 'just now';
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 30) return `${diffD}d ago`;
  return date.toLocaleDateString();
}

export default function PreviewScreen({
  video,
  selected,
  onSelect,
  onDownload,
  onBack,
}: Props) {
  const source = video.variants[video.variants.length - 1];

  return (
    <div className="scr">
      <div className="kicker">
        <span className="dot" />
        Found · {video.variants.length}{' '}
        {video.variants.length === 1 ? 'format' : 'formats'}
      </div>

      <div className="bp thumb">
        <BlueprintMarks />
        {video.thumbnailUrl && (
          // Plain img: the URL is remote, unoptimised, and purely decorative here.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={video.thumbnailUrl} alt="" className="thumb-img" />
        )}
        <div className="src">@{video.author.handle} · X</div>
        {video.durationLabel && <div className="dur">{video.durationLabel}</div>}
      </div>

      <div className="meta-grid">
        <div>
          <div className="lbl">Author</div>
          <div className="val">@{video.author.handle}</div>
        </div>
        <div>
          <div className="lbl">Posted</div>
          <div className="val">{formatPosted(video.postedAt)}</div>
        </div>
        <div>
          <div className="lbl">Source res</div>
          <div className="val">
            {source ? `${source.width}×${source.height}` : '—'}
          </div>
        </div>
        <div>
          <div className="lbl">Codec</div>
          <div className="val">{video.codec}</div>
        </div>
      </div>

      <div className="divider-lbl">
        <span className="lbl">Resolution</span>
      </div>

      <div className="res-list">
        {video.variants
          .slice()
          .reverse()
          .map((variant) => {
            const on = selected?.url === variant.url;
            return (
              <button
                key={variant.url}
                className={`res${on ? ' on' : ''}`}
                onClick={() => onSelect(variant)}
                type="button"
              >
                <span className="radio" />
                <span className="r-label">{variant.height}p</span>
                <span className="r-tag">Native</span>
                <span className="r-size">
                  {estimateSize(variant, video.durationLabel)}
                </span>
              </button>
            );
          })}
      </div>

      <button className="btn-primary" onClick={onDownload} type="button">
        {selected ? `Download ${selected.height}p` : 'Download'}{' '}
        <span className="mono">↓</span>
      </button>
      <button className="btn-ghost" onClick={onBack} type="button">
        Back
      </button>

      <div className="footnote">
        <span className="lbl">Note</span>
        Sizes are estimates from the source bitrate. Files save to your device’s
        downloads — from there you can move them into Photos.
      </div>

      <style jsx>{`
        .scr {
          display: flex;
          flex-direction: column;
          padding: 20px 18px 32px;
        }
        .thumb {
          aspect-ratio: 16 / 9;
          background: var(--accent-900);
          position: relative;
          overflow: hidden;
        }
        .thumb-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .src {
          position: absolute;
          top: 8px;
          left: 8px;
          font-family: var(--font-mono), monospace;
          font-size: 9.5px;
          font-weight: 600;
          letter-spacing: 0.14em;
          color: var(--paper);
          text-transform: uppercase;
          background: rgba(0, 0, 0, 0.55);
          padding: 4px 6px;
        }
        .dur {
          position: absolute;
          bottom: 8px;
          right: 8px;
          font-family: var(--font-mono), monospace;
          font-size: 10px;
          font-weight: 600;
          color: var(--paper);
          background: rgba(0, 0, 0, 0.55);
          padding: 4px 6px;
        }
        .meta-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          border-top: 1px solid var(--divider);
          border-left: 1px solid var(--divider);
          margin-top: 14px;
        }
        .meta-grid > div {
          border-right: 1px solid var(--divider);
          border-bottom: 1px solid var(--divider);
          padding: 10px 12px;
          min-width: 0;
        }
        .val {
          font-family: var(--font-mono), monospace;
          font-size: 13px;
          font-weight: 500;
          margin-top: 4px;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .res-list {
          display: flex;
          flex-direction: column;
        }
        .res {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 4px;
          border: 0;
          border-bottom: 1px solid var(--divider);
          background: transparent;
          width: 100%;
          text-align: left;
          color: inherit;
        }
        .res:last-child {
          border-bottom: 0;
        }
        .radio {
          width: 14px;
          height: 14px;
          border: 1px solid color-mix(in srgb, var(--ink) 50%, transparent);
          border-radius: 50%;
          position: relative;
          flex-shrink: 0;
        }
        .res.on .radio {
          border-color: var(--accent);
        }
        .res.on .radio::after {
          content: '';
          position: absolute;
          inset: 2.5px;
          background: var(--accent);
          border-radius: 50%;
        }
        .r-label {
          font-family: var(--font-heading), sans-serif;
          font-weight: 600;
          font-size: 15px;
          letter-spacing: -0.01em;
        }
        .r-tag {
          font-family: var(--font-mono), monospace;
          font-size: 8.5px;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          padding: 3px 5px;
          background: var(--neutral-200);
          color: var(--muted-strong);
        }
        .r-size {
          margin-left: auto;
          font-family: var(--font-mono), monospace;
          font-size: 11.5px;
          font-weight: 500;
          color: var(--muted);
        }
      `}</style>
    </div>
  );
}
