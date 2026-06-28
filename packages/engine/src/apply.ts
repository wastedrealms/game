import type { Action, ActionResult } from "./actions.js";
import type { ApplyContext, EmpireState, GameState, OwnedRegion } from "./state.js";
import type { Resource } from "./types.js";
import { RESOURCES } from "./economy.js";
import {
  canBuildStructure,
  canBuildUnit,
  canResearch,
  computeNetWorth,
  dayOf,
  netPerTurn,
  regionBuyCost,
  researchPerTurn,
} from "./rules.js";
import { REGION_BY_KEY, STRUCTURE_BY_KEY, UNIT_BY_KEY, TECH_BY_KEY } from "./lookups.js";
import { makeRng } from "./rng.js";
import { resolveAttack, type ForceSelection } from "./combat.js";
import {
  areAtPeace,
  npcAcceptsTreaty,
  tradeIncome,
  treatyBetween,
  treatyPair,
} from "./diplomacy.js";
import { resolveCovertOp } from "./covert.js";
import { clonePlanet, frontierTiles } from "./planet.js";
import type { CovertOp, TreatyType } from "./types.js";

/** Outcome of applying an action: the new state plus a result describing what happened. */
export interface ApplyOutput {
  state: GameState;
  result: ActionResult;
}

/**
 * The deterministic reducer. Pure: given the same (state, empireId, action, ctx)
 * it always returns the same output. Never mutates its inputs.
 */
export function apply(
  state: GameState,
  empireId: string,
  action: Action,
  ctx: ApplyContext,
): ApplyOutput {
  // `ctx` (injected time + RNG seed) is part of the apply() contract for
  // server-authoritative play; this phase derives the day from turns played and
  // draws RNG from `state.rngState`, so it isn't read here.
  void ctx;

  const existing = state.empires[empireId];
  if (!existing) {
    return { state, result: { ok: false, message: "Unknown empire" } };
  }

  const next: GameState = {
    ...state,
    empires: { ...state.empires },
    log: state.log,
  };
  const empire: EmpireState = structuredClone(existing);
  next.empires[empireId] = empire;

  // Refill the shared daily land pool when the turn-based day rolls over.
  refillLand(next);

  // Reset the per-day attack count when this empire crosses into a new day.
  refreshAttackDay(empire, next);

  let result: ActionResult;
  switch (action.kind) {
    case "PLAY_TURN":
      result = playTurn(next, empire);
      break;
    case "BUY_REGION":
      result = buyRegion(empire, action.regionType, action.qty, next, action.tile);
      break;
    case "BUILD_STRUCTURE":
      result = buildStructure(empire, action.structureKey, next, action.regionId);
      break;
    case "BUILD_UNIT":
      result = buildUnit(empire, action.unitKey, action.batches);
      break;
    case "RESEARCH":
      result = research(next, empire, action.techKey);
      break;
    case "SET_TAX":
      empire.taxRate = clamp(Math.round(action.rate), 0, 100);
      result = { ok: true, message: `Tax rate set to ${empire.taxRate}%` };
      break;
    case "SET_NAME": {
      const name = action.name.trim().slice(0, 28) || "Your Realm";
      empire.name = name;
      result = { ok: true, message: `Realm renamed to ${name}` };
      break;
    }
    case "ATTACK":
      result = attack(next, empire, action.targetEmpireId, action.force);
      break;
    case "PROPOSE_TREATY":
      result = proposeTreaty(next, empire, action.targetEmpireId, action.treatyType);
      break;
    case "BREAK_TREATY":
      result = breakTreaty(next, empire, action.targetEmpireId);
      break;
    case "MARKET":
      result = market(next, empire, action.side, action.resource, action.qty);
      break;
    case "COVERT_OP":
      result = covertOp(
        next,
        empire,
        action.targetEmpireId,
        action.operation,
        action.agents,
      );
      break;
    default: {
      const _exhaustive: never = action;
      void _exhaustive;
      return { state, result: { ok: false, message: "Unknown action" } };
    }
  }

  empire.netWorth = computeNetWorth(empire);
  return { state: next, result };
}

// ── Action handlers (mutate the already-cloned `empire`) ──────────────────────

