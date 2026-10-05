import { z } from "zod";

export const CONDITIONS = ["adaptable", "mixed-initiative", "adaptive"] as const;
export type Condition = (typeof CONDITIONS)[number];

export const studyEventSchema = z.object({
  participantId: z.string().min(1),
  sessionId: z.uuid(),
  seq: z.number().int().nonnegative(),
  t: z.number(),
  condition: z.enum(CONDITIONS),
  context: z.object({
    taskId: z.string().nullable(),
    subtaskId: z.string().nullable(),
    objective: z.string().nullable(),
    objectiveSource: z.enum(["stated", "inferred"]).nullable(),
  }),
  specVersion: z.number().int().nonnegative(),
  type: z.string().min(1).max(64),
  payload: z.record(z.string(), z.unknown()),
});

export type StudyEvent = z.infer<typeof studyEventSchema>;

export const eventBatchSchema = z.object({
  events: z.array(studyEventSchema).min(1).max(500),
});

export type ProposalResponse = "accept" | "reject" | "adjust" | "ignore";
export type Affect = "glad" | "neutral" | "annoyed";

// One labeled preference outcome, emitted alongside the raw events that produced it
// so the next session's sampler can read evidence without replaying every trace.
export type Observation = {
  dimension: string;
  variation: string;
  contextKey: string;
  outcome: 0 | 1;
  source: "choice" | "proposal" | "adaptive-keep" | "adaptive-revert" | "affect";
  at: number; // epoch ms
};
