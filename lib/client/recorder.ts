import { STUDY } from "../study/config.ts";
import type { Condition, Observation, StudyEvent } from "../study/events.ts";
import { enqueue, peek, remove } from "./queue.ts";

export type EventContext = StudyEvent["context"];

type Meta = { participantId: string; sessionId: string; condition: Condition };

const seqKey = (sessionId: string) => `ui-abtesting:seq:${sessionId}`;
const startKey = (sessionId: string) => `ui-abtesting:start:${sessionId}`;

export class Recorder {
  readonly meta: Meta;
  readonly startWall: number;
  private context: EventContext = { taskId: null, subtaskId: null, objective: null, objectiveSource: null };
  private specVersion = 0;
  // Events not yet acknowledged by the server, mirrored here so sendBeacon can read them synchronously.
  private unacked = new Map<number, StudyEvent>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private flushing = false;
  private observers = new Set<(o: Observation) => void>();

  constructor(meta: Meta) {
    this.meta = meta;
    const storedStart = sessionStorage.getItem(startKey(meta.sessionId));
    this.startWall = storedStart ? Number(storedStart) : Date.now();
    sessionStorage.setItem(startKey(meta.sessionId), String(this.startWall));
  }

  setContext(context: EventContext): void {
    this.context = context;
  }

  setObjective(objective: string): void {
    this.context = { ...this.context, objective, objectiveSource: "stated" };
  }

  setSpecVersion(version: number): void {
    this.specVersion = version;
  }

  // Milliseconds since the session's wall-clock start, monotonic within a page load.
  now(): number {
    return performance.timeOrigin + performance.now() - this.startWall;
  }

  // Read and bump the stored counter on every call so two recorders for one session can never reuse a seq.
  private nextSeq(): number {
    const key = seqKey(this.meta.sessionId);
    const seq = Number(sessionStorage.getItem(key) ?? 0);
    sessionStorage.setItem(key, String(seq + 1));
    return seq;
  }

  emit(type: string, payload: Record<string, unknown> = {}): void {
    const event: StudyEvent = {
      participantId: this.meta.participantId,
      sessionId: this.meta.sessionId,
      seq: this.nextSeq(),
      t: Math.round(this.now() * 10) / 10,
      condition: this.meta.condition,
      context: { ...this.context },
      specVersion: this.specVersion,
      type,
      payload,
    };
    this.unacked.set(event.seq, event);
    void enqueue(event);
  }

  observe(observation: Omit<Observation, "at">): void {
    const full: Observation = { ...observation, at: Date.now() };
    this.emit("preference.observe", full);
    for (const fn of this.observers) fn(full);
  }

  onObserve(fn: (o: Observation) => void): () => void {
    this.observers.add(fn);
    return () => this.observers.delete(fn);
  }

  start(): () => void {
    this.timer = setInterval(() => void this.flush(), STUDY.recorder.flushIntervalMs);
    const onHide = () => this.beacon();
    const onVisibility = () => {
      this.emit("page.visibility", { state: document.visibilityState });
      if (document.visibilityState === "hidden") this.beacon();
    };
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onVisibility);
    void this.flush();
    return () => {
      if (this.timer) clearInterval(this.timer);
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }

  // Sends everything queued in IndexedDB, including leftovers from earlier sessions on this browser.
  async flush(): Promise<void> {
    if (this.flushing) return;
    this.flushing = true;
    try {
      for (;;) {
        const batch = await peek(STUDY.recorder.batchSize);
        if (batch.length === 0) return;
        const res = await fetch("/api/events", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ events: batch }),
          keepalive: true,
        });
        if (!res.ok) return;
        const keys = batch.map((e) => [e.sessionId, e.seq] as [string, number]);
        await remove(keys);
        for (const e of batch) if (e.sessionId === this.meta.sessionId) this.unacked.delete(e.seq);
        if (batch.length < STUDY.recorder.batchSize) return;
      }
    } catch {
      // Offline or server down: events stay in IndexedDB and go out on the next flush.
    } finally {
      this.flushing = false;
    }
  }

  beacon(): void {
    if (this.unacked.size === 0) return;
    const events = [...this.unacked.values()].slice(-500);
    navigator.sendBeacon("/api/events", JSON.stringify({ events }));
  }
}
