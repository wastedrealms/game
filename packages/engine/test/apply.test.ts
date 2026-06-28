import { describe, it, expect } from "vitest";
import {
  createGame,
  apply,
  frontierTiles,
  type GameState,
  type ApplyContext,
} from "../src/index.js";

const ctx: ApplyContext = { now: 0, seed: 1 };

function newGame(): GameState {
  return createGame({
    now: 0,
    seed: 1,
    empires: [
      { id: "p1", name: "Player" },
      { id: "n1", name: "Nemesis", isNpc: true },
    ],
  });
}

describe("createGame", () => {
  it("creates the requested empires ready to play", () => {
    const g = newGame();
    expect(g.order).toEqual(["p1", "n1"]);
    expect(g.empires.p1.turnsPlayed).toBe(0);
    expect(g.empires.p1.resources.gold).toBe(2000);
  });
});

describe("purity & determinism", () => {
  it("never mutates the input state", () => {
    const g = newGame();
    const goldBefore = g.empires.p1.resources.gold;
    apply(g, "p1", { kind: "BUY_REGION", regionType: "desert", qty: 1 }, ctx);
    expect(g.empires.p1.resources.gold).toBe(goldBefore);
  });

  it("is deterministic for identical inputs", () => {
    const g = newGame();
    const a = apply(g, "p1", { kind: "PLAY_TURN" }, ctx);
    const b = apply(g, "p1", { kind: "PLAY_TURN" }, ctx);
    expect(a.state.empires.p1).toEqual(b.state.empires.p1);
  });
});

describe("BUY_REGION", () => {
  it("deducts gold and adds regions", () => {
    const g = newGame();
    const n0 = g.empires.p1.regions.length;
    const { state, result } = apply(
      g,
      "p1",
      { kind: "BUY_REGION", regionType: "desert", qty: 2 },
      ctx,
    );
    expect(result.ok).toBe(true);
    expect(state.empires.p1.regions.length).toBe(n0 + 2);
    expect(state.empires.p1.resources.gold).toBe(2000 - 200);
  });

  it("rejects purchases the empire can't afford", () => {
    const g = newGame();
    const { result } = apply(
      g,
      "p1",
      { kind: "BUY_REGION", regionType: "technology", qty: 1 },
      ctx,
    );
    expect(result.ok).toBe(false);
  });
});

describe("shared land pool", () => {
  // A game whose human is flush with credits, so the POOL is what limits land.
  function richGame(): GameState {
    const g = newGame();
    return {
      ...g,
      empires: {
        ...g.empires,
        p1: { ...g.empires.p1, resources: { ...g.empires.p1.resources, gold: 1_000_000 } },
      },
    };
  }

  it("starts scaled to the number of empires", () => {
    const g = newGame(); // 2 empires
    expect(g.landPool).toBe(g.config.landPerEmpirePerDay * 2);
  });

  it("claims an adjacent frontier tile and decrements the pool", () => {
    const g = richGame();
    const t = frontierTiles(g.planet, "p1")[0];
    const { state, result } = apply(
      g,
      "p1",
      { kind: "BUY_REGION", regionType: "industrial", qty: 1, tile: t },
      ctx,
    );
    expect(result.ok).toBe(true);
    expect(state.planet.owner[t]).toBe("p1");
    expect(state.planet.terrain[t]).toBe("industrial");
    expect(state.landPool).toBe(g.landPool - 1);
  });

  it("rejects claiming a non-adjacent tile", () => {
    const g = richGame();
    const frontier = new Set(frontierTiles(g.planet, "p1"));
    const far = g.planet.owner.findIndex((o, i) => o === null && !frontier.has(i));
    const { result } = apply(
      g,
      "p1",
      { kind: "BUY_REGION", regionType: "desert", qty: 1, tile: far },
      ctx,
    );
    expect(result.ok).toBe(false);
  });

  it("rejects claiming an already-owned tile", () => {
    const g = richGame();
    const mine = g.empires.p1.regions[0].tile!;
    const { result } = apply(
      g,
      "p1",
      { kind: "BUY_REGION", regionType: "industrial", qty: 1, tile: mine },
      ctx,
    );
    expect(result.ok).toBe(false);
  });

  it("rejects claims when the daily pool is exhausted", () => {
    const g = { ...richGame(), landPool: 0 };
    const t = frontierTiles(g.planet, "p1")[0];
    const { result } = apply(
      g,
      "p1",
      { kind: "BUY_REGION", regionType: "desert", qty: 1, tile: t },
      ctx,
    );
    expect(result.ok).toBe(false);
  });

  it("refills the pool when a new day (turnsPerDay turns) rolls over", () => {
    let g = { ...richGame(), landPool: 0 };
    // Play a full day's worth of turns with the pool drained...
    for (let i = 0; i < g.config.turnsPerDay; i++) {
      g = apply(g, "p1", { kind: "PLAY_TURN" }, ctx).state;
    }
    expect(g.empires.p1.turnsPlayed).toBe(g.config.turnsPerDay);
    // ...then the first action of the new day refills the shared pool to a full
    // day's allotment (scaled by empire count).
    g = apply(g, "p1", { kind: "PLAY_TURN" }, ctx).state;
    expect(g.landPool).toBe(g.config.landPerEmpirePerDay * 2);
  });
});