function playTurn(state: GameState, empire: EmpireState): ActionResult {
  // Turns are unlimited — playing one simply advances the clock (and the day).
  empire.turnsPlayed += 1;

  const cfg = state.config;
  const net = netPerTurn(empire, cfg, state.planet);
  const shortfalls: Resource[] = [];
  for (const k of RESOURCES) {
    const v = empire.resources[k] + net[k];
    if (v < 0) {
      shortfalls.push(k);
      empire.resources[k] = 0;
    } else {
      empire.resources[k] = v;
    }
  }

  // Trade-treaty income (computed at the game level — see diplomacy.ts).
  const trade = tradeIncome(state, empire.id, cfg);
  if (trade > 0) empire.resources.gold += trade;

  const starving = shortfalls.includes("food");
  const e = cfg.economy;
  let support = empire.popularSupport;

  // Resolve support FIRST, then let population respond to the new support level.
  if (starving) support -= e.supportStarvePenalty;
  const otherShortfall = shortfalls.some((s) => s !== "food");
  if (otherShortfall) support -= e.supportStarvePenalty / 2;
  support -= Math.max(0, empire.taxRate - e.taxComfortThreshold) * 0.5;
  if (!starving && !otherShortfall) support += e.supportRecovery;
  support = clamp(Math.round(support), 0, 100);
  empire.popularSupport = support;

  // Population: starvation always shrinks it; otherwise growth scales with
  // support around the 50% pivot (high support grows, low support declines).
  if (starving) {
    empire.population = Math.max(1, Math.round(empire.population * (1 - e.popStarveRate)));
  } else {
    const growth = e.popGrowthRate * ((support - 50) / 50);
    empire.population = Math.max(1, Math.round(empire.population * (1 + growth)));
  }

  if (empire.protectionTurnsLeft > 0) empire.protectionTurnsLeft -= 1;

  // Research Points accrue from Research Facilities.
  empire.research = (empire.research ?? 0) + researchPerTurn(empire, cfg);

  pushLog(state, empire.id, "turn", turnSummary(empire, net, shortfalls));
  return {
    ok: true,
    message: starving
      ? "Turn played — FAMINE! Population is starving."
      : "Turn played.",
  };
}

function attack(
  state: GameState,
  attacker: EmpireState,
  targetId: string,
  force: ForceSelection,
): ActionResult {
  if (targetId === attacker.id)
    return { ok: false, message: "You cannot attack yourself" };
  const defenderOrig = state.empires[targetId];
  if (!defenderOrig) return { ok: false, message: "Unknown target" };
  if (attacker.protectionTurnsLeft > 0)
    return { ok: false, message: "You're under protection — you cannot attack" };
  if (defenderOrig.protectionTurnsLeft > 0)
    return { ok: false, message: `${defenderOrig.name} is under protection` };
  if (areAtPeace(state, attacker.id, targetId))
    return {
      ok: false,
      message: `A treaty with ${defenderOrig.name} forbids this — break it first`,
    };
  const cap = state.config.combat.maxAttacksPerDay ?? Infinity;
  if (attacker.attacksToday >= cap)
    return { ok: false, message: `Out of attacks today (${cap}/day)` };

  // Validate the committed force against what the attacker actually owns.
  const clean: ForceSelection = {};
  let total = 0;
  for (const [k, n] of Object.entries(force)) {
    const u = UNIT_BY_KEY.get(k);
    if (!u || (u.attack ?? 0) <= 0) continue; // only offensive units
    const c = Math.min(attacker.units[k] ?? 0, Math.max(0, Math.floor(n)));
    if (c > 0) {
      clean[k] = c;
      total += c;
    }
  }
  if (total <= 0) return { ok: false, message: "No offensive units committed" };

  const defender: EmpireState = structuredClone(defenderOrig);
  state.empires[targetId] = defender;

  attacker.attacksToday += 1;

  // Anti-farming: re-hitting the same target within the window yields less land.
  const cmb = state.config.combat;
  const prev = attacker.recentHits[targetId];
  const heat =
    prev && attacker.turnsPlayed - prev.turn < cmb.farmWindow ? prev.heat : 0;
  const landRewardScale = Math.pow(cmb.farmDecay, heat);

  const rng = makeRng(state.rngState >>> 0);
  const report = resolveAttack(attacker, defender, clean, cmb, rng, landRewardScale);
  state.rngState = rng.state();
  defender.netWorth = computeNetWorth(defender);

  // A successful capture adds "heat" so the next raid on this target pays less.
  if (report.won) {
    attacker.recentHits[targetId] = { turn: attacker.turnsPlayed, heat: heat + 1 };
  }

  // Transfer captured tiles to the attacker on the shared planet (razed to raw).
  if (report.capturedTiles.length > 0) {
    const planet = (state.planet = clonePlanet(state.planet));
    for (const t of report.capturedTiles) {
      planet.owner[t] = attacker.id;
      planet.structure[t] = null;
    }
  }

  if (report.won) {
    pushLog(
      state,
      attacker.id,
      "combat",
      `${attacker.name} overran ${defender.name}, capturing ${report.landCaptured} regions.`,
    );
    pushLog(
      state,
      defender.id,
      "combat",
      `${defender.name} lost ${report.landCaptured} regions to ${attacker.name}.`,
    );
    return {
      ok: true,
      message: `Victory! Captured ${report.landCaptured} regions (power ${report.attackPower} vs ${report.defensePower}).`,
    };
  }
  pushLog(
    state,
    attacker.id,
    "combat",
    `${attacker.name}'s assault on ${defender.name} was repelled.`,
  );
  pushLog(
    state,
    defender.id,
    "combat",
    `${defender.name} repelled an attack from ${attacker.name}.`,
  );
  return {
    ok: false,
    message: `Attack repelled (power ${report.attackPower} vs ${report.defensePower}).`,
  };
}

