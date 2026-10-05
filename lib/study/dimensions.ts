export type Family = "layout" | "content" | "invocation" | "initiative";

export type Variation = {
  id: string;
  label: string;
  description: string;
  // The Atlas spec fragment this variation corresponds to, for provenance.
  atlas: Record<string, string | string[]>;
};

export type Dimension = {
  id: DimensionId;
  family: Family;
  label: string;
  question: string;
  variations: readonly [Variation, Variation, Variation];
};

export type DimensionId = "overviewType" | "openIn" | "abstraction" | "invocation" | "proposalStyle";
export type InterfaceDimensionId = Exclude<DimensionId, "proposalStyle">;

export const DIMENSIONS: Record<DimensionId, Dimension> = {
  overviewType: {
    id: "overviewType",
    family: "layout",
    label: "Course layout",
    question: "How should courses be laid out?",
    variations: [
      { id: "list", label: "List", description: "One course per row, with room for a description.", atlas: { overviewType: "List" } },
      { id: "grid", label: "Grid", description: "Courses as tiles, several per row.", atlas: { overviewType: "Grid" } },
      { id: "table", label: "Table", description: "One line per course, values in aligned columns.", atlas: { overviewType: "Table" } },
    ],
  },
  openIn: {
    id: "openIn",
    family: "layout",
    label: "Course details",
    question: "Where should a course's details open?",
    variations: [
      { id: "side", label: "Beside the list", description: "Details stay open in a panel next to the courses.", atlas: { openIn: "Side-by-side" } },
      { id: "popup", label: "In a pop-up", description: "Details open over the page until you close them.", atlas: { openIn: "Pop-up" } },
      { id: "inplace", label: "Under the course", description: "The course expands to show its details.", atlas: { openIn: "In-place" } },
    ],
  },
  abstraction: {
    id: "abstraction",
    family: "content",
    label: "Ratings, workload and seats",
    question: "How should ratings, workload and seats be shown?",
    variations: [
      { id: "number", label: "Numbers", description: "Exact values, such as 4.3 or 9 hours a week.", atlas: { abstraction: [] } },
      { id: "graphic", label: "Bars", description: "Short bars on a shared scale.", atlas: { abstraction: ["Graphic"] } },
      { id: "category", label: "Words", description: "Plain labels, such as Light or Filling up.", atlas: { abstraction: ["Category"] } },
    ],
  },
  invocation: {
    id: "invocation",
    family: "invocation",
    label: "Opening a course",
    question: "What should open a course's details?",
    variations: [
      { id: "click-item", label: "Click anywhere on it", description: "The whole course is one big target.", atlas: { openBy: ["Click"], openFrom: "Whole item" } },
      { id: "click-title", label: "Click its title", description: "Only the title opens details.", atlas: { openBy: ["Click"], openFrom: "Specific attribute" } },
      { id: "hover", label: "Rest the pointer on it", description: "Details open after a moment, no click needed.", atlas: { openBy: ["Hover", "Click"], openFrom: "Whole item" } },
    ],
  },
  proposalStyle: {
    id: "proposalStyle",
    family: "initiative",
    label: "Suggestions",
    question: "How should the planner suggest a different look?",
    variations: [
      { id: "hint", label: "A quiet mark", description: "A small mark you can look at when you like.", atlas: { proactivity: "Always-visible hints" } },
      { id: "ask", label: "Ask me", description: "A short question above the courses.", atlas: { proactivity: "Suggested when stuck" } },
      { id: "request", label: "Only when I look", description: "Suggestions wait behind a button.", atlas: { proactivity: "On request" } },
    ],
  },
};

export const INTERFACE_DIMENSIONS: readonly InterfaceDimensionId[] = ["overviewType", "openIn", "abstraction", "invocation"];

export type Spec = Record<DimensionId, string>;

export const DEFAULT_SPEC: Spec = {
  overviewType: "list",
  openIn: "side",
  abstraction: "number",
  invocation: "click-item",
  proposalStyle: "ask",
};

// L9(3^4) orthogonal array: every pair of interface dimensions sees every pair of
// variations exactly once, so per-dimension effects stay estimable from whole swaps.
export const L9: readonly (readonly [number, number, number, number])[] = [
  [0, 0, 0, 0],
  [0, 1, 1, 1],
  [0, 2, 2, 2],
  [1, 0, 1, 2],
  [1, 1, 2, 0],
  [1, 2, 0, 1],
  [2, 0, 2, 1],
  [2, 1, 0, 2],
  [2, 2, 1, 0],
];

export function l9Spec(row: readonly number[], base: Spec): Spec {
  const spec = { ...base };
  INTERFACE_DIMENSIONS.forEach((dim, i) => {
    spec[dim] = DIMENSIONS[dim].variations[row[i]].id;
  });
  return spec;
}

export function variationOf(dim: DimensionId, id: string): Variation {
  const v = DIMENSIONS[dim].variations.find((x) => x.id === id);
  if (!v) throw new Error(`Unknown variation ${dim}=${id}`);
  return v;
}

export function changedDimensions(before: Spec, after: Spec): DimensionId[] {
  return (Object.keys(DIMENSIONS) as DimensionId[]).filter((d) => before[d] !== after[d]);
}
