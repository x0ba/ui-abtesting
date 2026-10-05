import { STUDY } from "./config.ts";
import { CONDITIONS, type Condition } from "./events.ts";
import { TASKS } from "./tasks.ts";

const CONDITION_ORDERS: Condition[][] = [
  [CONDITIONS[0], CONDITIONS[1], CONDITIONS[2]],
  [CONDITIONS[0], CONDITIONS[2], CONDITIONS[1]],
  [CONDITIONS[1], CONDITIONS[0], CONDITIONS[2]],
  [CONDITIONS[1], CONDITIONS[2], CONDITIONS[0]],
  [CONDITIONS[2], CONDITIONS[0], CONDITIONS[1]],
  [CONDITIONS[2], CONDITIONS[1], CONDITIONS[0]],
];

// Participants are counterbalanced by enrollment order (ordinal starts at 1).
export function conditionFor(ordinal: number, sessionNumber: number): Condition {
  const order = CONDITION_ORDERS[(ordinal - 1) % CONDITION_ORDERS.length];
  if (STUDY.design === "between") return order[0];
  return order[(sessionNumber - 1) % order.length];
}

const DATASET_ORDER = ["humanities", "sciences", "social"] as const;

// Each session has one task per dataset, so the same decisions recur over different data.
// Task variants rotate by session, and dataset order rotates by participant.
export function tasksFor(ordinal: number, sessionNumber: number): string[] {
  const datasets = DATASET_ORDER.map((_, i) => DATASET_ORDER[(i + ordinal - 1) % DATASET_ORDER.length]);
  return datasets.slice(0, STUDY.tasksPerSession).map((datasetId) => {
    const pool = TASKS.filter((t) => t.datasetId === datasetId);
    return pool[(sessionNumber - 1 + ordinal - 1) % pool.length].id;
  });
}