function proposeTreaty(
  state: GameState,
  proposer: EmpireState,
  targetId: string,
  type: TreatyType,
): ActionResult {
  if (targetId === proposer.id)
    return { ok: false, message: "You cannot sign a treaty with yourself" };
  const target = state.empires[targetId];
  if (!target) return { ok: false, message: "Unknown empire" };

  const existing = treatyBetween(state, proposer.id, targetId);
  if (existing?.type === type)
    return { ok: false, message: `You already have a ${type} treaty` };

  // NPCs decide via heuristic; (human targets would get a pending offer in MP).
  if (target.isNpc && !npcAcceptsTreaty(proposer, target, type)) {
    pushLog(state, proposer.id, "diplomacy", `${target.name} declined your ${type} proposal.`);
    return { ok: false, message: `${target.name} declined the ${type} proposal.` };
  }

  const [a, b] = treatyPair(proposer.id, targetId);
  state.treaties = [
    ...state.treaties.filter((t) => !(t.a === a && t.b === b)),
    { a, b, type, since: state.createdAt + state.log.length },
  ];
  pushLog(
    state,
    proposer.id,
    "diplomacy",
    `${proposer.name} and ${target.name} signed a ${type} treaty.`,
  );
  return { ok: true, message: `${target.name} accepted the ${type} treaty.` };
}

function breakTreaty(
  state: GameState,
  actor: EmpireState,
  targetId: string,
): ActionResult {
  const target = state.empires[targetId];
  if (!target) return { ok: false, message: "Unknown empire" };
  const [a, b] = treatyPair(actor.id, targetId);
  const had = state.treaties.some((t) => t.a === a && t.b === b);
  if (!had) return { ok: false, message: "No treaty to break" };
  state.treaties = state.treaties.filter((t) => !(t.a === a && t.b === b));
  pushLog(
    state,
    actor.id,
    "diplomacy",
    `${actor.name} severed its treaty with ${target.name}.`,
  );
  return { ok: true, message: `Treaty with ${target.name} severed.` };
}

function covertOp(
  state: GameState,
  attacker: EmpireState,
  targetId: string,
  op: CovertOp,
  agents: number,
): ActionResult {
  if (targetId === attacker.id)
    return { ok: false, message: "You cannot spy on yourself" };
  const targetOrig = state.empires[targetId];
  if (!targetOrig) return { ok: false, message: "Unknown target" };
  if (targetOrig.protectionTurnsLeft > 0)
    return { ok: false, message: `${targetOrig.name} is under protection` };

  const committed = Math.min(attacker.units.covertAgent ?? 0, Math.floor(agents));
  if (committed <= 0) return { ok: false, message: "No covert agents available" };

  const defender: EmpireState = structuredClone(targetOrig);
  state.empires[targetId] = defender;

  // Orbital reconnaissance (Recon or Defense Satellite) boosts covert success.
  const hasRecon =
    (attacker.militaryStructures.reconSatellite ?? 0) > 0 ||
    (attacker.militaryStructures.defenseSatellite ?? 0) > 0;

  const rng = makeRng(state.rngState >>> 0);
  const report = resolveCovertOp(
    attacker,
    defender,
    op,
    committed,
    state.config.covert,
    rng,
    hasRecon,
  );
  state.rngState = rng.state();
  defender.netWorth = computeNetWorth(defender);

  const opName = { spy: "espionage", incite: "civil dissent", sabotage: "sabotage" }[op];
  if (report.success) {
    let detail = "";
    if (op === "incite") detail = ` — support −${report.supportDrop}`;
    if (op === "sabotage") detail = ` — stole ${report.goldStolen} credits`;
    if (op === "spy" && report.intel)
      detail = ` — ${report.intel.regions} regions, ${report.intel.gold} credits`;
    pushLog(
      state,
      attacker.id,
      "covert",
      `${attacker.name}'s ${opName} against ${defender.name} succeeded${detail}.`,
    );
    if (op !== "spy")
      pushLog(state, defender.id, "covert", `${defender.name} suffered ${opName}!`);
    return { ok: true, message: `Operation succeeded${detail}.` };
  }

  pushLog(
    state,
    attacker.id,
    "covert",
    `${attacker.name}'s ${opName} against ${defender.name} failed (lost ${report.agentsLost} agents).`,
  );
  pushLog(
    state,
    defender.id,
    "covert",
    `${defender.name} caught ${attacker.name}'s agents!`,
  );
  return { ok: false, message: `Operation failed — lost ${report.agentsLost} agents.` };
}

