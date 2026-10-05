import { DIMENSIONS, INTERFACE_DIMENSIONS, changedDimensions, type DimensionId, type Spec } from "./dimensions.ts";

// How each variation reads inside a sentence, e.g. "Courses show as a table."
const PHRASES: Record<string, string> = {
  list: "courses show as a list",
  grid: "courses show as a grid",
  table: "courses show as a table",
  side: "details open beside the list",
  popup: "details open in a pop-up",
  inplace: "details open under the course",
  number: "ratings, workload and seats show as numbers",
  graphic: "ratings, workload and seats show as bars",
  category: "ratings, workload and seats show as words",
  "click-item": "a course opens when you click anywhere on it",
  "click-title": "a course opens when you click its title",
  hover: "a course opens when you rest the pointer on it",
  hint: "suggestions show as a quiet mark",
  ask: "suggestions ask you directly",
  request: "suggestions wait until you look",
};

export function phrase(variation: string): string {
  return PHRASES[variation] ?? variation;
}

export function sentence(variation: string): string {
  const p = phrase(variation);
  return p.charAt(0).toUpperCase() + p.slice(1) + ".";
}

export function interfaceChanges(before: Spec, after: Spec): DimensionId[] {
  return changedDimensions(before, after).filter((d) => d !== "proposalStyle");
}

export function differsFromDefault(spec: Spec, base: Spec): boolean {
  return INTERFACE_DIMENSIONS.some((d) => spec[d] !== base[d]);
}

export function summarize(spec: Spec): { dimension: string; value: string }[] {
  return INTERFACE_DIMENSIONS.map((d) => ({
    dimension: DIMENSIONS[d].label,
    value: DIMENSIONS[d].variations.find((v) => v.id === spec[d])?.label ?? spec[d],
  }));
}
