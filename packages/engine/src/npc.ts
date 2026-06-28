import { apply } from "./apply.js";
import { canBuildStructure, canResearch, hasStructure, netPerTurn } from "./rules.js";
import { offensivePower, defensivePower } from "./combat.js";
import { UNIT_BY_KEY } from "./lookups.js";
import { TECHS } from "./data/tech.js";
import type { ApplyContext, EmpireState, GameState } from "./state.js";
import type { RegionKey, Resource } from "./types.js";

/**
 * Phase-1 NPC behaviour. Pure (uses only the deterministic engine) so it runs
 * identically client-side now and server-side later (roadmap Phase 2). Each NPC
 * plays a turn, then actively MANAGES its empire — no cheating, same rules as
 * the human:
 *
 *   1. stabilise — sell genuine surplus on the market, top up fuel, stay solvent
 *   2. economy   — build the right production structure on every free region
 *   3. expand    — spend a large credit hoard on fresh land (then build on it)
 *   4. military  — progress to a barracks, static defenses, and a small army
 *
 * This fixes the old failure mode (hoarding food while bleeding fuel/credits and
 * stalling). Smarter per-faction profiles come later.
 */
export function stepNpcs(state: GameState, ctx: ApplyContext): GameState {
  let s = state;
  for (const id of s.order) {
    if (!s.empires[id].isNpc) continue;

    const turn = apply(s, id, { kind: "PLAY_TURN" }, ctx);
    s = turn.state;
    if (!turn.result.ok) continue;

    s = manage(s, id, ctx);
    s = maybeAttack(s, id, ctx);
  }
  return s;
}

// Keep this much gold in reserve; only spend down to it on economy/military.
const RESERVE = 400;
// Top fuel back up to here (via market) when it runs low or trends negative.
const SAFE_FUEL = 120;
// Only expand land once comfortably rich (converts a hoard into growth).
const EXPAND_AT = 4000;
// Cap land bought per turn so NPCs grow at a measured pace, not explosively.
const EXPAND_PER_TURN = 3;
// Bound the work done per turn so a single tick can't loop unboundedly.
const MAX_ACTIONS = 24;

// Buffers kept of each tradable resource; anything above is genuine surplus to sell.
const SURPLUS_KEEP: Partial<Record<Resource, number>> = {
  food: 1500,
  ore: 120,
  steel: 120,
};

// Economic structures in build priority. Fuel PRODUCERS come before fuel
// CONSUMERS (mine/steel) so an NPC has power before it builds power-hungry plants.
const ECON_BUILD = [
  "farm",
  "powerPlant",
  "windmill",
  "ranch",
  "ironOreMine",
  "steelWorks",
  "solarPowerPlant",
  "tidalPowerPlant",
] as const;

function manage(state: GameState, id: string, ctx: ApplyContext): GameState {
  let s = state;
  s = stabilise(s, id, ctx);
  s = developEconomy(s, id, ctx);
  s = expand(s, id, ctx);
  s = developEconomy(s, id, ctx); // build on any freshly-bought land
  s = developTech(s, id, ctx);
  s = developMilitary(s, id, ctx);
  return s;
}

/** Invest in a research economy, then climb the tech ladder when affordable. */
function developTech(state: GameState, id: string, ctx: ApplyContext): GameState {
  let s = state;
  const e = () => s.empires[id];
  const hasFacility = () => e().regions.some((r) => r.structure === "researchFacility");

  // Stand up a Research Facility (buying a Technology region first if needed).
  if (!hasFacility() && (e().resources.gold ?? 0) > EXPAND_AT) {
    if (canBuildStructure(e(), "researchFacility").ok) {
      s = act(s, id, { kind: "BUILD_STRUCTURE", structureKey: "researchFacility" }, ctx);
    } else if (!e().regions.some((r) => r.type === "technology" && !r.structure)) {
      s = act(s, id, { kind: "BUY_REGION", regionType: "technology", qty: 1 }, ctx);
    }
  }

  // Research the next milestone we can afford (TECHS is ordered up the ladder).
  for (const t of TECHS) {
    if (canResearch(e(), t.key).ok) {
      s = act(s, id, { kind: "RESEARCH", techKey: t.key }, ctx);
      break;
    }
  }
  return s;
}

/** Sell surplus for credits and keep fuel topped up so the empire stays solvent. */
function stabilise(state: GameState, id: string, ctx: ApplyContext): GameState {
  let s = state;
  const e = () => s.empires[id];

  // Liquidate genuine surplus (NPCs used to hoard food/ore/steel and stall).
  for (const r of ["ore", "steel", "food"] as Resource[]) {
    const keep = SURPLUS_KEEP[r] ?? 0;
    const have = e().resources[r] ?? 0;
    if (have > keep) {
      s = act(s, id, { kind: "MARKET", side: "sell", resource: r, qty: have - keep }, ctx);
    }
  }

  // Buy fuel if the stockpile is low or the per-turn trend is negative.
  const fuel = e().resources.fuel ?? 0;
  const net = netPerTurn(e(), s.config, s.planet);
  if ((fuel < SAFE_FUEL || net.fuel < 0) && (e().resources.gold ?? 0) > RESERVE * 2) {
    const want = Math.max(0, SAFE_FUEL - fuel) + (net.fuel < 0 ? -net.fuel * 10 : 0);
    if (want >= 1) {
      s = act(s, id, { kind: "MARKET", side: "buy", resource: "fuel", qty: Math.floor(want) }, ctx);
    }
  }
  return s;
}