function market(
  state: GameState,
  empire: EmpireState,
  side: "buy" | "sell",
  resource: Resource,
  qty: number,
): ActionResult {
  if (resource === "gold")
    return { ok: false, message: "Gold cannot be traded for itself" };
  if (qty <= 0) return { ok: false, message: "Quantity must be positive" };
  const price = state.config.market.prices[resource];

  if (side === "sell") {
    if ((empire.resources[resource] ?? 0) < qty)
      return { ok: false, message: `Not enough ${resource} to sell` };
    // Sell below the reference price (dealer haircut) so trading isn't a printer.
    const unit = Math.max(1, Math.floor(price * state.config.market.sellSpread));
    const gold = unit * qty;
    empire.resources[resource] -= qty;
    empire.resources.gold += gold;
    return { ok: true, message: `Sold ${qty} ${resource} for ${gold} credits` };
  }

  const unit = Math.ceil(price * state.config.market.buySpread);
  const cost = unit * qty;
  if (empire.resources.gold < cost)
    return { ok: false, message: `Need ${cost} credits` };
  empire.resources.gold -= cost;
  empire.resources[resource] += qty;
  return { ok: true, message: `Bought ${qty} ${resource} for ${cost} credits` };
}

function buyRegion(
  empire: EmpireState,
  regionType: OwnedRegion["type"],
  qty: number,
  state: GameState,
  targetTile?: number,
): ActionResult {
  if (!REGION_BY_KEY.has(regionType))
    return { ok: false, message: "Unknown region type" };
  if (targetTile !== undefined) qty = 1; // claiming a specific tile is one region
  if (qty <= 0) return { ok: false, message: "Quantity must be positive" };
  if (empire.regions.length + qty > state.config.maxRegionsPerEmpire)
    return { ok: false, message: "Region cap reached" };

  // The shared daily land faucet (BRE/SRE): you can only claim what's left today.
  const available = state.landPool ?? 0;
  if (available < qty)
    return {
      ok: false,
      message:
        available <= 0
          ? "No new land available to claim today"
          : `Only ${available} region${available === 1 ? "" : "s"} left to claim today`,
    };

  const cost = regionBuyCost(regionType, qty);
  if (empire.resources.gold < cost)
    return { ok: false, message: `Need ${cost} credits` };

  // Claim tiles on the shared planet — you may only expand into land ADJACENT to
  // your own territory (the frontier). A specific target tile (from a map click)
  // must be a neutral frontier tile; auto-pick draws contiguously from the frontier.
  const planet = (state.planet = clonePlanet(state.planet));
  const owns = (t: number) => planet.owner[t] === empire.id;
  let candidates: number[];
  if (targetTile !== undefined) {
    if (targetTile < 0 || targetTile >= planet.size || planet.owner[targetTile] !== null)
      return { ok: false, message: "That tile is already claimed" };
    if (!(planet.neighbors[targetTile] ?? []).some(owns))
      return { ok: false, message: "You can only claim land adjacent to your territory" };
    candidates = [targetTile];
  } else {
    candidates = frontierTiles(planet, empire.id);
  }
  if (candidates.length < qty)
    return {
      ok: false,
      message: candidates.length === 0 && empire.regions.length > 0
        ? "No open frontier — your territory is hemmed in"
        : "No unclaimed land left on the planet",
    };

  state.landPool = available - qty;
  empire.resources.gold -= cost;
  // Mint deterministic, collision-free ids from the empire's own counter.
  if (empire.regionSeq === undefined) empire.regionSeq = empire.regions.length;
  for (let i = 0; i < qty; i++) {
    const tile = candidates[i];
    planet.owner[tile] = empire.id;
    planet.terrain[tile] = regionType;
    planet.structure[tile] = null;
    empire.regions.push({ id: `${empire.id}-r${empire.regionSeq++}`, type: regionType, tile });
  }
  return { ok: true, message: `Bought ${qty}× ${regionType} for ${cost} credits` };
}

