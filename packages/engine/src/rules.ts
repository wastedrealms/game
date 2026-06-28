import type { GameConfig, RegionKey, Resource, ResourceBag } from "./types.js";
import type { EmpireState, OwnedRegion, ResourceLedger } from "./state.js";
import type { Planet } from "./planet.js";
import { RESOURCES, addBags } from "./economy.js";
import { REGION_BY_KEY, STRUCTURE_BY_KEY, UNIT_BY_KEY, TECH_BY_KEY } from "./lookups.js";

/** Net-worth weights (tunable). */
const SCORE_WEIGHTS = { region: 1, structure: 2, unit: 0.5, goldPer: 1000 };

// ── Turn-based day ───────────────────────────────────────────────────────────
// Turns are unlimited in single-player: play one whenever you like and the day
// advances with them. A "day" is purely a counter — every `turnsPerDay` turns
// played, the day rolls over (and the land pool / attack cap reset). Real time
// no longer gates play.

/** The 0-based day index for a given turn count: one day = `turnsPerDay` turns. */
export function dayOf(turnsPlayed: number, config: GameConfig): number {
  return Math.floor(turnsPlayed / config.turnsPerDay);
}

/**
 * Turns remaining in the current day: counts down `turnsPerDay`→1 as turns are
 * played, then flips back to a full day as the day index rolls over. Cosmetic —
 * play is never blocked — but it's what the HUD's "turns left" meter shows.
 */
export function turnsLeftInDay(turnsPlayed: number, config: GameConfig): number {
  return config.turnsPerDay - (turnsPlayed % config.turnsPerDay);
}

// ── Income / production / upkeep ─────────────────────────────────────────────

/** Passive income from owned regions. */
export function regionIncome(empire: EmpireState): ResourceBag {
  return addBags(
    ...empire.regions.map((r) => REGION_BY_KEY.get(r.type)?.income ?? {}),
  );
}

/** Production from economic structures built on regions (with Tier-I tech bonuses). */
export function structureProduction(empire: EmpireState): ResourceBag {
  const bags: ResourceBag[] = [];
  for (const r of empire.regions) {
    if (r.structure) bags.push(STRUCTURE_BY_KEY.get(r.structure)?.produces ?? {});
  }
  return applyTechProduction(addBags(...bags), empire.tech ?? []);
}

/** Tier-I research bonuses to structure output (see data/tech.ts). */
function applyTechProduction(bag: ResourceBag, tech: string[]): ResourceBag {
  if (tech.length === 0) return bag;
  const out: ResourceBag = { ...bag };
  const scale = (k: Resource, m: number) => {
    if (out[k]) out[k] = Math.round((out[k] as number) * m);
  };
  // T1 Industrial Logistics — all economic structures run +10%.
  if (tech.includes("industrialLogistics"))
    for (const k of Object.keys(out) as Resource[]) scale(k, 1.1);
  // T2 Advanced Materials — strategic-resource yield +25% (on top of T1).
  if (tech.includes("advancedMaterials")) {
    scale("ore", 1.25);
    scale("steel", 1.25);
  }
  return out;
}

/** Research Points produced per turn (Research Facilities × config rate). */
export function researchPerTurn(empire: EmpireState, config: GameConfig): number {
  let facilities = 0;
  for (const r of empire.regions) if (r.structure === "researchFacility") facilities++;
  return facilities * (config.economy.researchPerFacility ?? 0);
}

export interface ResearchCheck {
  ok: boolean;
  reason?: string;
  cost: number;
}

/** Can this empire unlock the given tech now? (prereq owned + enough RP). */
export function canResearch(empire: EmpireState, techKey: string): ResearchCheck {
  const t = TECH_BY_KEY.get(techKey);
  if (!t) return { ok: false, reason: "Unknown tech", cost: 0 };
  if ((empire.tech ?? []).includes(techKey))
    return { ok: false, reason: "Already researched", cost: t.rpCost };
  if (t.requires && !(empire.tech ?? []).includes(t.requires))
    return {
      ok: false,
      reason: `Requires ${TECH_BY_KEY.get(t.requires)?.name ?? t.requires}`,
      cost: t.rpCost,
    };
  if ((empire.research ?? 0) < t.rpCost)
    return { ok: false, reason: "Not enough Research Points", cost: t.rpCost };
  return { ok: true, cost: t.rpCost };
}

