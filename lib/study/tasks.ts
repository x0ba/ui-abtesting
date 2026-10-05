import { DATASETS, overlaps, seatsLeft, type Course } from "../catalog/courses.ts";

export type StepKind = "narrow" | "compare" | "inspect" | "decide";

export type Step = {
  id: string;
  kind: StepKind;
  instruction: string;
};

export type Task = {
  id: string;
  datasetId: keyof typeof DATASETS;
  title: string;
  brief: string;
  steps: Step[];
  check: (plan: Course[]) => boolean;
};

const open = (c: Course) => seatsLeft(c) > 0 && c.prereqs.length === 0;
const meetsOnlyTueThu = (c: Course) => c.days.length > 0 && c.days.every((d) => d === "Tue" || d === "Thu");
const noClashes = (plan: Course[]) => plan.every((a, i) => plan.slice(i + 1).every((b) => !overlaps(a, b)));
const credits = (plan: Course[]) => plan.reduce((s, c) => s + c.credits, 0);

function best(courses: Course[], score: (c: Course) => number): Course[] {
  const top = Math.max(...courses.map(score));
  return courses.filter((c) => score(c) === top);
}

function isOneOf(plan: Course[], answers: Course[]): boolean {
  return plan.length === 1 && answers.some((a) => a.id === plan[0].id);
}

const H = DATASETS.humanities.courses;
const S = DATASETS.sciences.courses;
const O = DATASETS.social.courses;

