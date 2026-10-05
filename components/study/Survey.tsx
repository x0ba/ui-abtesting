"use client";

import { useState } from "react";
import { DIMENSIONS } from "@/lib/study/dimensions.ts";
import type { Condition } from "@/lib/study/events.ts";

export type SurveyAnswers = {
  tlx: Record<string, number>;
  sus: Record<string, number>;
  suggestionStyle: string | null;
  comment: string;
};

// NASA-TLX, raw (unweighted), on the standard 21-point scale.
const TLX = [
  { id: "mental", q: "How mentally demanding was planning?", low: "Very low", high: "Very high" },
  { id: "physical", q: "How physically demanding was it?", low: "Very low", high: "Very high" },
  { id: "temporal", q: "How hurried or rushed did you feel?", low: "Very low", high: "Very high" },
  { id: "performance", q: "How successful were you at what you were asked to do?", low: "Perfect", high: "Failure" },
  { id: "effort", q: "How hard did you have to work to do that well?", low: "Very low", high: "Very high" },
  { id: "frustration", q: "How insecure, discouraged, irritated, stressed or annoyed were you?", low: "Very low", high: "Very high" },
];

// System Usability Scale, with "system" replaced by "planner".
const SUS = [
  "I think that I would like to use this planner frequently.",
  "I found the planner unnecessarily complex.",
  "I thought the planner was easy to use.",
  "I think that I would need the support of a technical person to be able to use this planner.",
  "I found the various functions in this planner were well integrated.",
  "I thought there was too much inconsistency in this planner.",
  "I would imagine that most people would learn to use this planner very quickly.",
  "I found the planner very cumbersome to use.",
  "I felt very confident using the planner.",
  "I needed to learn a lot of things before I could get going with this planner.",
];
const AGREE = ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"];

export function Survey({ condition, onSubmit }: { condition: Condition; onSubmit: (a: SurveyAnswers) => Promise<void> }) {
  const [tlx, setTlx] = useState<Record<string, number>>({});
  const [sus, setSus] = useState<Record<string, number>>({});
  const [style, setStyle] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const missing = TLX.length - Object.keys(tlx).length + (SUS.length - Object.keys(sus).length);

  return (
    <main className="page">
      <form
        className="page-col page-col-wide survey"
        onSubmit={async (e) => {
          e.preventDefault();
          if (missing > 0) {
            setError(`${missing} ${missing === 1 ? "question still needs" : "questions still need"} an answer. Unanswered ones are outlined.`);
            return;
          }
          setBusy(true);
          await onSubmit({ tlx, sus, suggestionStyle: style, comment });
        }}
        data-show-missing={error ? "" : undefined}
      >
        <h1 className="page-title">How did this session go?</h1>
        <p className="lede">Think about the whole session, across all of today&apos;s tasks.</p>

        <section className="survey-block">
          <h2>Workload</h2>
          {TLX.map((item) => (
            <fieldset key={item.id} className="tlx" data-missing={tlx[item.id] === undefined || undefined}>
              <legend>{item.q}</legend>
              <div className="tlx-scale">
                {Array.from({ length: 21 }, (_, i) => i * 5).map((v) => (
                  <label key={v} className="tlx-tick">
                    <input type="radio" name={`tlx-${item.id}`} value={v} checked={tlx[item.id] === v} onChange={() => setTlx({ ...tlx, [item.id]: v })} />
                    <span className="visually-hidden">{v} out of 100</span>
                  </label>
                ))}
              </div>
              <div className="tlx-ends" aria-hidden>
                <span>{item.low}</span>
                <span>{item.high}</span>
              </div>
            </fieldset>
          ))}
        </section>

        <section className="survey-block">
          <h2>The planner</h2>
          <div className="sus" role="group" aria-label="How much do you agree?">
            <div className="sus-head" aria-hidden>
              <span />
              {AGREE.map((a) => (
                <span key={a}>{a}</span>
              ))}
            </div>
            {SUS.map((statement, i) => (
              <div key={i} role="radiogroup" aria-labelledby={`sus-q-${i + 1}`} className="sus-row" data-missing={sus[i + 1] === undefined || undefined}>
                <p id={`sus-q-${i + 1}`}>{statement}</p>
                {AGREE.map((a, j) => (
                  <label key={a} className="sus-cell">
                    <input type="radio" name={`sus-${i + 1}`} value={j + 1} checked={sus[i + 1] === j + 1} onChange={() => setSus({ ...sus, [i + 1]: j + 1 })} />
                    <span className="visually-hidden">{a}</span>
                  </label>
                ))}
              </div>
            ))}
          </div>
        </section>

        {condition === "mixed-initiative" && (
          <section className="survey-block">
            <h2>Suggestions</h2>
            <fieldset className="choice-group">
              <legend>How would you like the planner to bring you suggestions?</legend>
              {[...DIMENSIONS.proposalStyle.variations, { id: "none", label: "Not at all", description: "I'd rather change things myself, or not at all." }].map((v) => (
                <label key={v.id} className="choice">
                  <input type="radio" name="style" value={v.id} checked={style === v.id} onChange={() => setStyle(v.id)} />
                  <span className="choice-label">{v.label}</span>
                  <span className="choice-help">{v.description}</span>
                </label>
              ))}
            </fieldset>
          </section>
        )}

        <section className="survey-block">
          <h2>Anything else?</h2>
          <label className="field" htmlFor="comment">
            <span>Tell us anything that stood out, good or bad. Optional.</span>
          </label>
          <textarea id="comment" rows={4} value={comment} onChange={(e) => setComment(e.target.value)} />
        </section>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Saving" : "Finish session"}
        </button>
      </form>
    </main>
  );
}
