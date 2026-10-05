"use client";

import { useState } from "react";

export function Entry({ onSubmit }: { onSubmit: (code: string) => Promise<string | null> }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <main className="page">
      <div className="page-col">
        <h1 className="page-title">Plan a term at Halden College</h1>
        <p className="lede">
          In this study you plan courses for a made-up college. The planner will look a little different from time to time. We want to learn which
          versions suit you. Each session takes about 25 minutes.
        </p>
        <form
          className="code-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(await onSubmit(code));
            setBusy(false);
          }}
        >
          <label className="field field-large" htmlFor="code">
            <span>Participant code</span>
          </label>
          <p className="field-help" id="code-help">
            It&apos;s in your invitation. Use the same code every session.
          </p>
          <div className="code-row">
            <input
              id="code"
              name="code"
              autoComplete="off"
              spellCheck={false}
              aria-describedby={error ? "code-help code-error" : "code-help"}
              aria-invalid={error ? true : undefined}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
            <button type="submit" className="btn btn-primary" disabled={busy || code.trim().length === 0}>
              {busy ? "Checking" : "Continue"}
            </button>
          </div>
          {error && (
            <p className="form-error" id="code-error" role="alert">
              {error}
            </p>
          )}
        </form>
      </div>
    </main>
  );
}
