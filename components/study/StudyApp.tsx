"use client";

import { useEffect, useRef, useState } from "react";
import { DATASETS } from "@/lib/catalog/courses.ts";
import { Recorder } from "@/lib/client/recorder.ts";
import { DEFAULT_SPEC, INTERFACE_DIMENSIONS, type DimensionId, type Spec } from "@/lib/study/dimensions.ts";
import { differsFromDefault, interfaceChanges } from "@/lib/study/describe.ts";
import type { Affect, Observation } from "@/lib/study/events.ts";
import { drawAll, type Evidence } from "@/lib/study/model.ts";
import { dimensionsAt, pickPresentation, planChange, type Change } from "@/lib/study/propose.ts";
import { hashString, mulberry32 } from "@/lib/study/rng.ts";
import { normalizeCode, type SessionConfig } from "@/lib/study/session.ts";
import { TASKS_BY_ID, type StepKind } from "@/lib/study/tasks.ts";
import { Planner } from "../planner/Planner.tsx";
import { Briefing } from "./Briefing.tsx";
import { Consent } from "./Consent.tsx";
import { Done } from "./Done.tsx";
import { Entry } from "./Entry.tsx";
import { Pairwise } from "./Pairwise.tsx";
import { Survey, type SurveyAnswers } from "./Survey.tsx";
import { AskBanner, ChangeNote, SuggestionsButton, ViewMenu } from "./SystemVoice.tsx";
import { TaskSlip } from "./TaskSlip.tsx";

const RUN_KEY = "ui-abtesting:run";

export type Pending = {
  kind: "proposal" | "adaptive";
  change: Change;
  before: Spec;
  presentation: string | null;
  shownAt: number;
  opened: boolean;
  stage: "open" | "affect";
};

type Run = {
  session: SessionConfig;
  phase: "briefing" | "task" | "pairwise" | "survey" | "done";
  taskIndex: number;
  stepIndex: number;
  spec: Spec;
  specVersion: number;
  plan: string[];
  objective: string | null;
  changeCount: number;
  systemChange: number;
  pending: Pending | null;
  taskStartedAt: number;
  stepStartedAt: number;
};

type Gate = { phase: "entry" } | { phase: "consent"; code: string } | { phase: "finished"; totalSessions: number };

function stepOrdinal(session: SessionConfig, taskIndex: number, stepIndex: number): number {
  return session.taskIds.slice(0, taskIndex).reduce((n, id) => n + TASKS_BY_ID[id].steps.length, 0) + stepIndex;
}

// The recorder and the sampler's evidence for one session. Evidence grows as the person acts.
type Live = { rec: Recorder; evidence: Evidence };

function makeLive(session: SessionConfig): Live {
  return {
    rec: new Recorder({ participantId: session.participantId, sessionId: session.sessionId, condition: session.condition }),
    evidence: { person: [...session.evidence.person], population: session.evidence.population },
  };
}

// Picks up a session in progress after a reload, from the snapshot written on every change.
function restore(): { run: Run; live: Live } | null {
  const raw = sessionStorage.getItem(RUN_KEY);
  if (!raw) return null;
  const run = JSON.parse(raw) as Run;
  const live = makeLive(run.session);
  const task = TASKS_BY_ID[run.session.taskIds[run.taskIndex]];
  live.rec.setSpecVersion(run.specVersion);
  live.rec.setContext({
    taskId: run.phase === "task" ? task.id : null,
    subtaskId: run.phase === "task" ? task.steps[run.stepIndex].id : null,
    objective: run.objective ? `focus:${run.objective}` : null,
    objectiveSource: run.objective ? "stated" : null,
  });
  return { run, live };
}

