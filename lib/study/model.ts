import { STUDY } from "./config.ts";
import { DIMENSIONS, INTERFACE_DIMENSIONS, L9, l9Spec, type DimensionId, type Spec } from "./dimensions.ts";
import type { Observation } from "./events.ts";
import { sampleBeta, type Rng } from "./rng.ts";

export type PopulationRow = {
  dimension: string;
  variation: string;
  contextKey: string;
  keeps: number;
  total: number;
};

export type Evidence = {
  person: Observation[];
  population: PopulationRow[];
};

export type Beta = { a: number; b: number };

export function posterior(evidence: Evidence, dimension: DimensionId, variation: string, contextKey: string, now: number): Beta {
  const { decayPerDay, crossContextWeight, populationPriorStrength } = STUDY.model;

  let keeps = 0;
  let total = 0;
  for (const row of evidence.population) {
    if (row.dimension !== dimension || row.variation !== variation || row.contextKey !== contextKey) continue;
    keeps += row.keeps;
    total += row.total;
  }
  const scale = total > 0 ? Math.min(1, populationPriorStrength / total) : 0;
  let a = 1 + scale * keeps;
  let b = 1 + scale * (total - keeps);

  for (const o of evidence.person) {
    if (o.dimension !== dimension || o.variation !== variation) continue;
    const ageDays = Math.max(0, now - o.at) / 86_400_000;
    const w = Math.exp(-decayPerDay * ageDays) * (o.contextKey === contextKey ? 1 : crossContextWeight);
    if (o.outcome === 1) a += w;
    else b += w;
  }
  return { a, b };
}

export type Draws = Record<string, Record<string, number>>;

export function drawAll(evidence: Evidence, contextKey: string, rng: Rng, now: number): Draws {
  const draws: Draws = {};
  for (const dim of Object.values(DIMENSIONS)) {
    draws[dim.id] = {};
    for (const v of dim.variations) {
      const { a, b } = posterior(evidence, dim.id, v.id, contextKey, now);
      draws[dim.id][v.id] = sampleBeta(a, b, rng);
    }
  }
  return draws;
}

// Thompson sampling over one dimension's alternatives to the current variation, best first.
export function rankAlternatives(dim: DimensionId, current: string, draws: Draws): string[] {
  return DIMENSIONS[dim].variations
    .map((v) => v.id)
    .filter((id) => id !== current)
    .sort((x, y) => draws[dim][y] - draws[dim][x]);
}

// Thompson sampling over the L9 rows, scored by the sum of each row's sampled values.
export function bestWholeSpec(current: Spec, draws: Draws): { spec: Spec; row: number } {
  let best = { spec: current, row: -1, score: -Infinity };
  L9.forEach((row, i) => {
    const spec = l9Spec(row, current);
    if (INTERFACE_DIMENSIONS.every((d) => spec[d] === current[d])) return;
    const score = INTERFACE_DIMENSIONS.reduce((s, d) => s + draws[d][spec[d]], 0);
    if (score > best.score) best = { spec, row: i, score };
  });
  return { spec: best.spec, row: best.row };
}