describe("BUILD_STRUCTURE", () => {
  it("places an economic structure on a matching region", () => {
    const g = newGame();
    const { state, result } = apply(
      g,
      "p1",
      { kind: "BUILD_STRUCTURE", structureKey: "farm" },
      ctx,
    );
    expect(result.ok).toBe(true);
    expect(state.empires.p1.regions.some((r) => r.structure === "farm")).toBe(true);
    expect(state.empires.p1.resources.gold).toBe(2000 - 100);
  });

  it("consumes ore & steel when building a shipyard", () => {
    let g = newGame();
    // Hand-set prerequisites: 10 industrial, stockpiled ore/steel, gold.
    g = {
      ...g,
      empires: {
        ...g.empires,
        p1: {
          ...g.empires.p1,
          regions: Array.from({ length: 10 }, (_, i) => ({
            id: `p1-i${i}`,
            type: "industrial" as const,
          })),
          resources: { gold: 5000, food: 0, fuel: 0, ore: 5, steel: 5 },
        },
      },
    };
    const { state, result } = apply(
      g,
      "p1",
      { kind: "BUILD_STRUCTURE", structureKey: "shipyard" },
      ctx,
    );
    expect(result.ok).toBe(true);
    expect(state.empires.p1.militaryStructures.shipyard).toBe(1);
    expect(state.empires.p1.resources.ore).toBe(0);
    expect(state.empires.p1.resources.steel).toBe(0);
    expect(state.empires.p1.resources.gold).toBe(4000);
  });

  it("rejects a structure whose prereqs are unmet", () => {
    const g = newGame();
    const { result } = apply(
      g,
      "p1",
      { kind: "BUILD_STRUCTURE", structureKey: "barracks" },
      ctx,
    );
    expect(result.ok).toBe(false);
  });
});

describe("BUILD_UNIT", () => {
  it("adds units in batch multiples after a barracks exists", () => {
    let g = newGame();
    g = {
      ...g,
      empires: {
        ...g.empires,
        p1: {
          ...g.empires.p1,
          militaryStructures: { barracks: 1 },
          resources: { gold: 1000, food: 100, fuel: 0, ore: 0, steel: 0 },
        },
      },
    };
    const { state, result } = apply(
      g,
      "p1",
      { kind: "BUILD_UNIT", unitKey: "lightInfantry", batches: 2 },
      ctx,
    );
    expect(result.ok).toBe(true);
    expect(state.empires.p1.units.lightInfantry).toBe(40); // batch 20 × 2
    expect(state.empires.p1.resources.gold).toBe(1000 - 100); // 50 × 2
  });
});

