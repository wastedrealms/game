import type { Resource, ResourceBag } from "./types.js";

/** All resources in canonical display order. */
export const RESOURCES: readonly Resource[] = [
  "gold",
  "food",
  "fuel",
  "ore",
  "steel",
];

/** Add any number of resource bags into a new bag (pure). */
export function addBags(...bags: ResourceBag[]): ResourceBag {
  const out: ResourceBag = {};
  for (const bag of bags) {
    for (const key of Object.keys(bag) as Resource[]) {
      out[key] = (out[key] ?? 0) + (bag[key] ?? 0);
    }
  }
  return out;
}

/** Multiply every entry of a bag by a scalar (pure). */
export function scaleBag(bag: ResourceBag, factor: number): ResourceBag {
  const out: ResourceBag = {};
  for (const key of Object.keys(bag) as Resource[]) {
    out[key] = (bag[key] ?? 0) * factor;
  }
  return out;
}

/** Subtract bag `b` from bag `a` into a new bag (pure). */
export function subtractBags(a: ResourceBag, b: ResourceBag): ResourceBag {
  return addBags(a, scaleBag(b, -1));
}

/** True if `have` covers every (positive) entry of `need`. */
export function canAfford(have: ResourceBag, need: ResourceBag): boolean {
  for (const key of Object.keys(need) as Resource[]) {
    if ((have[key] ?? 0) < (need[key] ?? 0)) return false;
  }
  return true;
}
