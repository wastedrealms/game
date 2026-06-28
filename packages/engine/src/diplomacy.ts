import type { GameConfig, TreatyType } from "./types.js";
import type { EmpireState, GameState, Treaty } from "./state.js";

/** Normalize a pair of empire ids to a stable (a, b) order. */
export function treatyPair(x: string, y: string): [string, string] {
  return x <= y ? [x, y] : [y, x];
}

/** The active treaty between two empires, if any. */
export function treatyBetween(
  state: GameState,
  x: string,
  y: string,
): Treaty | undefined {
  const [a, b] = treatyPair(x, y);
  return state.treaties.find((t) => t.a === a && t.b === b);
}

/** True if a non-aggression pact or alliance forbids these two from fighting. */
export function areAtPeace(state: GameState, x: string, y: string): boolean {
  const t = treatyBetween(state, x, y);
  return t?.type === "nonAggression" || t?.type === "alliance";
}

/** Empire ids this empire has an active trade treaty with. */
export function tradePartners(state: GameState, empireId: string): string[] {
  const out: string[] = [];
  for (const t of state.treaties) {
    if (t.type !== "trade") continue;
    if (t.a === empireId) out.push(t.b);
    else if (t.b === empireId) out.push(t.a);
  }
  return out;
}

/** Gold/turn an empire earns from its active trade treaties. */
export function tradeIncome(
  state: GameState,
  empireId: string,
  config: GameConfig,
): number {
  return tradePartners(state, empireId).length * config.diplomacy.tradeGoldPerPartner;
}

/**
 * Whether an NPC accepts a proposed treaty. Deterministic heuristic (no RNG):
 * NPCs like trade, accept non-aggression unless dominant, and only ally with
 * comparable/stronger powers they aren't already losing to.
 */
export function npcAcceptsTreaty(
  proposer: EmpireState,
  npc: EmpireState,
  type: TreatyType,
): boolean {
  const ratio = (proposer.netWorth + 1) / (npc.netWorth + 1);
  switch (type) {
    case "trade":
      return true; // trade is mutually beneficial
    case "nonAggression":
      // A dominant NPC would rather keep its options open.
      return ratio >= 0.6;
    case "alliance":
      // Ally with peers or stronger powers worth befriending.
      return ratio >= 0.8;
  }
}
