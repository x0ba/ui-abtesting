import { seatsLeft, type Course } from "@/lib/catalog/courses.ts";

export type QuantityKind = "rating" | "workload" | "seats";

export const QUANTITY_LABEL: Record<QuantityKind, string> = {
  rating: "Rating",
  workload: "Workload",
  seats: "Seats",
};

function exact(kind: QuantityKind, c: Course): string {
  if (kind === "rating") return `${c.rating.toFixed(1)} out of 5`;
  if (kind === "workload") return `${c.workload} hours a week`;
  const left = seatsLeft(c);
  return left === 0 ? "Full" : `${left} of ${c.capacity} open`;
}

function category(kind: QuantityKind, c: Course): string {
  if (kind === "rating") return c.rating >= 4.4 ? "Loved" : c.rating >= 3.8 ? "Liked" : c.rating >= 3.2 ? "Mixed" : "Disliked";
  if (kind === "workload") return c.workload <= 5 ? "Light" : c.workload <= 9 ? "Moderate" : "Heavy";
  const left = seatsLeft(c);
  if (left === 0) return "Full";
  if (left <= 5) return "Almost full";
  return left / c.capacity < 0.3 ? "Filling up" : "Plenty";
}

function number(kind: QuantityKind, c: Course): string {
  if (kind === "rating") return c.rating.toFixed(1);
  if (kind === "workload") return `${c.workload} h/wk`;
  const left = seatsLeft(c);
  return left === 0 ? "Full" : `${left} left`;
}

function fraction(kind: QuantityKind, c: Course): number {
  if (kind === "rating") return c.rating / 5;
  if (kind === "workload") return c.workload / 16;
  return seatsLeft(c) / c.capacity;
}

export function Quantity({ kind, course, mode }: { kind: QuantityKind; course: Course; mode: string }) {
  if (mode === "graphic") {
    const f = fraction(kind, course);
    return (
      <span className="q q-graphic" data-kind={kind} role="img" aria-label={exact(kind, course)} title={exact(kind, course)}>
        <span className="q-track">
          <span className="q-fill" style={{ inlineSize: `${Math.max(f * 100, f > 0 ? 4 : 0)}%` }} />
        </span>
      </span>
    );
  }
  if (mode === "category") {
    const label = category(kind, course);
    return (
      <span className="q q-word" data-kind={kind} data-value={label} title={exact(kind, course)}>
        {label}
      </span>
    );
  }
  return (
    <span className="q q-number" data-kind={kind} data-full={kind === "seats" && seatsLeft(course) === 0 ? "" : undefined}>
      {number(kind, course)}
    </span>
  );
}

export function exactQuantity(kind: QuantityKind, c: Course): string {
  return exact(kind, c);
}
