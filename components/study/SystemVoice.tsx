"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { DIMENSIONS, INTERFACE_DIMENSIONS, type DimensionId, type Spec } from "@/lib/study/dimensions.ts";
import { phrase } from "@/lib/study/describe.ts";
import type { Affect } from "@/lib/study/events.ts";
import type { Pending } from "./StudyApp.tsx";
import { SpecSketch } from "./SpecSketch.tsx";

type Respond = (response: "accept" | "reject" | "adjust", chosen: Spec | null) => void;

function joinPhrases(parts: string[]): string {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open, close]);
  return ref;
}

function Choices({ dim, value, onChange, name }: { dim: DimensionId; value: string; onChange: (v: string) => void; name: string }) {
  const d = DIMENSIONS[dim];
  return (
    <fieldset className="choice-group">
      <legend>{d.question}</legend>
      {d.variations.map((v) => (
        <label key={v.id} className="choice">
          <input type="radio" name={name} value={v.id} checked={value === v.id} onChange={() => onChange(v.id)} />
          <span className="choice-label">{v.label}</span>
          <span className="choice-help">{v.description}</span>
        </label>
      ))}
    </fieldset>
  );
}

// Adaptable condition: the person changes any open dimension whenever they like.
export function ViewMenu({ spec, onChange, onOpen }: { spec: Spec; onChange: (dim: DimensionId, value: string) => void; onOpen: () => void }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const ref = useDismiss(open, () => setOpen(false));
  return (
    <div className="pop-anchor" ref={ref}>
      <button
        type="button"
        className="btn btn-secondary"
        aria-expanded={open}
        aria-controls={id}
        data-ev="view.toggle"
        onClick={() => {
          if (!open) onOpen();
          setOpen(!open);
        }}
      >
        Change view
      </button>
      {open && (
        <div className="pop view-menu" id={id} role="dialog" aria-label="Change view">
          {INTERFACE_DIMENSIONS.map((d) => (
            <Choices key={d} dim={d} name={`${id}-${d}`} value={spec[d]} onChange={(v) => onChange(d, v)} />
          ))}
          <button type="button" className="btn btn-primary" onClick={() => setOpen(false)}>
            Done
          </button>
        </div>
      )}
    </div>
  );
}

// Adaptive condition: the system already changed something; the person can keep or undo it.
export function ChangeNote({ pending, spec, onKeep, onUndo }: { pending: Pending; spec: Spec; onKeep: () => void; onUndo: () => void }) {
  const parts = pending.change.dimensions.map((d) => phrase(spec[d]));
  return (
    <div className="system-note hl" role="status">
      <p>
        The planner changed: {joinPhrases(parts)}.
      </p>
      <div className="system-actions">
        <button type="button" className="btn btn-on-hl" data-ev="adaptation.keep" onClick={onKeep}>
          Keep
        </button>
        <button type="button" className="btn btn-on-hl-quiet" data-ev="adaptation.undo" onClick={onUndo}>
          Undo
        </button>
      </div>
    </div>
  );
}

function ProposalBody({ pending, onRespond }: { pending: Pending; onRespond: Respond }) {
  const [adjusting, setAdjusting] = useState(false);
  const { change, before } = pending;
  const [draft, setDraft] = useState<Spec>(change.offered[0]);
  const id = useId();

  if (adjusting) {
    return (
      <div className="proposal">
        {change.dimensions.map((d) => (
          <Choices key={d} dim={d} name={`${id}-${d}`} value={draft[d]} onChange={(v) => setDraft({ ...draft, [d]: v })} />
        ))}
        <div className="system-actions">
          <button type="button" className="btn btn-on-hl" data-ev="proposal.adjust" onClick={() => onRespond("adjust", draft)}>
            Use this
          </button>
          <button type="button" className="btn btn-on-hl-quiet" onClick={() => setAdjusting(false)}>
            Back
          </button>
        </div>
      </div>
    );
  }

  if (change.granularity === "single") {
    const dim = change.dimensions[0];
    const d = DIMENSIONS[dim];
    const currentLabel = d.variations.find((v) => v.id === before[dim])?.label;
    const coversAll = change.offered.length === d.variations.length - 1;
    return (
      <div className="proposal">
        <p className="proposal-q">{d.question}</p>
        <div className="system-actions">
          {change.offered.map((s) => {
            const v = d.variations.find((x) => x.id === s[dim])!;
            return (
              <button key={v.id} type="button" className="btn btn-on-hl" data-ev="proposal.accept" onClick={() => onRespond("accept", s)}>
                {v.label}
              </button>
            );
          })}
          <button type="button" className="btn btn-on-hl-quiet" data-ev="proposal.reject" onClick={() => onRespond("reject", null)}>
            Keep {currentLabel?.toLowerCase()}
          </button>
          {!coversAll && (
            <button type="button" className="btn-link" data-ev="proposal.other" onClick={() => setAdjusting(true)}>
              Other options
            </button>
          )}
        </div>
      </div>
    );
  }

  const offered = change.offered[0];
  return (
    <div className="proposal proposal-whole">
      <SpecSketch spec={offered} size="small" />
      <div>
        <p className="proposal-q">Try a different setup?</p>
        <p className="proposal-detail">{capitalize(joinPhrases(change.dimensions.map((d) => phrase(offered[d]))))}.</p>
        <div className="system-actions">
          <button type="button" className="btn btn-on-hl" data-ev="proposal.accept" onClick={() => onRespond("accept", offered)}>
            Try it
          </button>
          <button type="button" className="btn btn-on-hl-quiet" data-ev="proposal.reject" onClick={() => onRespond("reject", null)}>
            No thanks
          </button>
          <button type="button" className="btn-link" data-ev="proposal.other" onClick={() => setAdjusting(true)}>
            Other options
          </button>
        </div>
      </div>
    </div>
  );
}

