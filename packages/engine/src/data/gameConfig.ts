import type { GameConfig } from "../types.js";

/**
 * Default per-game tunables (balance options).
 * Stored per game instance so each
 * planet/galaxy can be balanced independently.
 */
export const DEFAULT_GAME_CONFIG: GameConfig = {
  turnsPerDay: 8,
  dayMinutes: 60,
  protectionTurns: 24,
  landCreatedPerDay: 1000,
  // ~12 new regions per empire per day enter the shared pool. With 3 empires
  // that's 36/day to fight over; with 8 it's 96/day (planet fills faster). Over
  // a multi-day game this accumulates into the hundreds the planet can hold.
  landPerEmpirePerDay: 12,
  interestRate: 5,
  taxRateDefault: 5,
  maxRegionsPerEmpire: 500,
  maxPlayers: 20,
  economy: {
    // Population eats 1.6 food/turn. A fresh empire is barely food-positive, but
    // because consumption scales with a GROWING population, food becomes a real
    // constraint mid-game (you must keep building farms/ranches, not ignore them).
    foodPerPop: 1.6,
    // Tax = taxGoldPerPop credits per 1M population per 1% tax rate (× support).
    // 0.1 → 100M pop at 5% = 50 credits/turn (at 1% = 10); high tax erodes support.
    taxGoldPerPop: 0.1,
    popGrowthRate: 0.01,
    popStarveRate: 0.05,
    supportStarvePenalty: 10,
    taxComfortThreshold: 10,
    supportRecovery: 2,
    // At 0% support, income falls to 60%; at 100% support, full income.
    supportIncomeFloor: 0.6,
    // Each Research Facility yields 35 RP/turn → T1 (200) in ~6 turns with one.
    researchPerFacility: 35,
  },
  combat: {
    winThreshold: 1,
    jitter: 0.1,
    counterBonus: 0.5,
    maxLandCaptureFraction: 0.15,
    landRewardCoeff: 0.05,
    attackerLossOnWin: 0.15,
    defenderLossOnWin: 0.3,
    attackerLossOnLoss: 0.4,
    defenderLossOnLoss: 0.1,
    maxAttacksPerDay: 4,
    farmWindow: 12,
    farmDecay: 0.5,
  },
  diplomacy: {
    tradeGoldPerPartner: 40,
  },
  covert: {
    baseSuccess: 0.4,
    successPerAgent: 0.004,
    reconSuccessBonus: 0.15,
    maxSuccess: 0.9,
    dissentAmount: 15,
    stealFraction: 0.15,
    agentLossOnSuccess: 0.1,
    agentLossOnFail: 0.4,
  },
  market: {
    // Reference prices in credits/unit (food anchored to the source's "1 unit = 20").
    prices: { gold: 1, food: 20, fuel: 15, ore: 30, steel: 40 },
    // Wide spread so the market is a convenience, not a credit printer: you sell
    // at 45% of reference and buy back at 125% (a ~2.8× round-trip loss).
    sellSpread: 0.45,
    buySpread: 1.25,
  },
  // Default to a medium "score" game (highest net worth at the deadline). The
  // new-game setup screen lets the player pick type + length (see victory.ts).
  victory: {
    type: "score",
    length: "medium",
    turnDeadline: 700,
    dominationPct: 0.7,
    netWorthTarget: 4000,
    techGoal: "terraforming",
  },
  // Default planet capacity (PLANET_SIZES.medium). New-game setup picks the size.
  planetTiles: 600,
};