/**
 * Adjacency synergies — a structure on one tile boosts a neighbouring tile's
 * output. Data-driven (SYNERGIES) and spatial: adjacency is read from the SHARED
 * PLANET's neighbour graph, so *where* you build/claim genuinely matters and the
 * player can deliberately set them up.
 */
export interface SynergyRule {
  sourceStructure: string;
  targetRegion: RegionKey;
  resource: Resource;
  /** Fraction of the neighbour's base income added (0.5 = +50%). */
  pct: number;
}

export const SYNERGIES: readonly SynergyRule[] = [
  // A Power Plant (on a River) boosts each adjacent Industrial region's gold.
  { sourceStructure: "powerPlant", targetRegion: "industrial", resource: "gold", pct: 0.5 },
  // An Iron Ore Mine (on a Mountain) boosts each adjacent Industrial region's gold too.
  { sourceStructure: "ironOreMine", targetRegion: "industrial", resource: "gold", pct: 0.25 },
];

/**
 * Bonus income from adjacency synergies, using the shared planet's tile graph.
 * Without a planet (e.g. isolated unit tests) there is no spatial info → no bonus.
 */
export function adjacencyBonus(empire: EmpireState, planet?: Planet): ResourceBag {
  const bag: ResourceBag = {};
  if (!planet) return bag;
  // Owned tile → region, for neighbour lookups.
  const ownTile = new Map<number, OwnedRegion>();
  for (const r of empire.regions) if (r.tile !== undefined) ownTile.set(r.tile, r);
  for (const r of empire.regions) {
    if (!r.structure || r.tile === undefined) continue;
    for (const rule of SYNERGIES) {
      if (r.structure !== rule.sourceStructure) continue;
      for (const nbTile of planet.neighbors[r.tile] ?? []) {
        const nb = ownTile.get(nbTile);
        if (!nb || nb.type !== rule.targetRegion) continue;
        const base = REGION_BY_KEY.get(nb.type)?.income?.[rule.resource] ?? 0;
        bag[rule.resource] = (bag[rule.resource] ?? 0) + Math.round(base * rule.pct);
      }
    }
  }
  return bag;
}

/** Total gross income (regions + structures + adjacency synergies), before upkeep. */
export function grossIncome(empire: EmpireState, planet?: Planet): ResourceBag {
  return addBags(
    regionIncome(empire),
    structureProduction(empire),
    adjacencyBonus(empire, planet),
  );
}

/** Total per-turn upkeep across economic structures, military structures, and units. */
export function totalUpkeep(empire: EmpireState): ResourceBag {
  const bags: ResourceBag[] = [];
  for (const r of empire.regions) {
    if (r.structure) bags.push(STRUCTURE_BY_KEY.get(r.structure)?.upkeep ?? {});
  }
  for (const [key, count] of Object.entries(empire.militaryStructures)) {
    const up = STRUCTURE_BY_KEY.get(key)?.upkeep;
    if (up) bags.push(scaleBagN(up, count));
  }
  for (const [key, count] of Object.entries(empire.units)) {
    const def = UNIT_BY_KEY.get(key);
    if (def?.upkeep) bags.push(scaleBagN(def.upkeep, count / def.batch));
  }
  return addBags(...bags);
}

function scaleBagN(bag: ResourceBag, factor: number): ResourceBag {
  const out: ResourceBag = {};
  for (const k of Object.keys(bag) as Resource[]) out[k] = (bag[k] ?? 0) * factor;
  return out;
}

/**
 * Tax gold collected this turn. Scales with population AND tax rate:
 * `taxGoldPerPop` credits per 1M population per 1% tax (population is in millions).
 * At the default coefficient of 1, 100M pop at 1% tax = 100 credits (×5% = 500).
 * Support compliance is applied in netPerTurn — under unrest fewer people pay.
 */
