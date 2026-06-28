import { REGIONS } from "./data/regions.js";
import { STRUCTURES } from "./data/structures.js";
import { UNITS } from "./data/units.js";
import { TECHS } from "./data/tech.js";
import type {
  RegionType,
  StructureType,
  UnitType,
  RegionKey,
  TechMilestone,
} from "./types.js";

/** Lookup maps for O(1) access by key. */
export const REGION_BY_KEY: ReadonlyMap<string, RegionType> = new Map(
  REGIONS.map((r) => [r.key, r]),
);
export const STRUCTURE_BY_KEY: ReadonlyMap<string, StructureType> = new Map(
  STRUCTURES.map((s) => [s.key, s]),
);
export const UNIT_BY_KEY: ReadonlyMap<string, UnitType> = new Map(
  UNITS.map((u) => [u.key, u]),
);
export const TECH_BY_KEY: ReadonlyMap<string, TechMilestone> = new Map(
  TECHS.map((t) => [t.key, t]),
);

/** All structures that can be built on a given region type. */
export function structuresForRegion(region: RegionKey): StructureType[] {
  return STRUCTURES.filter((s) => s.buildsOn === region);
}