export const TASKS: Task[] = [
  {
    id: "h-tuesday",
    datasetId: "humanities",
    title: "Keep Mondays, Wednesdays and Fridays free",
    brief:
      "You work three days a week. Find a course that meets only on Tuesdays and Thursdays, or is online. It needs open seats and no prerequisites. Add the best-rated one.",
    steps: [
      { id: "h-tuesday.1", kind: "narrow", instruction: "Find courses that meet only on Tuesday and Thursday, or online, and still have seats." },
      { id: "h-tuesday.2", kind: "inspect", instruction: "Check which of those have no prerequisites." },
      { id: "h-tuesday.3", kind: "decide", instruction: "Add the best-rated one to your plan, then submit." },
    ],
    check: (plan) => isOneOf(plan, best(H.filter((c) => open(c) && (meetsOnlyTueThu(c) || c.format === "Online")), (c) => c.rating)),
  },
  {
    id: "h-writing",
    datasetId: "humanities",
    title: "A light Writing course",
    brief:
      "Your degree needs a Writing course, but this term is already busy. Pick the Writing course with the lightest workload that has open seats and no prerequisites.",
    steps: [
      { id: "h-writing.1", kind: "narrow", instruction: "Find Writing courses that have open seats and no prerequisites." },
      { id: "h-writing.2", kind: "compare", instruction: "Compare their weekly workload." },
      { id: "h-writing.3", kind: "decide", instruction: "Add the lightest one to your plan, then submit." },
    ],
    check: (plan) => isOneOf(plan, best(H.filter((c) => open(c) && c.requirements.includes("Writing")), (c) => -c.workload)),
  },
  {
    id: "h-pair",
    datasetId: "humanities",
    title: "Two courses that fit together",
    brief:
      "Plan two courses that count for Arts or Ethics. Together they should add up to at least 7 credits, they must not meet at the same time, and both need open seats and no prerequisites.",
    steps: [
      { id: "h-pair.1", kind: "narrow", instruction: "Find Arts and Ethics courses with open seats and no prerequisites." },
      { id: "h-pair.2", kind: "compare", instruction: "Compare their credits and meeting times." },
      { id: "h-pair.3", kind: "decide", instruction: "Add two that fit together, then submit." },
    ],
    check: (plan) =>
      plan.length === 2 &&
      plan.every((c) => open(c) && (c.requirements.includes("Arts") || c.requirements.includes("Ethics"))) &&
      credits(plan) >= 7 &&
      noClashes(plan),
  },
  {
    id: "s-lab",
    datasetId: "sciences",
    title: "A lab science people like",
    brief: "Your degree needs a Lab science course. Of the lab courses with open seats and no prerequisites, add the best-rated one.",
    steps: [
      { id: "s-lab.1", kind: "narrow", instruction: "Find Lab science courses with open seats." },
      { id: "s-lab.2", kind: "inspect", instruction: "Check which of them have no prerequisites." },
      { id: "s-lab.3", kind: "compare", instruction: "Compare their ratings." },
      { id: "s-lab.4", kind: "decide", instruction: "Add the best-rated one to your plan, then submit." },
    ],
    check: (plan) => isOneOf(plan, best(S.filter((c) => open(c) && c.requirements.includes("Lab science")), (c) => c.rating)),
  },
  {
    id: "s-evening",
    datasetId: "sciences",
    title: "Quantitative, after work",
    brief:
      "You can only take classes that start at 5pm or later, or online ones. Find a Quantitative course that fits, with open seats and no prerequisites, and add the one with the lightest workload.",
    steps: [
      { id: "s-evening.1", kind: "narrow", instruction: "Find Quantitative courses that start at 5pm or later, or are online." },
      { id: "s-evening.2", kind: "inspect", instruction: "Check seats and prerequisites." },
      { id: "s-evening.3", kind: "decide", instruction: "Add the one with the lightest workload, then submit." },
    ],
    check: (plan) =>
      isOneOf(
        plan,
        best(
          S.filter((c) => open(c) && c.requirements.includes("Quantitative") && (c.format === "Online" || (c.start ?? 0) >= 17 * 60)),
          (c) => -c.workload,
        ),
      ),
  },
  {
    id: "s-twelve",
    datasetId: "sciences",
    title: "Twelve credits of computing and math",
    brief:
      "Build a schedule of exactly 12 credits from Computer Science and Mathematics courses. Every course needs open seats and no prerequisites, and no two can meet at the same time.",
    steps: [
      { id: "s-twelve.1", kind: "narrow", instruction: "Find Computer Science and Mathematics courses with open seats and no prerequisites." },
      { id: "s-twelve.2", kind: "compare", instruction: "Compare credits and meeting times." },
      { id: "s-twelve.3", kind: "decide", instruction: "Add courses that total exactly 12 credits without clashes, then submit." },
    ],
    check: (plan) =>
      plan.length > 0 &&
      plan.every((c) => open(c) && (c.dept === "CS" || c.dept === "MATH")) &&
      credits(plan) === 12 &&
      noClashes(plan),
  },
  {
    id: "o-friday",
    datasetId: "social",
    title: "Fridays off",
    brief:
      "You want Fridays free. Find a Psychology or Sociology course that does not meet on Friday, has open seats and no prerequisites, and add the best-rated one.",
    steps: [
      { id: "o-friday.1", kind: "narrow", instruction: "Find Psychology and Sociology courses that don't meet on Friday." },
      { id: "o-friday.2", kind: "inspect", instruction: "Check seats and prerequisites." },
      { id: "o-friday.3", kind: "compare", instruction: "Compare their ratings." },
      { id: "o-friday.4", kind: "decide", instruction: "Add the best-rated one to your plan, then submit." },
    ],
    check: (plan) =>
      isOneOf(
        plan,
        best(O.filter((c) => open(c) && (c.dept === "PSYC" || c.dept === "SOCI") && !c.days.includes("Fri")), (c) => c.rating),
      ),
  },
  {
    id: "o-seminar",
    datasetId: "social",
    title: "A small Economics class",
    brief:
      "You learn best in small groups. Find an Economics course with fewer than 25 seats in total, open seats and no prerequisites. If more than one fits, add the one with the lightest workload.",
    steps: [
      { id: "o-seminar.1", kind: "narrow", instruction: "Find Economics courses with open seats." },
      { id: "o-seminar.2", kind: "inspect", instruction: "Check class size and prerequisites." },
      { id: "o-seminar.3", kind: "decide", instruction: "Add the one that fits, then submit." },
    ],
    check: (plan) => isOneOf(plan, best(O.filter((c) => open(c) && c.dept === "ECON" && c.capacity < 25), (c) => -c.workload)),
  },
  {
    id: "o-pair",
    datasetId: "social",
    title: "Anthropology and politics",
    brief:
      "Plan one Anthropology course and one Political Science course. They must not meet at the same time, need open seats and no prerequisites, and should add up to at least 8 credits.",
    steps: [
      { id: "o-pair.1", kind: "narrow", instruction: "Find Anthropology and Political Science courses with open seats and no prerequisites." },
      { id: "o-pair.2", kind: "compare", instruction: "Compare their credits and meeting times." },
      { id: "o-pair.3", kind: "decide", instruction: "Add one of each that fit together, then submit." },
    ],
    check: (plan) =>
      plan.length === 2 &&
      plan.every(open) &&
      plan.some((c) => c.dept === "ANTH") &&
      plan.some((c) => c.dept === "POLS") &&
      credits(plan) >= 8 &&
      noClashes(plan),
  },
];

export const TASKS_BY_ID: Record<string, Task> = Object.fromEntries(TASKS.map((t) => [t.id, t]));

export const FOCUS_OPTIONS = [
  { id: "times", label: "Meeting times" },
  { id: "seats", label: "Open seats" },
  { id: "prereqs", label: "Prerequisites" },
  { id: "rating", label: "Ratings" },
  { id: "workload", label: "Workload" },
  { id: "credits", label: "Credits" },
] as const;