export function taxIncome(empire: EmpireState, config: GameConfig): number {
  return Math.round(empire.population * empire.taxRate * config.economy.taxGoldPerPop);
}

/** Food consumed by population this turn. */
export function foodConsumption(empire: EmpireState, config: GameConfig): number {
  return Math.ceil(empire.population * config.economy.foodPerPop);
}

/**
 * Net resource change per turn (gross income + tax − upkeep − food consumption).
 * Used both for the actual tick and for the "+net/turn" UI deltas.
 */
/**
 * Income multiplier from popular support: scales linearly from the configured
 * floor at 0% support to 1.0 at 100%. Unrest cuts production and tax compliance,
 * making high taxes self-limiting and support worth defending.
 */
export function supportMult(empire: EmpireState, config: GameConfig): number {
  const floor = config.economy.supportIncomeFloor ?? 1;
  const s = Math.max(0, Math.min(100, empire.popularSupport));
  return floor + (1 - floor) * (s / 100);
}

export function netPerTurn(
  empire: EmpireState,
  config: GameConfig,
  planet?: Planet,
): ResourceLedger {
  const gross = grossIncome(empire, planet);
  const upkeep = totalUpkeep(empire);
  const tax = taxIncome(empire, config);
  const mult = supportMult(empire, config);
  const net: ResourceLedger = { gold: 0, food: 0, fuel: 0, ore: 0, steel: 0 };
  for (const k of RESOURCES) {
    // Production + tax scale with support; upkeep & food consumption do not.
    const income = (gross[k] ?? 0) + (k === "gold" ? tax : 0);
    net[k] = Math.round(income * mult) - (upkeep[k] ?? 0);
  }
  net.food -= foodConsumption(empire, config);
  return net;
}

/** A line-item breakdown of the per-turn economy, for the UI ledger. */
export interface EconomyBreakdown {
  regionIncome: ResourceBag;
  structureIncome: ResourceBag;
  synergy: ResourceBag;
  taxGold: number;
  /** Per-resource income adjustment from popular support (≤0 when support < 100). */
  morale: ResourceBag;
  /** The support income multiplier applied (see supportMult). */
  supportMult: number;
  upkeep: ResourceBag;
  foodConsumption: number;
  net: ResourceLedger;
}

/** Full income/expense breakdown driving the per-turn ledger (see UI). */
export function economyBreakdown(
  empire: EmpireState,
  config: GameConfig,
  planet?: Planet,
): EconomyBreakdown {
  const region = regionIncome(empire);
  const structure = structureProduction(empire);
  const synergy = adjacencyBonus(empire, planet);
  const tax = taxIncome(empire, config);
  const mult = supportMult(empire, config);
  // Morale adjustment per resource = scaled income − base income (≤ 0 under unrest).
  const morale: ResourceBag = {};
  for (const k of RESOURCES) {
    const income = (region[k] ?? 0) + (structure[k] ?? 0) + (synergy[k] ?? 0) + (k === "gold" ? tax : 0);
    const adj = Math.round(income * mult) - income;
    if (adj !== 0) morale[k] = adj;
  }
  return {
    regionIncome: region,
    structureIncome: structure,
    synergy,
    taxGold: tax,
    morale,
    supportMult: mult,
    upkeep: totalUpkeep(empire),
    foodConsumption: foodConsumption(empire, config),
    net: netPerTurn(empire, config, planet),
  };
}

// ── Net worth ────────────────────────────────────────────────────────────────

export function computeNetWorth(empire: EmpireState): number {
  const regions = empire.regions.length * SCORE_WEIGHTS.region;
  const structures =
    (empire.regions.filter((r) => r.structure).length +
      sumCounts(empire.militaryStructures)) *
    SCORE_WEIGHTS.structure;
  const units = sumCounts(empire.units) * SCORE_WEIGHTS.unit;
  const gold = empire.resources.gold / SCORE_WEIGHTS.goldPer;
  return Math.round(regions + structures + units + gold);
}

