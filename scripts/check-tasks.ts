// Enumerates plans of up to four courses for every task and reports how many pass.
// Run after editing the catalog or tasks: every task needs at least one solution.
import { DATASETS, type Course } from "../lib/catalog/courses.ts";
import { TASKS } from "../lib/study/tasks.ts";

function* subsets(items: Course[], maxSize: number, start = 0, acc: Course[] = []): Generator<Course[]> {
  if (acc.length > 0) yield acc;
  if (acc.length === maxSize) return;
  for (let i = start; i < items.length; i++) yield* subsets(items, maxSize, i + 1, [...acc, items[i]]);
}

let failed = false;
for (const task of TASKS) {
  const solutions: string[] = [];
  for (const plan of subsets(DATASETS[task.datasetId].courses, 4)) {
    if (task.check(plan)) solutions.push(plan.map((c) => c.code).join(" + "));
  }
  const shown = solutions.slice(0, 4).join("; ") + (solutions.length > 4 ? "; ..." : "");
  console.log(`${task.id.padEnd(12)} ${String(solutions.length).padStart(4)} solutions  ${shown}`);
  if (solutions.length === 0) failed = true;
}
process.exit(failed ? 1 : 0);
