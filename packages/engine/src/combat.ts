import type { CombatTuning, UnitDomain } from "./types.js";
import type { EmpireState } from "./state.js";
import type { Rng } from "./rng.js";
import { UNIT_BY_KEY, STRUCTURE_BY_KEY } from "./lookups.js";

/** A unit selection for an attack: unit key → count committed. */
export type ForceSelection = Record<string, number>;

export interface CombatReport {
  won: boolean;
  attackPower: number;
  defensePower: number;
  ratio: number;
  landCaptured: number;
  /** Planet tile indices transferred to the attacker (for shared-planet sync). */
  capturedTiles: number[];
  attackerLosses: Record<string, number>;
  defenderLosses: Record<string, number>;
}

/** Morale multiplier from popular support: 0.5 (broken) → 1.0 (loyal). */
export function moraleMult(empire: EmpireState): number {
  return 0.5 + 0.5 * (empire.popularSupport / 100);
}

/** Raw offensive power of a committed force (attack stat × count). */
export function offensivePower(force: ForceSelection): number {
  let p = 0;
  for (const [key, n] of Object.entries(force)) {
    p += (UNIT_BY_KEY.get(key)?.attack ?? 0) * n;
  }
  return p;
}

/** Defender power = all units' defense + static defensive structures. */
export function defensivePower(empire: EmpireState): number {
  let p = 0;
  for (const [key, n] of Object.entries(empire.units)) {
    p += (UNIT_BY_KEY.get(key)?.defense ?? 0) * n;
  }
  for (const [key, n] of Object.entries(empire.militaryStructures)) {
    p += (STRUCTURE_BY_KEY.get(key)?.defense ?? 0) * n;
  }
  return p;
}

/** Share of a defender's defensive power held in each combat domain. */
function defenderDomainShares(
  empire: EmpireState,
): Partial<Record<UnitDomain, number>> {
  const byDomain: Partial<Record<UnitDomain, number>> = {};
  let total = 0;
  const add = (d: UnitDomain, v: number) => {
    byDomain[d] = (byDomain[d] ?? 0) + v;
    total += v;
  };
  for (const [key, n] of Object.entries(empire.units)) {
    const u = UNIT_BY_KEY.get(key);
    if (u) add(u.domain, (u.defense ?? 0) * n);
  }
  // Static defenses count as the "ground" domain (emplaced).
  for (const [key, n] of Object.entries(empire.militaryStructures)) {
    add("ground", (STRUCTURE_BY_KEY.get(key)?.defense ?? 0) * n);
  }
  if (total <= 0) return {};
  for (const d of Object.keys(byDomain) as UnitDomain[])
    byDomain[d] = (byDomain[d] ?? 0) / total;
  return byDomain;
}

/** Counter bonus when committed units are strong vs the defender's dominant domains. */
function counterBonus(
  force: ForceSelection,
  defender: EmpireState,
  cfg: CombatTuning,
): number {
  const shares = defenderDomainShares(defender);
  let bonus = 0;
  for (const [key, n] of Object.entries(force)) {
    const u = UNIT_BY_KEY.get(key);
    if (!u?.strongVs?.length) continue;
    const share = u.strongVs.reduce((s, d) => s + (shares[d] ?? 0), 0);
    bonus += (u.attack ?? 0) * n * cfg.counterBonus * Math.min(1, share);
  }
  return bonus;
}

/**
 * Resolve a regular attack. MUTATES the passed (already-cloned) attacker &
 * defender, transferring land and applying losses, and returns a report.
 * Deterministic given the same inputs + rng.
 */
export function resolveAttack(
  attacker: EmpireState,
  defender: EmpireState,
  force: ForceSelection,
  cfg: CombatTuning,
  rng: Rng,
  /** Anti-farming multiplier on captured land (1 = full; <1 when re-hitting). */
  landRewardScale = 1,
): CombatReport {
  const atk =
    (offensivePower(force) + counterBonus(force, defender, cfg)) *
    moraleMult(attacker);
  const def = defensivePower(defender) * moraleMult(defender);

  const jitter = 1 + (rng.next() * 2 - 1) * cfg.jitter;
  const ratio = (atk / (def + 1)) * jitter;
  const won = ratio >= cfg.winThreshold;

  const attackerLosses: Record<string, number> = {};
  const defenderLosses: Record<string, number> = {};
  let landCaptured = 0;
  let capturedTiles: number[] = [];

  if (won) {
    const decisiveness = Math.min(1, (ratio - cfg.winThreshold) + 0.2);
    const frac =
      Math.min(
        cfg.maxLandCaptureFraction,
        cfg.landRewardCoeff + decisiveness * cfg.landRewardCoeff,
      ) * landRewardScale;
    landCaptured = Math.min(
      defender.regions.length,
      Math.max(1, Math.round(defender.regions.length * frac)),
    );
    applyLosses(force, attacker, cfg.attackerLossOnWin, attackerLosses);
    applyLosses(defender.units, defender, cfg.defenderLossOnWin, defenderLosses);
    capturedTiles = transferLand(attacker, defender, landCaptured);
  } else {
    applyLosses(force, attacker, cfg.attackerLossOnLoss, attackerLosses);
    applyLosses(defender.units, defender, cfg.defenderLossOnLoss, defenderLosses);
  }

  return {
    won,
    attackPower: Math.round(atk),
    defensePower: Math.round(def),
    ratio: Number(ratio.toFixed(2)),
    landCaptured,
    capturedTiles,
    attackerLosses,
    defenderLosses,
  };
}

function applyLosses(
  source: Record<string, number>,
  target: EmpireState,
  fraction: number,
  out: Record<string, number>,
): void {
  for (const [key, n] of Object.entries(source)) {
    const lost = Math.min(target.units[key] ?? 0, Math.floor(n * fraction));
    if (lost <= 0) continue;
    out[key] = lost;
    target.units[key] = (target.units[key] ?? 0) - lost;
    if (target.units[key] <= 0) delete target.units[key];
  }
}

function transferLand(
  attacker: EmpireState,
  defender: EmpireState,
  count: number,
): number[] {
  const taken = defender.regions.splice(defender.regions.length - count, count);
  const tiles: number[] = [];
  for (const r of taken) {
    // Captured land is razed to raw terrain but keeps its planet tile.
    attacker.regions.push({ id: r.id, type: r.type, tile: r.tile });
    if (r.tile !== undefined) tiles.push(r.tile);
  }
  return tiles;
}
