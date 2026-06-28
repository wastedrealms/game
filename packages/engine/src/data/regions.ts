import type { RegionType } from "../types.js";

/**
 * Region reference data (authoritative balance values).
 * Note the 3 flagged
 * source discrepancies (Desert, Urban, Technology) still to be resolved in balancing.
 */
export const REGIONS: readonly RegionType[] = [
  {
    key: "coastal",
    name: "Coastal",
    cost: 1000,
    income: { gold: 25 },
    note: "Enables Tidal Power.",
  },
  {
    key: "river",
    name: "River",
    cost: 1000,
    income: { food: 25, gold: 25 },
    note: "Best raw region; enables Power Plant.",
  },
  {
    key: "agricultural",
    name: "Agricultural",
    cost: 500,
    income: { food: 25 },
    note: "Food base; enables Farm / Ranch.",
  },
  {
    key: "desert",
    name: "Desert",
    cost: 100,
    income: { food: 5 }, // xls value; txt says +5 gold (discrepancy)
    note: "Cheap; enables Windmill + Solar.",
  },
  {
    key: "industrial",
    name: "Industrial",
    cost: 500,
    income: { gold: 25 },
    note: "Gates Shipyard (need 8).",
  },
  {
    key: "urban",
    name: "Urban",
    cost: 500,
    income: { gold: 25 }, // xls value; txt says +50 gold (discrepancy)
    note: "Gates Barracks (5) & Battle Academy (20).",
  },
  {
    key: "mountain",
    name: "Mountain",
    cost: 100,
    income: { fuel: 5, food: 5 },
    note: "Cheap; only source of Ore / Steel.",
  },
  {
    key: "technology",
    name: "Technology",
    cost: 3000,
    income: { fuel: 25, gold: 25 }, // xls value; txt says +10 fuel (discrepancy)
    note: "Expensive; enables Research Facility → tech tree.",
  },
] as const;
