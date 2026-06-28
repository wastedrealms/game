import { describe, it, expect } from "vitest";
import {
  createGame,
  apply,
  resolveAttack,
  makeRng,
  DEFAULT_GAME_CONFIG,
  type GameState,
  type EmpireState,
  type ApplyContext,
} from "../src/index.js";

const ctx: ApplyContext = { now: 0, seed: 1 };
const combatCfg = DEFAULT_GAME_CONFIG.combat;

/** A game where p1 has a large army and n1 is a weak, land-rich target. */
function gameWithArmy(): GameState {
  const g = createGame({
    now: 0,
    seed: 1,
    empires: [
      { id: "p1", name: "Player" },
      { id: "n1", name: "Nemesis", isNpc: true },
    ],
  });
  const weakRegions: EmpireState["regions"] = Array.from({ length: 60 }, (_, i) => ({
    id: `n1-r${i}`,
    type: "agricultural" as const,
  }));
  return {
    ...g,
    empires: {
      ...g.empires,
      p1: { ...g.empires.p1, protectionTurnsLeft: 0, units: { battleTank: 200 } },
      n1: { ...g.empires.n1, protectionTurnsLeft: 0, units: { lightInfantry: 2 }, regions: weakRegions },
    },
  };
}

const ATTACK = { kind: "ATTACK", targetEmpireId: "n1", force: { battleTank: 50 } } as const;

describe("anti-grief: per-day attack cap", () => {
  it("rejects attacks once the daily cap is reached", () => {
    let g = gameWithArmy();
    for (let i = 0; i < combatCfg.maxAttacksPerDay; i++) {
      const out = apply(g, "p1", ATTACK, ctx);
      g = out.state;
    }
    expect(g.empires.p1.attacksToday).toBe(combatCfg.maxAttacksPerDay);

    const over = apply(g, "p1", ATTACK, ctx);
    expect(over.result.ok).toBe(false);
    expect(over.result.message).toMatch(/attacks today/i);
  });

  it("resets the cap on a new day", () => {
    let g = gameWithArmy();
    for (let i = 0; i < combatCfg.maxAttacksPerDay; i++) {
      g = apply(g, "p1", ATTACK, ctx).state;
    }
    // Play a full day's worth of turns — crossing the day boundary resets attacksToday.
    for (let i = 0; i < DEFAULT_GAME_CONFIG.turnsPerDay; i++) {
      g = apply(g, "p1", { kind: "PLAY_TURN" }, ctx).state;
    }
    const out = apply(g, "p1", ATTACK, ctx);
    expect(out.result.message).not.toMatch(/attacks today/i);
    expect(out.state.empires.p1.attacksToday).toBe(1);
  });
});

describe("anti-grief: diminishing returns on farming", () => {
  it("a re-scaled reward captures less land than the full reward", () => {
    const mkDef = (): EmpireState => ({
      ...gameWithArmy().empires.n1,
    });
    const atk = gameWithArmy().empires.p1;
    const full = resolveAttack({ ...atk }, mkDef(), { battleTank: 50 }, combatCfg, makeRng(3), 1);
    const farmed = resolveAttack({ ...atk }, mkDef(), { battleTank: 50 }, combatCfg, makeRng(3), combatCfg.farmDecay);
    expect(full.won).toBe(true);
    expect(farmed.won).toBe(true);
    expect(farmed.landCaptured).toBeLessThan(full.landCaptured);
  });

  it("re-hitting the same target accumulates heat", () => {
    let g = gameWithArmy();
    g = apply(g, "p1", ATTACK, ctx).state;
    expect(g.empires.p1.recentHits.n1?.heat).toBe(1);
    g = apply(g, "p1", ATTACK, ctx).state;
    expect(g.empires.p1.recentHits.n1?.heat).toBe(2);
  });
});
