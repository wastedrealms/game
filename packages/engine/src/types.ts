/**
 * Core type definitions for the Wasted Realms engine.
 *
 * Design rules:
 *  - Static reference data (regions/structures/units) is DATA, not code, so balancing = editing rows.
 *  - The engine is pure & deterministic: no Date.now() / Math.random() / IO in here.
 */

/** The five tracked resources. Gold/Food/Fuel are primary; Ore/Steel are strategic. */
export type Resource = "gold" | "food" | "fuel" | "ore" | "steel";

/** A partial bag of resources (omitted keys = 0). */
export type ResourceBag = Partial<Record<Resource, number>>;

/** The eight terrain types an empire can own. */
export type RegionKey =
  | "coastal"
  | "river"
  | "agricultural"
  | "desert"
  | "industrial"
  | "urban"
  | "mountain"
  | "technology";

/** Structures are economic (R) or military (M). */
export type StructureClass = "R" | "M";

/** Static definition of a terrain/region type. */
export interface RegionType {
  key: RegionKey;
  name: string;
  /** One-time purchase cost (gold). */
  cost: number;
  /** Passive per-turn income produced by owning the region. */
  income: ResourceBag;
  /** Short flavor / strategic note. */
  note?: string;
}

/** A prerequisite to build a structure or unit. */
export interface Prereq {
  /** Required count of owned regions by type, e.g. { urban: 10 }. */
  regions?: Partial<Record<RegionKey, number>>;
  /** Required prerequisite structures (by key). */
  structures?: string[];
  /** Required prerequisite units (by key) — e.g. a Command Center needs a Commander. */
  units?: string[];
  /** Required stockpiled resources consumed/checked on build. */
  resources?: ResourceBag;
}

/** Static definition of a structure (economic or military). */
export interface StructureType {
  key: string;
  name: string;
  class: StructureClass;
  /** The single region type this is built on (if any). */
  buildsOn?: RegionKey;
  /** Additional prerequisites beyond the host region. */
  prereq?: Prereq;
  /** One-time build cost. */
  cost: ResourceBag;
  /** Recurring per-turn production (economic structures). */
  produces?: ResourceBag;
  /** Recurring per-turn upkeep. */
  upkeep?: ResourceBag;
  /** Static defensive power (defensive military structures only). */
  defense?: number;
  /** Structure keys this unlocks (for the build tree / UI). */
  unlocks?: string[];
  /** Tech milestone key required before this can be built (Tier-I gate). */
  requiresTech?: string;
  note?: string;
}

/** Combat domain for the light rock-paper-scissors model. */
export type UnitDomain = "ground" | "air" | "orbital" | "covert" | "support";

/** Diplomatic treaty types (subset of the source diplomacy menu). */
export type TreatyType = "nonAggression" | "alliance" | "trade";

/** Covert operations a Covert Agent can perform. */
export type CovertOp = "spy" | "incite" | "sabotage";

/** Static definition of a troop/unit type. */
export interface UnitType {
  key: string;
  name: string;
  /** Batch size ("NumX per" in the source sheet) — units are bought in batches. */
  batch: number;
  domain: UnitDomain;
  prereq?: Prereq;
  /** One-time cost per batch. */
  cost: ResourceBag;
  /** Recurring per-turn upkeep per batch. */
  upkeep?: ResourceBag;
  /** Offensive power per unit (0 = non-combatant). */
  attack?: number;
  /** Defensive power per unit. */
  defense?: number;
  /** Enemy domains this unit is especially effective against (light RPS). */
  strongVs?: UnitDomain[];
  /** Tech milestone key required before this can be built (Tier-I gate). */
  requiresTech?: string;
  note?: string;
}

/** Per-game tunable constants (balance options). */
export interface GameConfig {
  /** Turns that make up one "day" — the cadence on which land/attacks reset. */
  turnsPerDay: number;
  protectionTurns: number;
  /** Legacy flat daily land faucet (kept for MP/back-compat; see landPerEmpirePerDay). */
  landCreatedPerDay: number;
  /**
   * New land that becomes claimable per empire per day (BRE/SRE "Land Created").
   * The actual daily pool = landPerEmpirePerDay × empire count, so larger games
   * fill the planet faster and land is genuinely contested (anti-snowball faucet).
   */
  landPerEmpirePerDay: number;
  interestRate: number;
  taxRateDefault: number;
  maxRegionsPerEmpire: number;
  maxPlayers: number;
  /** Economy-tick tuning (balance is data, not code). */
  economy: EconomyTuning;
  /** Combat tuning (see combat.ts). */
  combat: CombatTuning;
  /** Diplomacy tuning (see diplomacy.ts). */
  diplomacy: DiplomacyTuning;
  /** Covert-ops tuning (see covert.ts). */
  covert: CovertTuning;
  /** Market tuning (resource ↔ gold trading). */
  market: MarketTuning;
  /** How the game is won and roughly how long it lasts (see victory.ts). */
  victory: VictoryConfig;
  /** Total tiles on the shared planet (see PLANET_SIZES / planet.ts). */
  planetTiles: number;
}

