"use client";

import { useMemo, useState } from "react";
import type { Spec } from "@/lib/study/dimensions.ts";
import { summarize } from "@/lib/study/describe.ts";
import { hashString, mulberry32, shuffle } from "@/lib/study/rng.ts";
import { SpecSketch } from "./SpecSketch.tsx";

type Option = { id: "final" | "reference"; label: string; spec: Spec };

export function Pairwise({ spec, reference, seed, onAnswer }: { spec: Spec; reference: Spec; seed: string; onAnswer: (choice: string, order: string[]) => void }) {
  const options = useMemo(
    () =>
      shuffle<Option>(
        [
          { id: "final", label: "The setup you finished with", spec },
          { id: "reference", label: "The setup the planner started with", spec: reference },
        ],
        mulberry32(hashString(seed)),
      ),
    [spec, reference, seed],
  );
  const [choice, setChoice] = useState<string | null>(null);

  return (
    <main className="page">
      <form
        className="page-col page-col-wide"
        onSubmit={(e) => {
          e.preventDefault();
          if (choice) onAnswer(choice, options.map((o) => o.id));
        }}
      >
        <h1 className="page-title">Which setup was better for that task?</h1>
        <p className="lede">Think about the task you just finished, not which one looks nicer.</p>
        <fieldset className="pair">
          <legend className="visually-hidden">Pick one</legend>
          {options.map((o) => (
            <label key={o.id} className="pair-option">
              <input type="radio" name="pair" value={o.id} checked={choice === o.id} onChange={() => setChoice(o.id)} />
              <span className="pair-label">{o.label}</span>
              <SpecSketch spec={o.spec} />
              <dl className="pair-facts">
                {summarize(o.spec).map((row) => (
                  <div key={row.dimension}>
                    <dt>{row.dimension}</dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
              </dl>
            </label>
          ))}
          <label className="pair-option pair-none">
            <input type="radio" name="pair" value="same" checked={choice === "same"} onChange={() => setChoice("same")} />
            <span className="pair-label">No real difference</span>
          </label>
        </fieldset>
        <button type="submit" className="btn btn-primary" disabled={!choice}>
          Continue
        </button>
      </form>
    </main>
  );
}
