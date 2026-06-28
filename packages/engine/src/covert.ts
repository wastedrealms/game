import type { CovertOp, CovertTuning } from "./types.js";
import type { EmpireState } from "./state.js";
import type { Rng } from "./rng.js";

export interface SpyReport {
  gold: number;
  food: number;
  fuel: number;
  units: Record<string, number>;
  militaryStructures: Record<string, number>;
  regions: number;
}

export interface CovertReport {
  op: CovertOp;
  success: boolean;
  agentsLost: number;
  /** Support points removed (incite). */
  supportDrop?: number;
  /** Gold stolen (sabotage). */
  goldStolen?: number;
  /** Intel (spy, on success). */
  intel?: SpyReport;
}

/**
 * Success probability for a covert op given committed agents. Orbital
 * reconnaissance (a Recon or Defense Satellite) adds a flat success bonus.
 */
export function covertSuccessChance(
  agents: number,
  cfg: CovertTuning,
  hasRecon = false,
): number {
  // `?? 0` keeps pre-existing saves (whose config predates this field) safe.
  const recon = hasRecon ? cfg.reconSuccessBonus ?? 0 : 0;
  return Math.min(cfg.maxSuccess, cfg.baseSuccess + agents * cfg.successPerAgent + recon);
}

/**
 * Resolve a covert operation. MUTATES the (already-cloned) attacker & defender:
 * applies agent losses and the op's effect. Deterministic given the rng.
 */
export function resolveCovertOp(
  attacker: EmpireState,
  defender: EmpireState,
  op: CovertOp,
  agents: number,
  cfg: CovertTuning,
  rng: Rng,
  hasRecon = false,
): CovertReport {
  const chance = covertSuccessChance(agents, cfg, hasRecon);
  const success = rng.next() < chance;

  const lossFrac = success ? cfg.agentLossOnSuccess : cfg.agentLossOnFail;
  const agentsLost = Math.min(
    attacker.units.covertAgent ?? 0,
    Math.floor(agents * lossFrac),
  );
  if (agentsLost > 0) {
    attacker.units.covertAgent = (attacker.units.covertAgent ?? 0) - agentsLost;
    if (attacker.units.covertAgent <= 0) delete attacker.units.covertAgent;
  }

  const report: CovertReport = { op, success, agentsLost };
  if (!success) return report;

  switch (op) {
    case "spy":
      report.intel = {
        gold: defender.resources.gold,
        food: defender.resources.food,
        fuel: defender.resources.fuel,
        units: { ...defender.units },
        militaryStructures: { ...defender.militaryStructures },
        regions: defender.regions.length,
      };
      break;
    case "incite": {
      const drop = Math.min(defender.popularSupport, cfg.dissentAmount);
      defender.popularSupport -= drop;
      report.supportDrop = drop;
      break;
    }
    case "sabotage": {
      const stolen = Math.floor(defender.resources.gold * cfg.stealFraction);
      defender.resources.gold -= stolen;
      attacker.resources.gold += stolen;
      report.goldStolen = stolen;
      break;
    }
  }
  return report;
}
