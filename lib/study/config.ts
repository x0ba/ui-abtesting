export const STUDY = {
  sessionsPerParticipant: 4,
  // "within": each participant meets every condition, one per session, in a counterbalanced order.
  // "between": each participant keeps one condition for every session.
  design: "within" as "within" | "between",
  tasksPerSession: 3,
  // How a proposal or automatic change is sized. Sampled per event and logged.
  granularity: [
    ["single", 0.6],
    ["whole", 0.2],
    ["mixed", 0.2],
  ] as const,
  hoverOpenDelayMs: 450,
  model: {
    decayPerDay: 0.1, // weight = e^(-decayPerDay * age in days)
    crossContextWeight: 0.3, // how much evidence from another step kind counts
    populationPriorStrength: 4, // pseudo-observations the population prior is worth at most
  },
  recorder: {
    flushIntervalMs: 2000,
    batchSize: 200,
  },
};

export type Granularity = (typeof STUDY.granularity)[number][0];
