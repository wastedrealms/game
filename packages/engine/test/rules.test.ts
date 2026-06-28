import { describe, it, expect } from "vitest";
import {
  createEmpire,
  dayOf,
  turnsLeftInDay,
  netPerTurn,
  canBuildStructure,
  canBuildUnit,
  computeNetWorth,
  regionBuyCost,
  adjacencyBonus,
  supportMult,
  DEFAULT_GAME_CONFIG,
} from "../src/index.js";

const cfg = DEFAULT_GAME_CONFIG;

describe("turn-based day", () => {
  it("advances the day index every turnsPerDay turns", () => {
    expect(dayOf(0, cfg)).toBe(0);
    expect(dayOf(cfg.turnsPerDay - 1, cfg)).toBe(0);
    expect(dayOf(cfg.turnsPerDay, cfg)).toBe(1);
    expect(dayOf(cfg.turnsPerDay * 3, cfg)).toBe(3);
  });

  it("counts turns-left down through the day, then flips to a full day", () => {
    expect(turnsLeftInDay(0, cfg)).toBe(cfg.turnsPerDay); // fresh day
    expect(turnsLeftInDay(1, cfg)).toBe(cfg.turnsPerDay - 1);
    expect(turnsLeftInDay(cfg.turnsPerDay - 1, cfg)).toBe(1); // last turn of day
    expect(turnsLeftInDay(cfg.turnsPerDay, cfg)).toBe(cfg.turnsPerDay); // rolled over
  });
});

describe("economy: net per turn", () => {
  it("computes the default starting empire's balance", () => {
    const e = createEmpire({ id: "a", name: "A", now: 0 });
    const net = netPerTurn(e, cfg);
    // regions: food 165, gold 175, fuel 10; tax +50 (100M pop × 5% × 0.1); food −160
    expect(net.gold).toBe(225);
    expect(net.food).toBe(5);
    expect(net.fuel).toBe(10);
    expect(net.ore).toBe(0);
  });

  it("reflects higher tax as more gold", () => {
    const e = createEmpire({ id: "a", name: "A", now: 0 });
    e.taxRate = 50;
    const net = netPerTurn(e, cfg);
    expect(net.gold).toBe(175 + 500); // 100M pop × 50% × 0.1 = 500 tax gold
  });
});

describe("prerequisite checks", () => {
  it("blocks a barracks without 10 urban regions", () => {
    const e = createEmpire({ id: "a", name: "A", now: 0 });
    const check = canBuildStructure(e, "barracks");
    expect(check.ok).toBe(false);
    expect(check.reason).toMatch(/urban/);
  });

  it("allows a barracks with 10 urban and gold", () => {
    const e = createEmpire({
      id: "a",
      name: "A",
      now: 0,
      startRegions: { urban: 10 },
      startResources: { gold: 5000 },
    });
    expect(canBuildStructure(e, "barracks").ok).toBe(true);
  });

  it("blocks a windmill without a free desert region", () => {
    const e = createEmpire({
      id: "a",
      name: "A",
      now: 0,
      startRegions: { urban: 1 },
    });
    expect(canBuildStructure(e, "windmill").ok).toBe(false);
  });

  it("blocks a shipyard lacking ore & steel even with the regions", () => {
    const e = createEmpire({
      id: "a",
      name: "A",
      now: 0,
      startRegions: { industrial: 10 },
      startResources: { gold: 5000, ore: 0, steel: 0 },
    });
    const check = canBuildStructure(e, "shipyard");
    expect(check.ok).toBe(false);
  });

  it("blocks units without their barracks", () => {
    const e = createEmpire({ id: "a", name: "A", now: 0 });
    expect(canBuildUnit(e, "lightInfantry", 1).ok).toBe(false);
  });
});

describe("adjacency synergy (planet neighbour graph)", () => {
  // A tiny 2-tile planet where tile 0 and tile 1 are neighbours.
  function twoTilePlanet() {
    return {
      size: 2,
      pos: [
        [0, 0, 1],
        [0, 0, -1],
      ] as [number, number, number][],
      terrain: ["industrial", "river"] as ("industrial" | "river")[],
      owner: ["a", "a"] as (string | null)[],
      structure: [null, "powerPlant"] as (string | null)[],
      neighbors: [[1], [0]],
    };
  }

  it("a power plant boosts an adjacent industrial tile's gold", () => {
    const e = createEmpire({ id: "a", name: "A", now: 0, startRegions: {} });
    e.regions = [
      { id: "r0", type: "industrial", tile: 0 },
      { id: "r1", type: "river", structure: "powerPlant", tile: 1 },
    ];
    expect(adjacencyBonus(e, twoTilePlanet()).gold).toBe(13); // round(25 * 0.5)
  });

  it("no synergy without the source structure", () => {
    const e = createEmpire({ id: "a", name: "A", now: 0, startRegions: {} });
    e.regions = [
      { id: "r0", type: "industrial", tile: 0 },
      { id: "r1", type: "river", tile: 1 },
    ];
    const p = twoTilePlanet();
    p.structure = [null, null];
    expect(adjacencyBonus(e, p).gold ?? 0).toBe(0);
  });

  it("no synergy without a planet (no spatial info)", () => {
    const e = createEmpire({ id: "a", name: "A", now: 0, startRegions: {} });
    e.regions = [
      { id: "r0", type: "industrial", tile: 0 },
      { id: "r1", type: "river", structure: "powerPlant", tile: 1 },
    ];
    expect(adjacencyBonus(e).gold ?? 0).toBe(0);
  });
});

describe("support & tax", () => {
  it("support multiplier is 1.0 at full support and the floor at zero", () => {
    const e = createEmpire({ id: "a", name: "A", now: 0 });
    e.popularSupport = 100;
    expect(supportMult(e, cfg)).toBeCloseTo(1, 5);
    e.popularSupport = 0;
    expect(supportMult(e, cfg)).toBeCloseTo(cfg.economy.supportIncomeFloor, 5);
  });

  it("low support reduces net income vs full support", () => {
    const happy = createEmpire({ id: "a", name: "A", now: 0 });
    const unhappy = createEmpire({ id: "b", name: "B", now: 0 });
    unhappy.popularSupport = 20;
    expect(netPerTurn(unhappy, cfg).gold).toBeLessThan(netPerTurn(happy, cfg).gold);
  });
});

describe("net worth & costs", () => {
  it("scores a fresh empire above zero (land + banked gold)", () => {
    const e = createEmpire({ id: "a", name: "A", now: 0 });
    expect(computeNetWorth(e)).toBeGreaterThan(0);
  });

  it("prices region purchases from reference data", () => {
    expect(regionBuyCost("technology", 2)).toBe(6000);
    expect(regionBuyCost("desert", 3)).toBe(300);
  });
});
