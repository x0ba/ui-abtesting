import { hashString, mulberry32, pick, type Rng } from "../study/rng.ts";
import { BUILDINGS, DEPT_NAMES, HUMANITIES, INSTRUCTORS, SCIENCES, SOCIAL, type CourseSource } from "./source.ts";

export type Day = "Mon" | "Tue" | "Wed" | "Thu" | "Fri";
export type Format = "In person" | "Hybrid" | "Online";
export type Requirement = "Writing" | "Quantitative" | "Lab science" | "Global" | "Arts" | "Ethics";

export type Course = {
  id: string;
  dept: string;
  deptName: string;
  number: number;
  code: string;
  title: string;
  blurb: string;
  instructor: string;
  credits: number;
  level: number;
  format: Format;
  days: Day[];
  start: number | null; // minutes after midnight; null for online courses with no meetings
  end: number | null;
  room: string | null;
  seatsTaken: number;
  capacity: number;
  rating: number;
  reviews: number;
  workload: number; // hours a week outside class
  prereqs: string[];
  requirements: Requirement[];
};

export type Dataset = {
  id: string;
  name: string;
  courses: Course[];
};

const MEETING_PATTERNS: { days: Day[]; length: number }[] = [
  { days: ["Mon", "Wed"], length: 75 },
  { days: ["Tue", "Thu"], length: 75 },
  { days: ["Mon", "Wed", "Fri"], length: 50 },
  { days: ["Fri"], length: 170 },
];
const STARTS = [8 * 60, 9 * 60 + 30, 11 * 60, 12 * 60 + 30, 14 * 60, 15 * 60 + 30, 17 * 60, 18 * 60 + 30];

const DEPT_REQUIREMENTS: Record<string, Requirement[]> = {
  ARTH: ["Arts"], ENGL: ["Writing"], HIST: ["Global"], PHIL: ["Ethics"], MUSC: ["Arts"],
  BIOL: [], CHEM: [], CS: ["Quantitative"], MATH: ["Quantitative"], PHYS: [],
  ANTH: ["Global"], ECON: [], POLS: [], PSYC: [], SOCI: [],
};
const LAB = /lab|Kitchen|Microbiology|General Chemistry|Physics I|Cells and Genes/i;

function weighted<T>(rng: Rng, options: readonly (readonly [T, number])[]): T {
  const total = options.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [value, w] of options) {
    r -= w;
    if (r <= 0) return value;
  }
  return options[options.length - 1][0];
}

function build(source: readonly CourseSource[]): Course[] {
  const courses: Course[] = [];
  for (const [dept, number, title, blurb] of source) {
    const code = `${dept} ${number}`;
    const rng = mulberry32(hashString(code));
    const level = Math.floor(number / 100) * 100;

    const isLab = LAB.test(title) || LAB.test(blurb);
    const drawnFormat = weighted<Format>(rng, [["In person", 70], ["Hybrid", 15], ["Online", 15]]);
    const format = isLab ? "In person" : drawnFormat;
    const pattern = pick(MEETING_PATTERNS, rng);
    const start = format === "Online" ? null : pick(STARTS, rng);
    const end = start === null ? null : start + pattern.length;
    const days = format === "Online" ? [] : pattern.days;

    const credits = weighted(rng, [[2, 10], [3, 35], [4, 45], [5, 10]] as const);
    const capacity = level >= 300 ? 12 + Math.floor(rng() * 14) : level === 200 ? 20 + Math.floor(rng() * 30) : 30 + Math.floor(rng() * 90);
    const fill = weighted(rng, [[1, 12], [0.9, 18], [0.7, 30], [0.45, 40]] as const);
    const seatsTaken = Math.min(capacity, Math.round(capacity * (fill === 1 ? 1 : fill + rng() * 0.12)));

    const rating = Math.round((2.7 + rng() * 2.2) * 10) / 10;
    const reviews = 4 + Math.floor(rng() * (level === 100 ? 180 : 60));
    const workload = Math.max(2, Math.min(16, Math.round(2 + credits * 1.2 + (level / 100) * 1.1 + (rng() - 0.5) * 6)));

    const earlier = courses.filter((c) => c.dept === dept && c.level < level);
    const prereqs = level >= 200 && earlier.length > 0 && rng() < 0.65 ? [pick(earlier, rng).code] : [];

    const requirements = new Set<Requirement>(DEPT_REQUIREMENTS[dept] ?? []);
    if (isLab) requirements.add("Lab science");
    if (rng() < 0.18) requirements.add(pick(["Writing", "Global", "Ethics"] as const, rng));

    courses.push({
      id: code.replace(" ", "-").toLowerCase(),
      dept,
      deptName: DEPT_NAMES[dept],
      number,
      code,
      title,
      blurb,
      instructor: pick(INSTRUCTORS, rng),
      credits,
      level,
      format,
      days,
      start,
      end,
      room: format === "Online" ? null : `${pick(BUILDINGS, rng)} ${100 + Math.floor(rng() * 300)}`,
      seatsTaken,
      capacity,
      rating,
      reviews,
      workload,
      prereqs,
      requirements: [...requirements],
    });
  }
  return courses;
}

export const DATASETS: Record<string, Dataset> = {
  humanities: { id: "humanities", name: "Arts and humanities", courses: build(HUMANITIES) },
  sciences: { id: "sciences", name: "Sciences and engineering", courses: build(SCIENCES) },
  social: { id: "social", name: "Social sciences", courses: build(SOCIAL) },
};

export function seatsLeft(c: Course): number {
  return c.capacity - c.seatsTaken;
}

export function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12}${suffix}` : `${h12}:${String(m).padStart(2, "0")}${suffix}`;
}

export function formatMeeting(c: Course): string {
  if (c.start === null || c.end === null) return "Online, no set meeting time";
  return `${c.days.join(" ")} ${formatTime(c.start)} to ${formatTime(c.end)}`;
}

export function overlaps(a: Course, b: Course): boolean {
  if (a.start === null || b.start === null || a.end === null || b.end === null) return false;
  if (!a.days.some((d) => b.days.includes(d))) return false;
  return a.start < b.end && b.start < a.end;
}
