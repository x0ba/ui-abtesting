import { seatsLeft, type Course, type Day, type Format, type Requirement } from "@/lib/catalog/courses.ts";

export const DAYS: Day[] = ["Mon", "Tue", "Wed", "Thu", "Fri"];
export const REQUIREMENTS: Requirement[] = ["Writing", "Quantitative", "Lab science", "Global", "Arts", "Ethics"];

export type Filters = {
  query: string;
  dept: string;
  days: Day[];
  startsAfter: number | null;
  format: Format | "any";
  requirements: Requirement[];
  openOnly: boolean;
  noPrereqs: boolean;
};

export const EMPTY_FILTERS: Filters = {
  query: "",
  dept: "any",
  days: DAYS,
  startsAfter: null,
  format: "any",
  requirements: [],
  openOnly: false,
  noPrereqs: false,
};

export type SortKey = "code" | "rating" | "workload" | "seats" | "credits" | "start";

export const SORTS: { id: SortKey; label: string }[] = [
  { id: "code", label: "Course number" },
  { id: "rating", label: "Highest rated" },
  { id: "workload", label: "Lightest workload" },
  { id: "seats", label: "Most open seats" },
  { id: "credits", label: "Most credits" },
  { id: "start", label: "Earliest start" },
];

export function applyFilters(courses: Course[], f: Filters, sort: SortKey): Course[] {
  const q = f.query.trim().toLowerCase();
  const out = courses.filter((c) => {
    if (q && !`${c.code} ${c.title} ${c.instructor} ${c.deptName}`.toLowerCase().includes(q)) return false;
    if (f.dept !== "any" && c.dept !== f.dept) return false;
    if (!c.days.every((d) => f.days.includes(d))) return false;
    if (f.startsAfter !== null && c.start !== null && c.start < f.startsAfter) return false;
    if (f.format !== "any" && c.format !== f.format) return false;
    if (f.requirements.length > 0 && !f.requirements.some((r) => c.requirements.includes(r))) return false;
    if (f.openOnly && seatsLeft(c) === 0) return false;
    if (f.noPrereqs && c.prereqs.length > 0) return false;
    return true;
  });
  const by: Record<SortKey, (a: Course, b: Course) => number> = {
    code: (a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }),
    rating: (a, b) => b.rating - a.rating,
    workload: (a, b) => a.workload - b.workload,
    seats: (a, b) => seatsLeft(b) - seatsLeft(a),
    credits: (a, b) => b.credits - a.credits,
    start: (a, b) => (a.start ?? 24 * 60) - (b.start ?? 24 * 60),
  };
  return out.sort((a, b) => by[sort](a, b) || by.code(a, b));
}
