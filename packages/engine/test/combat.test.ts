import { describe, it, expect } from "vitest";
import {
  createGame,
  apply,
  resolveAttack,
  offensivePower,
  defensivePower,
  makeRng,
  DEFAULT_GAME_CONFIG,
  type EmpireState,
  type GameState,
  type ApplyContext,
} from "../src/index.js";

const ctx: ApplyContext = { now: 0, seed: 1 };
const combatCfg = DEFAULT_GAME_CONFIG.combat;

function empire(over: Partial<EmpireState>): EmpireState {
  return {
    id: "x",
    name: "X",
    isNpc: false,
    resources: { gold: 0, food: 0, fuel: 0, ore: 0, steel: 0 },
    population: 100,
    popularSupport: 100,
    taxRate: 5,
    regions: [],
    militaryStructures: {},
    units: {},
    turns: 8,
    lastAccrualAt: 0,
    protectionTurnsLeft: 0,
    turnsPlayed: 0,
    regionSeq: 0,
    netWorth: 0,
    attacksToday: 0,
    attackDay: 0,
    recentHits: {},
    research: 0,
    tech: [],
    ...over,
  };
}

describe("power calculations", () => {
  it("sums offensive power from committed units", () => {
    expect(offensivePower({ fighterJet: 2, lightInfantry: 10 })).toBe(
      14 * 2 + 2 * 10,
    );
  });

  it("counts static defenses in defensive power", () => {
    const d = empire({
      militaryStructures: { gunTurret: 10 }, // 4 each = 40
      units: { heavyInfantry: 5 }, // def 5 each = 25
    });
    expect(defensivePower(d)).toBe(40 + 25);
  });
});

describe("resolveAttack", () => {
  it("a strong force overruns a weak defender and captures land", () => {
    const atk = empire({ units: { battleTank: 50 } });
    const def = empire({
      regions: Array.from({ length: 20 }, (_, i) => ({
        id: `d${i}`,
        type: "agricultural" as const,
      })),
      units: { lightInfantry: 5 },
    });
    const report = resolveAttack(atk, def, { battleTank: 50 }, combatCfg, makeRng(1));
    expect(report.won).toBe(true);
    expect(report.landCaptured).toBeGreaterThan(0);
    expect(atk.regions.length).toBe(report.landCaptured);
    expect(def.regions.length).toBe(20 - report.landCaptured);
  });

  it("a weak force is repelled by static defenses", () => {
    const atk = empire({ units: { lightInfantry: 20 } }); // power 40
    const def = empire({
      regions: [{ id: "d0", type: "urban" }],
      militaryStructures: { defenseSatellite: 1, missileBase: 5 }, // 120 + 125
    });
    const report = resolveAttack(
      atk,
      def,
      { lightInfantry: 20 },
      combatCfg,
      makeRng(1),
    );
    expect(report.won).toBe(false);
    expect(report.landCaptured).toBe(0);
    expect(def.regions.length).toBe(1);
  });

  it("is deterministic for the same rng seed", () => {
    const mk = () => empire({ units: { battleTank: 20 } });
    const mkDef = () =>
      empire({
        regions: [{ id: "d0", type: "urban" }],
        units: { heavyInfantry: 30 },
      });
    const a = resolveAttack(mk(), mkDef(), { battleTank: 20 }, combatCfg, makeRng(7));
    const b = resolveAttack(mk(), mkDef(), { battleTank: 20 }, combatCfg, makeRng(7));
    expect(a).toEqual(b);
  });
});

describe("ATTACK action", () => {
  function gameWithArmy(): GameState {
    let g = createGame({
      now: 0,
      seed: 1,
      empires: [
        { id: "p1", name: "Player" },
        { id: "n1", name: "Nemesis", isNpc: true },
      ],
    });
    g = {
      ...g,
      empires: {
        ...g.empires,
        p1: {
          ...g.empires.p1,
          protectionTurnsLeft: 0,
          units: { battleTank: 60 },
        },
        n1: {
          ...g.empires.n1,
          protectionTurnsLeft: 0,
          units: { lightInfantry: 5 },
        },
      },
    };
    return g;
  }

  it("rejects attacking a protected empire", () => {
    const g = createGame({
      now: 0,
      seed: 1,
      empires: [
        { id: "p1", name: "P" },
        { id: "n1", name: "N", isNpc: true },
      ],
    });
    // p1 keeps default protection; force p1 out so the target-protection check is what fires
    const g2 = {
      ...g,
      empires: {
        ...g.empires,
        p1: { ...g.empires.p1, protectionTurnsLeft: 0, units: { battleTank: 10 } },
      },
    };
    const { result } = apply(
      g2,
      "p1",
      { kind: "ATTACK", targetEmpireId: "n1", force: { battleTank: 10 } },
      ctx,
    );
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/protection/i);
  });

  it("spends a turn and transfers land on a win", () => {
    const g = gameWithArmy();
    const beforeTarget = g.empires.n1.regions.length;
    const { state, result } = apply(
      g,
      "p1",
      { kind: "ATTACK", targetEmpireId: "n1", force: { battleTank: 60 } },
      ctx,
    );
    expect(result.ok).toBe(true);
    expect(state.empires.p1.turns).toBe(g.config.turnsPerDay - 1);
    expect(state.empires.n1.regions.length).toBeLessThan(beforeTarget);
    expect(state.empires.p1.regions.length).toBeGreaterThan(
      g.empires.p1.regions.length,
    );
  });

  it("does not mutate the input state", () => {
    const g = gameWithArmy();
    const before = g.empires.n1.regions.length;
    apply(
      g,
      "p1",
      { kind: "ATTACK", targetEmpireId: "n1", force: { battleTank: 60 } },
      ctx,
    );
    expect(g.empires.n1.regions.length).toBe(before);
  });
});