function buildStructure(
  empire: EmpireState,
  structureKey: string,
  state: GameState,
  regionId?: string,
): ActionResult {
  const def = STRUCTURE_BY_KEY.get(structureKey);
  if (!def) return { ok: false, message: "Unknown structure" };

  const check = canBuildStructure(empire, structureKey);
  if (!check.ok) return { ok: false, message: check.reason ?? "Cannot build" };

  // Spend cost + any prereq resources (e.g. Shipyard consumes Ore/Steel).
  spend(empire, check.cost);
  spend(empire, def.prereq?.resources ?? {});

  if (def.buildsOn) {
    // Economic structure: place on a free region of the right type.
    const target =
      (regionId && empire.regions.find((r) => r.id === regionId && !r.structure)) ||
      empire.regions.find((r) => r.type === def.buildsOn && !r.structure);
    if (!target) return { ok: false, message: `No free ${def.buildsOn} region` };
    target.structure = structureKey;
    // Mirror onto the shared planet tile.
    if (target.tile !== undefined) {
      const planet = (state.planet = clonePlanet(state.planet));
      planet.structure[target.tile] = structureKey;
    }
  } else {
    // Military structure: empire-level count.
    empire.militaryStructures[structureKey] =
      (empire.militaryStructures[structureKey] ?? 0) + 1;
  }
  return { ok: true, message: `Built ${def.name}` };
}

function buildUnit(
  empire: EmpireState,
  unitKey: string,
  batches: number,
): ActionResult {
  const def = UNIT_BY_KEY.get(unitKey);
  if (!def) return { ok: false, message: "Unknown unit" };

  const check = canBuildUnit(empire, unitKey, batches);
  if (!check.ok) return { ok: false, message: check.reason ?? "Cannot build" };

  spend(empire, check.cost);
  empire.units[unitKey] = (empire.units[unitKey] ?? 0) + def.batch * batches;
  return {
    ok: true,
    message: `Built ${def.batch * batches}× ${def.name}`,
  };
}

function research(state: GameState, empire: EmpireState, techKey: string): ActionResult {
  const check = canResearch(empire, techKey);
  if (!check.ok) return { ok: false, message: check.reason ?? "Cannot research" };
  const t = TECH_BY_KEY.get(techKey)!;
  empire.research -= check.cost;
  empire.tech = [...empire.tech, techKey];
  pushLog(state, empire.id, "tech", `${empire.name} researched ${t.name}.`);
  return { ok: true, message: `Researched ${t.name}.` };
}

// ── helpers ──────────────────────────────────────────────────────────────────

/**
 * Refill the shared land pool when the turn-based day rolls over. Use-it-or-lose-it:
 * the pool resets to one day's allotment (scaled by empire count) rather than banking,
 * so land stays scarce and contested. The game day is driven by the furthest-along
 * empire's turns, so it advances in lockstep with play (the player drives the world).
 */
function refillLand(state: GameState): void {
  let maxTurns = 0;
  for (const id of state.order) maxTurns = Math.max(maxTurns, state.empires[id].turnsPlayed);
  const day = dayOf(maxTurns, state.config);
  if (day <= (state.landDay ?? 0)) return;
  state.landDay = day;
  state.landPool = state.config.landPerEmpirePerDay * state.order.length;
}

/** Reset an empire's per-day attack count when its turn-based day advances. */
function refreshAttackDay(empire: EmpireState, state: GameState): void {
  const day = dayOf(empire.turnsPlayed, state.config);
  if (day > (empire.attackDay ?? 0)) {
    empire.attackDay = day;
    empire.attacksToday = 0;
  }
}

function spend(empire: EmpireState, bag: Partial<Record<Resource, number>>): void {
  for (const k of Object.keys(bag) as Resource[]) {
    empire.resources[k] = (empire.resources[k] ?? 0) - (bag[k] ?? 0);
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function pushLog(
  state: GameState,
  empireId: string,
  kind: string,
  message: string,
): void {
  state.log = [
    ...state.log,
    { at: state.createdAt + state.log.length, empireId, kind, message },
  ];
}

function turnSummary(
  empire: EmpireState,
  net: Record<Resource, number>,
  shortfalls: Resource[],
): string {
  const parts = RESOURCES.filter((k) => net[k] !== 0).map(
    (k) => `${k} ${net[k] >= 0 ? "+" : ""}${net[k]}`,
  );
  const warn = shortfalls.length ? ` (shortfall: ${shortfalls.join(", ")})` : "";
  return `Turn ${empire.turnsPlayed} · ${empire.name}: ${parts.join(", ")}${warn}`;
}
