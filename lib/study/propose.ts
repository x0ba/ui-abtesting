import { STUDY, type Granularity } from "./config.ts";
import { INTERFACE_DIMENSIONS, changedDimensions, type InterfaceDimensionId, type Spec } from "./dimensions.ts";
import { bestWholeSpec, rankAlternatives, type Draws } from "./model.ts";
import { shuffle, type Rng } from "./rng.ts";

export type Change = {
  id: string;
  granularity: Granularity;
  dimensions: InterfaceDimensionId[];
  // Every alternative shown, in display order. Adaptive changes apply offered[0].
  offered: Spec[];
  // Indices into the sampler's ranking, so display order can be separated from preference.
  order: number[];
  l9Row: number | null;
  draws: Draws;
};

function sampleGranularity(rng: Rng): Granularity {
  let r = rng();
  for (const [g, p] of STUDY.granularity) {
    r -= p;
    if (r <= 0) return g;
  }
  return STUDY.granularity[0][0];
}

export function planChange(opts: {
  id: string;
  current: Spec;
  draws: Draws;
  rng: Rng;
  dimensions: InterfaceDimensionId[];
  maxOffered: 1 | 2;
}): Change {
  const { id, current, draws, rng, maxOffered } = opts;
  const granularity = sampleGranularity(rng);

  if (granularity === "whole") {
    const { spec, row } = bestWholeSpec(current, draws);
    return {
      id,
      granularity,
      dimensions: changedDimensions(current, spec) as InterfaceDimensionId[],
      offered: [spec],
      order: [0],
      l9Row: row,
      draws,
    };
  }

  if (granularity === "mixed") {
    const dims = opts.dimensions.slice(0, 2);
    const spec = { ...current };
    for (const d of dims) spec[d] = rankAlternatives(d, current[d], draws)[0];
    return { id, granularity, dimensions: dims, offered: [spec], order: [0], l9Row: null, draws };
  }

  const [dim] = opts.dimensions;
  const ranked = rankAlternatives(dim, current[dim], draws).slice(0, maxOffered === 2 && rng() < 0.5 ? 2 : 1);
  const order = shuffle(
    ranked.map((_, i) => i),
    rng,
  );
  return {
    id,
    granularity,
    dimensions: [dim],
    offered: order.map((i) => ({ ...current, [dim]: ranked[i] })),
    order,
    l9Row: null,
    draws,
  };
}

// The k-th change of a session targets dimensions in a per-session shuffled cycle, so every
// dimension comes up about equally often regardless of which granularity is drawn.
export function dimensionsAt(k: number, sessionRng: Rng): InterfaceDimensionId[] {
  const base = shuffle(INTERFACE_DIMENSIONS, sessionRng);
  return [base[k % base.length], base[(k + 1) % base.length]];
}

export function pickPresentation(draws: Draws): string {
  const entries = Object.entries(draws.proposalStyle);
  entries.sort((x, y) => y[1] - x[1]);
  return entries[0][0];
}