/** Planet size preset — total region/tile capacity of the shared globe. */
export type PlanetSize = "small" | "medium" | "large" | "extra" | "ultra";

/** The primary path to victory for a game. */
export type VictoryType = "domination" | "economic" | "score" | "tech";

/** A milestone on the research ladder (see data/tech.ts). */
export interface TechMilestone {
  key: string;
  name: string;
  /** Ladder tier (1..7) — also the display order. */
  tier: number;
  /** Research Points required to unlock (cumulative cost is sum up the chain). */
  rpCost: number;
  /** Previous milestone that must be owned first (undefined = first rung). */
  requires?: string;
  /** One-line capability summary for the UI. */
  note: string;
}

/** Game-length preset — scales deadline + thresholds (research-backed; see victory.ts). */
export type GameLength = "short" | "medium" | "long";

export interface VictoryConfig {
  /** Primary win trigger. Last-empire-standing always also wins (conquest). */
  type: VictoryType;
  /** Length preset that produced the numbers below. */
  length: GameLength;
  /** Hard game-turn cap; on reaching it the highest net worth wins (and ends "score"). */
  turnDeadline: number;
  /** Land share (0..1) of all claimed land needed for a domination win. */
  dominationPct: number;
  /** Net-worth target for an economic win. */
  netWorthTarget: number;
  /** Tech milestone key that wins a "tech" game (per length preset). */
  techGoal: string;
}

export interface MarketTuning {
  /** Reference (mid) price per unit of each resource, in credits. */
  prices: Record<Resource, number>;
  /** Sell price multiplier under the reference price (the dealer haircut, <1). */
  sellSpread: number;
  /** Buy price multiplier over the reference price (the dealer markup, >1). */
  buySpread: number;
}

export interface DiplomacyTuning {
  /** Gold/turn each party earns per active trade treaty. */
  tradeGoldPerPartner: number;
}

export interface CovertTuning {
  /** Base success probability before agent scaling. */
  baseSuccess: number;
  /** Extra success probability per committed agent (capped). */
  successPerAgent: number;
  /** Success bonus when the attacker has orbital reconnaissance (a Recon or
   *  Defense Satellite) — satellites guide agents to targets. */
  reconSuccessBonus: number;
  /** Max success probability. */
  maxSuccess: number;
  /** Popular-support points removed by a successful "incite". */
  dissentAmount: number;
  /** Fraction of the target's gold stolen by a successful "sabotage". */
  stealFraction: number;
  /** Fraction of committed agents lost on success. */
  agentLossOnSuccess: number;
  /** Fraction of committed agents lost on failure. */
  agentLossOnFail: number;
}

/** Tunable coefficients for combat resolution. */
export interface CombatTuning {
  /** Power ratio (attack/defense) at/above which the attacker wins. */
  winThreshold: number;
  /** ± random swing applied to the power ratio (0.1 = ±10%). */
  jitter: number;
  /** Bonus multiplier a unit gets vs a domain it is strong against. */
  counterBonus: number;
  /** Max fraction of the defender's land a single win can capture. */
  maxLandCaptureFraction: number;
  /** Land captured scales with how decisive the win is, times this. */
  landRewardCoeff: number;
  /** Attacker unit-loss fraction on a win. */
  attackerLossOnWin: number;
  /** Defender unit-loss fraction on a loss (i.e. attacker won). */
  defenderLossOnWin: number;
  /** Attacker unit-loss fraction when the attack is repelled. */
  attackerLossOnLoss: number;
  /** Defender unit-loss fraction when the attack is repelled. */
  defenderLossOnLoss: number;
  /** Max attacks one empire may launch per day (anti-grief; per BRE ≈ 4). */
  maxAttacksPerDay: number;
  /** Turns within which re-hitting the SAME target yields diminishing land. */
  farmWindow: number;
  /** Per-repeat land-reward multiplier when farming a target (e.g. 0.5). */
  farmDecay: number;
}

/** Tunable coefficients for the per-turn economy tick (see rules.ts). */
export interface EconomyTuning {
  /** Food consumed per unit of population per turn. */
  foodPerPop: number;
  /** Gold collected per unit of population per turn at 100% tax. */
  taxGoldPerPop: number;
  /** Population growth rate per turn when fed & supported (e.g. 0.01 = +1%). */
  popGrowthRate: number;
  /** Population shrink rate per turn when starving. */
  popStarveRate: number;
  /** Popular-support lost per turn while starving. */
  supportStarvePenalty: number;
  /** Popular-support lost per turn per point of tax above this threshold. */
  taxComfortThreshold: number;
  /** Popular-support recovered per turn when fed & taxes comfortable. */
  supportRecovery: number;
  /**
   * Income multiplier floor at 0% support (1.0 = support has no economic effect).
   * Income (production + tax) scales linearly from this floor at 0 support to 1.0
   * at 100 — so unrest directly cuts output and high tax is self-limiting.
   */
  supportIncomeFloor: number;
  /** Research Points produced per Research Facility per turn. */
  researchPerFacility: number;
}
