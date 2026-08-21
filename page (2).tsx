'use client';

import { useState } from 'react';
import BlueprintMarks from '@/components/BlueprintMarks';

export default function Login() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!password || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        // Full reload so the middleware re-evaluates with the new cookie.
        window.location.href = '/';
        return;
      }
      const body = await res.json().catch(() => ({}));
      setError(
        body?.error === 'no_password_set'
          ? 'No password is configured on the server.'
          : 'Wrong password.'
      );
    } catch {
      setError('Network error. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="shell">
      <header className="hd">
        <span className="wordmark">Xtract</span>
        <span className="lbl">X · Video · Downloader</span>
      </header>

      <div className="body">
        <div className="kicker">
          <span className="dot" />
          Locked
        </div>
        <h2 className="screen-title">
          Enter the
          <br />
          passcode.
        </h2>

        <div className="divider-lbl">
          <span className="lbl">Access</span>
        </div>

        <div className="bp slot">
          <BlueprintMarks />
          <input
            className="pw"
            type="password"
            autoFocus
            placeholder="••••••••"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) setError('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submit();
            }}
          />
          {error && <div className="err">{error}</div>}
        </div>

        <button
          className="btn-primary"
          onClick={() => void submit()}
          disabled={!password || busy}
          type="button"
        >
          {busy ? 'Checking…' : 'Unlock'} <span className="mono">→</span>
        </button>

        <div className="footnote">
          <span className="lbl">Note</span>
          This app is locked because it holds a signed-in X session. Only someone
          with the passcode can use it.
        </div>
      </div>

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
        .body {
          padding: 20px 18px 32px;
          display: flex;
          flex-direction: column;
        }
        .slot {
          padding: 18px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .pw {
          font-family: var(--font-mono), monospace;
          font-size: 15px;
          letter-spacing: 0.1em;
          color: var(--ink);
          background: transparent;
          border: 0;
          border-bottom: 1px solid var(--divider);
          padding: 4px 0 8px;
          width: 100%;
          outline: none;
        }
        .pw:focus {
          border-bottom-color: var(--accent);
        }
        .err {
          font-family: var(--font-mono), monospace;
          font-size: 10.5px;
          font-weight: 500;
          color: var(--accent-700);
          letter-spacing: 0.02em;
        }
      `}</style>
    </main>
  );
}
