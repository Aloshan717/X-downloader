'use client';

import { useRef } from 'react';
import BlueprintMarks from './BlueprintMarks';
import type { RecentItem } from '@/lib/types';

type Props = {
  url: string;
  error: string;
  /** Troubleshooting trace shown under the error; empty in normal operation. */
  diag?: string;
  busy: boolean;
  recents: RecentItem[];
  onUrlChange: (url: string) => void;
  onSubmit: () => void;
  onPickRecent: (item: RecentItem) => void;
  onClearRecents: () => void;
};

export default function PasteScreen({
  url,
  error,
  diag,
  busy,
  recents,
  onUrlChange,
  onSubmit,
  onPickRecent,
  onClearRecents,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) onUrlChange(text.trim());
    } catch {
      // Clipboard permission denied — focus the field so it can be pasted by hand.
      inputRef.current?.focus();
    }
  }

  return (
    <div className="scr">
      <div className="kicker">
        <span className="dot" />
        Ready · Paste a link
      </div>
      <h2 className="screen-title">
        Drop an X link
        <br />
        into the field.
      </h2>

      <div className="divider-lbl">
        <span className="lbl">01 · URL</span>
      </div>

      <div className="bp paste-slot">
        <BlueprintMarks />
        <input
          ref={inputRef}
          className="url-input"
          type="url"
          inputMode="url"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="https://x.com/…"
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !busy) onSubmit();
          }}
        />
        <div className="slot-actions">
          <button className="icn-btn on" onClick={pasteFromClipboard} type="button">
            Paste
          </button>
          <button
            className="icn-btn"
            onClick={() => onUrlChange('')}
            type="button"
            disabled={!url}
          >
            Clear
          </button>
        </div>
        {error && <div className="paste-err">{error}</div>}
        {diag && <div className="paste-diag">{diag}</div>}
      </div>

      <div className="divider-lbl" style={{ justifyContent: 'space-between' }}>
        <span className="lbl">02 · Recent</span>
        {recents.length > 0 && (
          <button
            className="icn-btn"
            style={{ padding: '6px 9px', fontSize: 9 }}
            onClick={onClearRecents}
            type="button"
          >
            Clear list
          </button>
        )}
      </div>

      {recents.length > 0 ? (
        <div className="row2">
          {recents.map((rec) => (
            <button
              key={rec.tweetId}
              className="chip"
              onClick={() => onPickRecent(rec)}
              type="button"
            >
              <span className="chip-label">{rec.label}</span>
              <span className="k">{rec.tier}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="bp empty-recents">
          <BlueprintMarks />
          <span className="lbl">Nothing here yet</span>
          <p>Downloaded videos will list here.</p>
        </div>
      )}

      <button
        className="btn-primary"
        onClick={onSubmit}
        disabled={!url || busy}
        type="button"
      >
        {busy ? 'Reading…' : 'Download'} <span className="mono">→</span>
      </button>

      <div className="footnote">
        <span className="lbl">Note</span>
        Xtract works only on public posts. Links are read on demand — nothing is
        logged.
      </div>

      <style jsx>{`
        .scr {
          display: flex;
          flex-direction: column;
          padding: 20px 18px 32px;
        }
        .paste-slot {
          padding: 18px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .url-input {
          font-family: var(--font-mono), monospace;
          font-size: 13px;
          letter-spacing: -0.01em;
          color: var(--ink);
          background: transparent;
          border: 0;
          border-bottom: 1px solid var(--divider);
          padding: 4px 0 8px;
          width: 100%;
          outline: none;
        }
        .url-input:focus {
          border-bottom-color: var(--accent);
        }
        .url-input::placeholder {
          color: color-mix(in srgb, var(--ink) 40%, transparent);
        }
        .slot-actions {
          display: flex;
          gap: 6px;
        }
        .paste-err {
          font-family: var(--font-mono), monospace;
          font-size: 10.5px;
          font-weight: 500;
          line-height: 1.4;
          color: var(--accent-700);
          letter-spacing: 0.02em;
        }
        .paste-diag {
          font-family: var(--font-mono), monospace;
          font-size: 9.5px;
          line-height: 1.45;
          color: var(--muted);
          word-break: break-word;
          padding-top: 2px;
        }
        .row2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }
        .chip {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 12px;
          background: transparent;
          border: 1px solid var(--divider);
          border-radius: 0;
          font-size: 12px;
          font-weight: 500;
          color: var(--muted-strong);
          text-align: left;
          min-width: 0;
        }
        .chip:hover {
          border-color: var(--accent);
          color: var(--accent-700);
        }
        .chip-label {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .chip .k {
          font-family: var(--font-mono), monospace;
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: color-mix(in srgb, var(--ink) 45%, transparent);
          flex-shrink: 0;
        }
        .empty-recents {
          padding: 22px 18px;
          text-align: center;
        }
        .empty-recents p {
          font-size: 12px;
          margin: 6px 0 0;
          color: var(--muted);
        }
      `}</style>
    </div>
  );
}