describe("PLAY_TURN", () => {
  it("advances the turn counter and applies net income", () => {
    const g = newGame();
    const { state, result } = apply(g, "p1", { kind: "PLAY_TURN" }, ctx);
    expect(result.ok).toBe(true);
    const e = state.empires.p1;
    expect(e.turnsPlayed).toBe(1);
    expect(e.resources.gold).toBe(2000 + 225); // 175 region + 50 tax (100M × 5% × 0.1)
    expect(e.resources.food).toBe(500 + 5); // food 165 income − 160 consumption
    expect(e.resources.fuel).toBe(200 + 10);
    expect(e.protectionTurnsLeft).toBe(g.config.protectionTurns - 1);
  });

  it("starves an empire that cannot feed its population", () => {
    let g = newGame();
    g = {
      ...g,
      empires: {
        ...g.empires,
        p1: {
          ...g.empires.p1,
          regions: [], // no food income
          resources: { gold: 0, food: 0, fuel: 0, ore: 0, steel: 0 },
        },
      },
    };
    const { state, result } = apply(g, "p1", { kind: "PLAY_TURN" }, ctx);
    expect(result.ok).toBe(true);
    expect(result.message).toMatch(/FAMINE/i);
    expect(state.empires.p1.popularSupport).toBeLessThan(100);
    expect(state.empires.p1.population).toBeLessThan(100);
  });
});

describe("MARKET", () => {
  it("sells a resource for gold at the listed price", () => {
    let g = newGame();
    g = {
      ...g,
      empires: {
        ...g.empires,
        p1: {
          ...g.empires.p1,
          resources: { gold: 2000, food: 0, fuel: 0, ore: 10, steel: 0 },
        },
      },
    };
    const { state, result } = apply(
      g,
      "p1",
      { kind: "MARKET", side: "sell", resource: "ore", qty: 5 },
      ctx,
    );
    expect(result.ok).toBe(true);
    expect(state.empires.p1.resources.ore).toBe(5);
    // ore reference 30 × sellSpread 0.45 = floor 13/unit × 5 = 65
    expect(state.empires.p1.resources.gold).toBe(2000 + 5 * 13);
  });

  it("rejects selling more than you hold", () => {
    const g = newGame();
    const { result } = apply(
      g,
      "p1",
      { kind: "MARKET", side: "sell", resource: "steel", qty: 1 },
      ctx,
    );
    expect(result.ok).toBe(false);
  });

  it("buys a resource for gold at the spread price", () => {
    const g = newGame();
    const { state, result } = apply(
      g,
      "p1",
      { kind: "MARKET", side: "buy", resource: "fuel", qty: 10 },
      ctx,
    );
    expect(result.ok).toBe(true);
    // fuel sell 15 → buy ceil(15*1.25)=19 each ×10 = 190
    expect(state.empires.p1.resources.fuel).toBe(200 + 10);
    expect(state.empires.p1.resources.gold).toBe(2000 - 190);
  });
});

describe("SET_TAX", () => {
  it("clamps the tax rate to 0–100", () => {
    const g = newGame();
    expect(apply(g, "p1", { kind: "SET_TAX", rate: 250 }, ctx).state.empires.p1.taxRate).toBe(100);
    expect(apply(g, "p1", { kind: "SET_TAX", rate: -5 }, ctx).state.empires.p1.taxRate).toBe(0);
  });
});

describe("support & tax tick", () => {
  it("high tax erodes popular support", () => {
    let g = newGame();
    g = apply(g, "p1", { kind: "SET_TAX", rate: 60 }, ctx).state;
    const after = apply(g, "p1", { kind: "PLAY_TURN" }, ctx).state;
    expect(after.empires.p1.popularSupport).toBeLessThan(100);
  });

  it("population grows while support is high", () => {
    const g = newGame();
    const after = apply(g, "p1", { kind: "PLAY_TURN" }, ctx).state;
    expect(after.empires.p1.population).toBeGreaterThan(g.empires.p1.population);
  });
});