/** Greedily build the best available economic structure on free regions. */
function developEconomy(state: GameState, id: string, ctx: ApplyContext): GameState {
  let s = state;
  const e = () => s.empires[id];

  for (let i = 0; i < MAX_ACTIONS; i++) {
    let built = false;
    for (const key of ECON_BUILD) {
      if ((e().resources.gold ?? 0) < RESERVE) break;
      const chk = canBuildStructure(e(), key);
      if (!chk.ok) continue;
      const cost = chk.cost.gold ?? 0;
      if ((e().resources.gold ?? 0) - cost < RESERVE) continue;
      s = act(s, id, { kind: "BUILD_STRUCTURE", structureKey: key }, ctx);
      built = true;
      break;
    }
    if (!built) break;
  }
  return s;
}

/** When wealthy, convert a credit hoard into varied new land. */
function expand(state: GameState, id: string, ctx: ApplyContext): GameState {
  let s = state;
  const e = () => s.empires[id];
  const TYPES: readonly RegionKey[] = [
    "agricultural",
    "river",
    "mountain",
    "industrial",
    "urban",
    "desert",
  ];

  for (let i = 0; i < EXPAND_PER_TURN; i++) {
    if ((e().resources.gold ?? 0) < EXPAND_AT) break;
    // Deterministic round-robin so each NPC's territory grows varied, not uniform.
    const type = TYPES[(e().turnsPlayed + i) % TYPES.length];
    s = act(s, id, { kind: "BUY_REGION", regionType: type, qty: 1 }, ctx);
  }
  return s;
}

/** Progress to a barracks, then static defenses and a small standing army. */
function developMilitary(state: GameState, id: string, ctx: ApplyContext): GameState {
  let s = state;
  const e = () => s.empires[id];
  const urban = () => e().regions.filter((r) => r.type === "urban").length;

  if (!hasStructure(e(), "barracks")) {
    if (urban() >= 5 && (e().resources.gold ?? 0) > RESERVE + 100) {
      s = act(s, id, { kind: "BUILD_STRUCTURE", structureKey: "barracks" }, ctx);
    } else if (urban() < 5 && (e().resources.gold ?? 0) > EXPAND_AT) {
      s = act(s, id, { kind: "BUY_REGION", regionType: "urban", qty: 1 }, ctx);
    }
    return s;
  }

  // Static defense up to a ×10 turret line.
  const turrets = e().militaryStructures["gunTurret"] ?? 0;
  if (turrets < 10 && (e().resources.gold ?? 0) > RESERVE + 200) {
    s = act(s, id, { kind: "BUILD_STRUCTURE", structureKey: "gunTurret" }, ctx);
  }
  // A little offense, paid for out of surplus.
  if ((e().resources.gold ?? 0) > RESERVE + 200 && (e().resources.food ?? 0) > 200) {
    s = act(s, id, { kind: "BUILD_UNIT", unitKey: "heavyInfantry", batches: 1 }, ctx);
  }
  return s;
}

/** Attack the weakest unprotected rival if clearly dominant. */
function maybeAttack(state: GameState, id: string, ctx: ApplyContext): GameState {
  const me = state.empires[id];
  if (me.protectionTurnsLeft > 0) return state;

  const force = offensiveForce(me);
  const myPower = offensivePower(force);
  if (myPower <= 0) return state;

  let best: { target: string; def: number } | null = null;
  for (const tid of state.order) {
    if (tid === id) continue;
    const t = state.empires[tid];
    if (t.protectionTurnsLeft > 0) continue;
    const def = defensivePower(t);
    if (myPower < def * 1.6) continue; // only attack when dominant
    if (!best || def < best.def) best = { target: tid, def };
  }
  if (!best) return state;
  return apply(state, id, { kind: "ATTACK", targetEmpireId: best.target, force }, ctx)
    .state;
}

function offensiveForce(e: EmpireState): Record<string, number> {
  const force: Record<string, number> = {};
  for (const [k, n] of Object.entries(e.units)) {
    if ((UNIT_BY_KEY.get(k)?.attack ?? 0) > 0) force[k] = n;
  }
  return force;
}

function act(
  state: GameState,
  id: string,
  action: Parameters<typeof apply>[2],
  ctx: ApplyContext,
): GameState {
  return apply(state, id, action, ctx).state;
}