const AFFECT: { id: Affect; label: string }[] = [
  { id: "glad", label: "Glad it did" },
  { id: "neutral", label: "No opinion" },
  { id: "annoyed", label: "Rather it hadn't" },
];

function AffectAsk({ onAffect }: { onAffect: (a: Affect | null) => void }) {
  return (
    <div className="proposal">
      <p className="proposal-q">Were you glad this suggestion came up?</p>
      <div className="system-actions">
        {AFFECT.map((a) => (
          <button key={a.id} type="button" className="btn btn-on-hl" data-ev={`affect.${a.id}`} onClick={() => onAffect(a.id)}>
            {a.label}
          </button>
        ))}
        <button type="button" className="btn-link" data-ev="affect.skip" onClick={() => onAffect(null)}>
          Skip
        </button>
      </div>
    </div>
  );
}

function ProposalOrAffect({ pending, onRespond, onAffect }: { pending: Pending; onRespond: Respond; onAffect: (a: Affect | null) => void }): ReactNode {
  return pending.stage === "affect" ? <AffectAsk onAffect={onAffect} /> : <ProposalBody pending={pending} onRespond={onRespond} />;
}

// Mixed-initiative, "ask" presentation: an explicit question above the courses.
export function AskBanner({ pending, onRespond, onAffect }: { pending: Pending; spec: Spec; onRespond: Respond; onAffect: (a: Affect | null) => void }) {
  return (
    <section className="ask-banner hl" aria-label="Suggestion">
      <ProposalOrAffect pending={pending} onRespond={onRespond} onAffect={onAffect} />
    </section>
  );
}

// Mixed-initiative, "hint" and "request" presentations: the proposal waits behind a button.
// A hint marks the button; a request leaves it plain apart from the count.
export function SuggestionsButton({
  pending,
  onOpen,
  onRespond,
  onAffect,
}: {
  pending: Pending | null;
  spec: Spec;
  onOpen: () => void;
  onRespond: Respond;
  onAffect: (a: Affect | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const ref = useDismiss(open, () => setOpen(false));
  const waiting = pending && pending.stage === "open" && !pending.opened;
  const hinted = waiting && pending.presentation === "hint";
  const visibleOpen = open && pending !== null;

  return (
    <div className="pop-anchor" ref={ref}>
      <button
        type="button"
        className={hinted ? "btn btn-secondary suggestion-btn hl-mark" : "btn btn-secondary suggestion-btn"}
        aria-expanded={visibleOpen}
        aria-controls={id}
        disabled={!pending}
        data-ev="suggestions.toggle"
        onClick={() => {
          if (!open) onOpen();
          setOpen(!open);
        }}
      >
        {waiting ? "Suggestions (1)" : "Suggestions"}
      </button>
      {hinted && <span className="hint-note">One idea for this step</span>}
      {visibleOpen && (
        <div className="pop hl" id={id} role="dialog" aria-label="Suggestion">
          <ProposalOrAffect
            pending={pending}
            onRespond={onRespond}
            onAffect={(a) => {
              onAffect(a);
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}
