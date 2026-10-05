"use client";

import { useState } from "react";
import { STUDY } from "@/lib/study/config.ts";

export function Consent({ code, onAgree, onBack }: { code: string; onAgree: () => Promise<string | null>; onBack: () => void }) {
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <main className="page">
      <div className="page-col prose">
        <h1 className="page-title">Before you start</h1>
        <p className="lede">You&apos;re joining as {code}. Please read this, then agree if you&apos;d like to take part.</p>

        <h2>What you&apos;ll do</h2>
        <p>
          Over {STUDY.sessionsPerParticipant} sessions, you&apos;ll use a course planner to pick courses that fit short briefs, such as a course that
          leaves your Fridays free. During a session the planner may change how it looks, suggest a change, or let you change it yourself. After each
          session you&apos;ll answer a few questions about how it went.
        </p>

        <h2>What we record</h2>
        <p>
          We record what you do in the planner: what you click, which courses you rest the pointer on and for how long, how you scroll, search and
          filter, which suggestions you take, and your answers to our questions. Each record is tied to your participant code, not your name. We
          don&apos;t record your screen, keystrokes outside the search box, or anything outside this page.
        </p>

        <h2>Your choices</h2>
        <p>
          Taking part is voluntary. You can stop at any time by closing the page, and you can ask the research team to delete your data by quoting
          your participant code.
        </p>

        <form
          className="consent-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(await onAgree());
            setBusy(false);
          }}
        >
          <label className="check check-large">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            <span>I&apos;ve read this and agree to take part.</span>
          </label>
          <div className="row">
            <button type="submit" className="btn btn-primary" disabled={!agreed || busy}>
              Start the study
            </button>
            <button type="button" className="btn btn-secondary" onClick={onBack}>
              Use a different code
            </button>
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </form>
      </div>
    </main>
  );
}