export function StudyApp() {
  const [restored] = useState(restore);
  const [gate, setGate] = useState<Gate>({ phase: "entry" });
  const [run, setRun] = useState<Run | null>(restored?.run ?? null);
  const [live, setLive] = useState<Live | null>(restored?.live ?? null);
  const runRef = useRef<Run | null>(run);

  useEffect(() => {
    if (!live) return;
    const stopObserving = live.rec.onObserve((o: Observation) => live.evidence.person.push(o));
    const stop = live.rec.start();
    return () => (stop(), stopObserving());
  }, [live]);

  useEffect(() => {
    if (!restored) return;
    const { run: r, live: l } = restored;
    l.rec.emit("session.resume", { phase: r.phase, taskIndex: r.taskIndex, stepIndex: r.stepIndex });
  }, [restored]);

  function commit(next: Run) {
    runRef.current = next;
    setRun(next);
    sessionStorage.setItem(RUN_KEY, JSON.stringify(next));
  }

  const rec = live?.rec;

  if (!run || !rec) {
    if (gate.phase === "consent") {
      return <Consent code={gate.code} onAgree={() => begin(gate.code, true)} onBack={() => setGate({ phase: "entry" })} />;
    }
    if (gate.phase === "finished") return <Done finishedAll totalSessions={gate.totalSessions} />;
    return <Entry onSubmit={(code) => begin(code, false)} />;
  }

  // ---- session lifecycle ----

  async function begin(input: string, consent: boolean): Promise<string | null> {
    const code = normalizeCode(input);
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code, consent }),
    }).catch(() => null);
    if (!res) return "The study server can't be reached. Check your connection and try again.";
    const body = await res.json();
    if (!res.ok) return body.error ?? "Something went wrong starting the session. Try again.";
    if (body.status === "consent") {
      setGate({ phase: "consent", code });
      return null;
    }
    if (body.status === "finished") {
      setGate({ phase: "finished", totalSessions: body.totalSessions });
      return null;
    }
    const session = body.session as SessionConfig;
    const l = makeLive(session);
    const r = l.rec;
    if (consent) r.emit("consent.given", {});
    r.emit("session.start", {
      sessionNumber: session.sessionNumber,
      taskIds: session.taskIds,
      wallClockStart: r.startWall,
      spec: DEFAULT_SPEC,
      viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
      finePointer: matchMedia("(pointer: fine)").matches,
      reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
      userAgent: navigator.userAgent,
      priorObservations: session.evidence.person.length,
    });
    setLive(l);
    commit({
      session,
      phase: "briefing",
      taskIndex: 0,
      stepIndex: 0,
      spec: DEFAULT_SPEC,
      specVersion: 0,
      plan: [],
      objective: null,
      changeCount: 0,
      systemChange: 0,
      pending: null,
      taskStartedAt: 0,
      stepStartedAt: 0,
    });
    return null;
  }

  function current(): Run {
    return runRef.current!;
  }

  function stepKind(r: Run): StepKind {
    return TASKS_BY_ID[r.session.taskIds[r.taskIndex]].steps[r.stepIndex].kind;
  }

  // ---- interface state ----

  function applySpec(r: Run, after: Spec, initiator: "user" | "system" | "proposal", extra: Record<string, unknown> = {}): Run {
    const changed = (Object.keys(after) as DimensionId[]).filter((d) => after[d] !== r.spec[d]);
    if (changed.length === 0) return r;
    const specVersion = r.specVersion + 1;
    rec!.setSpecVersion(specVersion);
    rec!.emit("spec.change", { before: r.spec, after, changed, initiator, ...extra });
    const visible = initiator === "system" && interfaceChanges(r.spec, after).length > 0;
    return { ...r, spec: after, specVersion, systemChange: r.systemChange + (visible ? 1 : 0) };
  }

  function observe(r: Run, spec: Spec, dims: DimensionId[], outcome: 0 | 1, source: Observation["source"]) {
    for (const d of dims) rec!.observe({ dimension: d, variation: spec[d], contextKey: stepKind(r), outcome, source });
  }

  // ---- tasks and steps ----

  function enterStep(r: Run, taskIndex: number, stepIndex: number): Run {
    const task = TASKS_BY_ID[r.session.taskIds[taskIndex]];
    const step = task.steps[stepIndex];
    rec!.setContext({ taskId: task.id, subtaskId: step.id, objective: null, objectiveSource: null });
    rec!.emit("step.start", { kind: step.kind, index: stepIndex });
    let next: Run = { ...r, taskIndex, stepIndex, objective: null, stepStartedAt: rec!.now(), pending: null };

    const ordinal = stepOrdinal(r.session, taskIndex, stepIndex);
    const condition = r.session.condition;
    if (ordinal === 0 || condition === "adaptable") return next;

    const { sessionId } = r.session;
    const rng = mulberry32(hashString(`${sessionId}:${ordinal}`));
    const draws = drawAll(live!.evidence, step.kind, rng, Date.now());
    const change = planChange({
      id: `${sessionId}:${ordinal}`,
      current: next.spec,
      draws,
      rng,
      dimensions: dimensionsAt(next.changeCount, mulberry32(hashString(sessionId))),
      maxOffered: condition === "mixed-initiative" ? 2 : 1,
    });
    next = { ...next, changeCount: next.changeCount + 1 };
    const logged = {
      granularity: change.granularity,
      dimensions: change.dimensions,
      offered: change.offered.map((s) => Object.fromEntries(change.dimensions.map((d) => [d, s[d]]))),
      current: Object.fromEntries(change.dimensions.map((d) => [d, next.spec[d]])),
      order: change.order,
      l9Row: change.l9Row,
      draws,
    };

    if (condition === "adaptive") {
      const before = next.spec;
      next = applySpec(next, { ...change.offered[0], proposalStyle: before.proposalStyle }, "system", { changeId: change.id });
      rec!.emit("adaptation.applied", { changeId: change.id, ...logged });
      return { ...next, pending: { kind: "adaptive", change, before, presentation: null, shownAt: rec!.now(), opened: true, stage: "open" } };
    }

    const presentation = pickPresentation(draws);
    next = applySpec(next, { ...next.spec, proposalStyle: presentation }, "system", { reason: "presentation", proposalId: change.id });
    rec!.emit("proposal.shown", { proposalId: change.id, presentation, ...logged });
    return {
      ...next,
      pending: { kind: "proposal", change, before: next.spec, presentation, shownAt: rec!.now(), opened: presentation === "ask", stage: "open" },
    };
  }

  // Closes out whatever the system offered during the step that is ending.
  function settle(r: Run): Run {
    const p = r.pending;
    if (!p) return r;
    const ms = Math.round(rec!.now() - p.shownAt);
    if (p.kind === "adaptive" && p.stage === "open") {
      rec!.emit("adaptation.respond", { changeId: p.change.id, response: "keep", explicit: false, ms });
      observe(r, r.spec, p.change.dimensions, 1, "adaptive-keep");
    }
    if (p.kind === "proposal" && p.stage === "open") {
      rec!.emit("proposal.respond", { proposalId: p.change.id, response: "ignore", chosen: null, opened: p.opened, ms, affect: null });
    }
    return { ...r, pending: null };
  }

  function startTask(r: Run, taskIndex: number): Run {
    const task = TASKS_BY_ID[r.session.taskIds[taskIndex]];
    rec!.setContext({ taskId: task.id, subtaskId: null, objective: null, objectiveSource: null });
    rec!.emit("task.start", { taskId: task.id, datasetId: task.datasetId, index: taskIndex, spec: r.spec });
    return enterStep({ ...r, phase: "task", plan: [], taskStartedAt: rec!.now() }, taskIndex, 0);
  }

  function nextTaskOrSurvey(r: Run): Run {
    if (r.taskIndex + 1 < r.session.taskIds.length) return startTask(r, r.taskIndex + 1);
    rec!.setContext({ taskId: null, subtaskId: null, objective: null, objectiveSource: null });
    rec!.emit("survey.start", {});
    return { ...r, phase: "survey" };
  }

  function finishStep() {
    let r = settle(current());
    rec!.emit("step.end", { ms: Math.round(rec!.now() - r.stepStartedAt) });
    r = enterStep(r, r.taskIndex, r.stepIndex + 1);
    commit(r);
  }

  function submitPlan() {
    let r = settle(current());
    const task = TASKS_BY_ID[r.session.taskIds[r.taskIndex]];
    const courses = DATASETS[task.datasetId].courses.filter((c) => r.plan.includes(c.id));
    const success = task.check(courses);
    rec!.emit("step.end", { ms: Math.round(rec!.now() - r.stepStartedAt) });
    rec!.emit("task.end", {
      success,
      plan: r.plan,
      credits: courses.reduce((s, c) => s + c.credits, 0),
      stepsSeen: r.stepIndex + 1,
      ms: Math.round(rec!.now() - r.taskStartedAt),
      spec: r.spec,
    });
    rec!.setContext({ taskId: task.id, subtaskId: null, objective: null, objectiveSource: null });
    r = differsFromDefault(r.spec, DEFAULT_SPEC) ? { ...r, phase: "pairwise" } : nextTaskOrSurvey(r);
    commit(r);
  }

  function togglePlan(courseId: string, add: boolean, source: string) {
    const r = current();
    rec!.emit(add ? "plan.add" : "plan.remove", { courseId, source });
    commit({ ...r, plan: add ? [...r.plan, courseId] : r.plan.filter((id) => id !== courseId) });
  }

  function setObjective(id: string) {
    const r = current();
    rec!.setObjective(`focus:${id}`);
    rec!.emit("objective.state", { objective: `focus:${id}`, kind: stepKind(r) });
    commit({ ...r, objective: id });
  }

  // ---- condition-specific responses ----

  function changeView(dim: DimensionId, value: string) {
    const r = current();
    const before = r.spec;
    const next = applySpec(r, { ...before, [dim]: value }, "user", { via: "view-menu" });
    observe(r, next.spec, [dim], 1, "choice");
    observe(r, before, [dim], 0, "choice");
    commit(next);
  }

  function openProposal() {
    const r = current();
    if (!r.pending || r.pending.opened) return;
    rec!.emit("proposal.opened", { proposalId: r.pending.change.id, ms: Math.round(rec!.now() - r.pending.shownAt) });
    commit({ ...r, pending: { ...r.pending, opened: true } });
  }

  function respond(response: "accept" | "reject" | "adjust", chosen: Spec | null) {
    const r = current();
    const p = r.pending;
    if (!p) return;
    const ms = Math.round(rec!.now() - p.shownAt);
    const dims = p.change.dimensions;
    let next = r;
    if (chosen) {
      next = applySpec(r, { ...chosen, proposalStyle: r.spec.proposalStyle }, "proposal", { proposalId: p.change.id, response });
      observe(r, chosen, dims.filter((d) => chosen[d] !== p.before[d]), 1, "proposal");
    }
    for (const offered of p.change.offered) {
      const rejected = dims.filter((d) => offered[d] !== p.before[d] && (!chosen || offered[d] !== chosen[d]));
      observe(r, offered, rejected, 0, "proposal");
    }
    rec!.emit("proposal.respond", {
      proposalId: p.change.id,
      response,
      chosen: chosen ? Object.fromEntries(dims.map((d) => [d, chosen[d]])) : null,
      opened: true,
      ms,
      affect: null,
    });
    commit({ ...next, pending: { ...p, opened: true, stage: "affect" } });
  }

  function recordAffect(affect: Affect | null) {
    const r = current();
    const p = r.pending;
    if (!p) return;
    rec!.emit("proposal.affect", { proposalId: p.change.id, presentation: p.presentation, affect });
    if (affect === "glad" || affect === "annoyed") {
      rec!.observe({ dimension: "proposalStyle", variation: p.presentation!, contextKey: stepKind(r), outcome: affect === "glad" ? 1 : 0, source: "affect" });
    }
    commit({ ...r, pending: null });
  }

  function keepChange() {
    const r = current();
    const p = r.pending;
    if (!p) return;
    rec!.emit("adaptation.respond", { changeId: p.change.id, response: "keep", explicit: true, ms: Math.round(rec!.now() - p.shownAt) });
    observe(r, r.spec, p.change.dimensions, 1, "adaptive-keep");
    commit({ ...r, pending: null });
  }

  function undoChange() {
    const r = current();
    const p = r.pending;
    if (!p) return;
    const reverted = { ...r.spec };
    for (const d of p.change.dimensions) reverted[d] = p.before[d];
    const next = applySpec(r, reverted, "user", { revertOf: p.change.id });
    rec!.emit("adaptation.respond", { changeId: p.change.id, response: "revert", explicit: true, ms: Math.round(rec!.now() - p.shownAt) });
    observe(r, r.spec, p.change.dimensions, 0, "adaptive-revert");
    commit({ ...next, pending: null });
  }

  // ---- after tasks ----

  function answerPairwise(choice: string, order: string[]) {
    const r = current();
    rec!.emit("survey.response", {
      instrument: "pairwise",
      taskId: r.session.taskIds[r.taskIndex],
      choice,
      order,
      final: Object.fromEntries(INTERFACE_DIMENSIONS.map((d) => [d, r.spec[d]])),
      reference: Object.fromEntries(INTERFACE_DIMENSIONS.map((d) => [d, DEFAULT_SPEC[d]])),
    });
    commit(nextTaskOrSurvey(r));
  }

  async function finishSurvey(answers: SurveyAnswers) {
    const r = current();
    rec!.emit("survey.response", { instrument: "nasa-tlx", answers: answers.tlx });
    rec!.emit("survey.response", { instrument: "sus", answers: answers.sus });
    if (answers.suggestionStyle) rec!.emit("survey.response", { instrument: "suggestion-style", choice: answers.suggestionStyle });
    if (answers.comment.trim()) rec!.emit("survey.response", { instrument: "comment", text: answers.comment.trim() });
    rec!.emit("session.end", { ms: Math.round(rec!.now()) });
    await rec!.flush();
    sessionStorage.removeItem(RUN_KEY);
    runRef.current = { ...r, phase: "done" };
    setRun(runRef.current);
  }

  // ---- render ----

  const { session } = run;

  if (run.phase === "briefing") {
    return <Briefing session={session} onStart={() => commit(startTask(current(), 0))} />;
  }
  if (run.phase === "pairwise") {
    return <Pairwise spec={run.spec} reference={DEFAULT_SPEC} seed={`${session.sessionId}:${run.taskIndex}`} onAnswer={answerPairwise} />;
  }
  if (run.phase === "survey") {
    return <Survey condition={session.condition} onSubmit={finishSurvey} />;
  }
  if (run.phase === "done") {
    return <Done sessionNumber={session.sessionNumber} totalSessions={session.totalSessions} />;
  }

  const task = TASKS_BY_ID[session.taskIds[run.taskIndex]];
  const pending = run.pending;
  const condition = session.condition;

  const tools =
    condition === "adaptable" ? (
      <ViewMenu spec={run.spec} onChange={changeView} onOpen={() => rec.emit("view.open", {})} />
    ) : condition === "adaptive" ? (
      pending?.kind === "adaptive" && <ChangeNote pending={pending} spec={run.spec} onKeep={keepChange} onUndo={undoChange} />
    ) : (
      <SuggestionsButton
        pending={pending?.kind === "proposal" && pending.presentation !== "ask" ? pending : null}
        spec={run.spec}
        onOpen={openProposal}
        onRespond={respond}
        onAffect={recordAffect}
      />
    );

  const banner =
    condition === "mixed-initiative" && pending?.kind === "proposal" && pending.presentation === "ask" ? (
      <AskBanner pending={pending} spec={run.spec} onRespond={respond} onAffect={recordAffect} />
    ) : undefined;

  return (
    <div className="study-frame">
      <TaskSlip
        task={task}
        taskIndex={run.taskIndex}
        taskCount={session.taskIds.length}
        stepIndex={run.stepIndex}
        objective={run.objective}
        planSize={run.plan.length}
        onObjective={setObjective}
        onNextStep={finishStep}
        onSubmit={submitPlan}
      />
      <Planner
        key={task.id}
        dataset={DATASETS[task.datasetId]}
        spec={run.spec}
        plan={run.plan}
        onToggle={togglePlan}
        rec={rec}
        tools={tools}
        banner={banner}
        systemChange={run.systemChange}
      />
    </div>
  );
}
