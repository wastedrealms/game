import { describe, it, expect } from "vitest";
import {
  createGame,
  apply,
  resolveCovertOp,
  covertSuccessChance,
  makeRng,
  DEFAULT_GAME_CONFIG,
  type EmpireState,
  type GameState,
  type ApplyContext,
} from "../src/index.js";

const ctx: ApplyContext = { now: 0, seed: 1 };
const cov = DEFAULT_GAME_CONFIG.covert;

function empire(over: Partial<EmpireState>): EmpireState {
  return {
    id: "x",
    name: "X",
    isNpc: false,
    resources: { gold: 1000, food: 0, fuel: 0, ore: 0, steel: 0 },
    population: 100,
    popularSupport: 100,
    taxRate: 5,
    regions: [],
    militaryStructures: {},
    units: {},
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

describe("covert success chance", () => {
  it("rises with committed agents and caps", () => {
    expect(covertSuccessChance(0, cov)).toBeCloseTo(cov.baseSuccess);
    expect(covertSuccessChance(1e6, cov)).toBe(cov.maxSuccess);
  });

  it("orbital recon adds a flat success bonus (still capped)", () => {
    expect(covertSuccessChance(0, cov, true)).toBeCloseTo(cov.baseSuccess + cov.reconSuccessBonus);
    expect(covertSuccessChance(0, cov, false)).toBeCloseTo(cov.baseSuccess);
    // never exceeds the cap even with the recon bonus
    expect(covertSuccessChance(1e6, cov, true)).toBe(cov.maxSuccess);
  });
});

describe("resolveCovertOp", () => {
  it("sabotage steals gold on success", () => {
    const atk = empire({ units: { covertAgent: 200 } });
    const def = empire({ resources: { gold: 1000, food: 0, fuel: 0, ore: 0, steel: 0 } });
    // seed chosen so the op succeeds
    let report = resolveCovertOp(atk, def, "sabotage", 200, cov, makeRng(1));
    if (!report.success) report = resolveCovertOp(atk, def, "sabotage", 200, cov, makeRng(2));
    expect(report.success).toBe(true);
    expect(report.goldStolen).toBe(150); // 15% of 1000
    expect(def.resources.gold).toBe(850);
  });

  it("incite lowers support on success", () => {
    const atk = empire({ units: { covertAgent: 300 } });
    const def = empire({ popularSupport: 100 });
    let report = resolveCovertOp(atk, def, "incite", 300, cov, makeRng(1));
    if (!report.success) report = resolveCovertOp(atk, def, "incite", 300, cov, makeRng(2));
    expect(report.success).toBe(true);
    expect(def.popularSupport).toBe(100 - cov.dissentAmount);
  });

  it("is deterministic for the same seed", () => {
    const a = resolveCovertOp(
      empire({ units: { covertAgent: 100 } }),
      empire({}),
      "spy",
      100,
      cov,
      makeRng(5),
    );
    const b = resolveCovertOp(
      empire({ units: { covertAgent: 100 } }),
      empire({}),
      "spy",
      100,
      cov,
      makeRng(5),
    );
    expect(a).toEqual(b);
  });
});

describe("COVERT_OP action", () => {
  function g(): GameState {
    let game = createGame({
      now: 0,
      seed: 3,
      empires: [
        { id: "p1", name: "P" },
        { id: "n1", name: "N", isNpc: true },
      ],
    });
    game = {
      ...game,
      empires: {
        ...game.empires,
        p1: { ...game.empires.p1, units: { covertAgent: 300 } },
        n1: { ...game.empires.n1, protectionTurnsLeft: 0 },
      },
    };
    return game;
  }

  it("does not mutate input state", () => {
    const game = g();
    const goldBefore = game.empires.p1.resources.gold;
    apply(
      game,
      "p1",
      { kind: "COVERT_OP", targetEmpireId: "n1", operation: "spy", agents: 100 },
      ctx,
    );
    expect(game.empires.p1.resources.gold).toBe(goldBefore); // input untouched
  });

  it("rejects ops with no agents", () => {
    let game = g();
    game = {
      ...game,
      empires: { ...game.empires, p1: { ...game.empires.p1, units: {} } },
    };
    const { result } = apply(
      game,
      "p1",
      { kind: "COVERT_OP", targetEmpireId: "n1", operation: "spy", agents: 100 },
      ctx,
    );
    expect(result.ok).toBe(false);
  });
});