function sumCounts(rec: Record<string, number>): number {
  return Object.values(rec).reduce((a, b) => a + b, 0);
}

// ── Prerequisite checks ──────────────────────────────────────────────────────

export interface BuildCheck {
  ok: boolean;
  reason?: string;
  /** Resources that would be spent if this build proceeds. */
  cost: ResourceBag;
}

function regionCountByType(empire: EmpireState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of empire.regions) out[r.type] = (out[r.type] ?? 0) + 1;
  return out;
}

/** Can this empire afford & meet prereqs for the given structure? */
export function canBuildStructure(
  empire: EmpireState,
  structureKey: string,
): BuildCheck {
  const def = STRUCTURE_BY_KEY.get(structureKey);
  if (!def) return { ok: false, reason: "Unknown structure", cost: {} };
  const cost = def.cost;

  if (def.requiresTech && !(empire.tech ?? []).includes(def.requiresTech))
    return {
      ok: false,
      reason: `Requires ${TECH_BY_KEY.get(def.requiresTech)?.name ?? def.requiresTech}`,
      cost,
    };
  if (def.buildsOn) {
    const free = empire.regions.some(
      (r) => r.type === def.buildsOn && !r.structure,
    );
    if (!free)
      return {
        ok: false,
        reason: `Need a free ${def.buildsOn} region`,
        cost,
      };
  }
  const counts = regionCountByType(empire);
  for (const [rk, n] of Object.entries(def.prereq?.regions ?? {})) {
    if ((counts[rk] ?? 0) < n)
      return { ok: false, reason: `Requires ${n}× ${rk} regions`, cost };
  }
  for (const dep of def.prereq?.structures ?? []) {
    if (!hasStructure(empire, dep))
      return { ok: false, reason: `Requires a ${dep}`, cost };
  }
  for (const dep of def.prereq?.units ?? []) {
    if ((empire.units[dep] ?? 0) <= 0)
      return { ok: false, reason: `Requires a ${dep}`, cost };
  }
  const need = addBags(cost, def.prereq?.resources ?? {});
  if (!ledgerCovers(empire.resources, need))
    return { ok: false, reason: "Insufficient resources", cost };
  return { ok: true, cost };
}

/** Can this empire afford & meet prereqs for `batches` of the given unit? */
export function canBuildUnit(
  empire: EmpireState,
  unitKey: string,
  batches: number,
): BuildCheck {
  const def = UNIT_BY_KEY.get(unitKey);
  if (!def) return { ok: false, reason: "Unknown unit", cost: {} };
  if (batches <= 0) return { ok: false, reason: "Quantity must be positive", cost: {} };
  const cost = scaleBagN(def.cost, batches);
  if (def.requiresTech && !(empire.tech ?? []).includes(def.requiresTech))
    return {
      ok: false,
      reason: `Requires ${TECH_BY_KEY.get(def.requiresTech)?.name ?? def.requiresTech}`,
      cost,
    };
  for (const dep of def.prereq?.structures ?? []) {
    if (!hasStructure(empire, dep))
      return { ok: false, reason: `Requires a ${dep}`, cost };
  }
  if (!ledgerCovers(empire.resources, cost))
    return { ok: false, reason: "Insufficient resources", cost };
  return { ok: true, cost };
}

/** True if the empire owns the structure as either economic (on a region) or military. */
export function hasStructure(empire: EmpireState, key: string): boolean {
  if ((empire.militaryStructures[key] ?? 0) > 0) return true;
  return empire.regions.some((r) => r.structure === key);
}

function ledgerCovers(have: ResourceLedger, need: ResourceBag): boolean {
  for (const k of Object.keys(need) as Resource[]) {
    if ((have[k] ?? 0) < (need[k] ?? 0)) return false;
  }
  return true;
}

/** Cost of buying `qty` regions of a type (gold). */
export function regionBuyCost(regionType: RegionKey, qty: number): number {
  return (REGION_BY_KEY.get(regionType)?.cost ?? 0) * qty;
}
