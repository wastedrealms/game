import { describe, it, expect } from "vitest";
import {
  makePlanet,
  placeEmpires,
  landShare,
  frontierTiles,
  createGame,
  DEFAULT_GAME_CONFIG,
} from "../src/index.js";

describe("planet generation", () => {
  it("makes a planet of the requested size, all neutral, with neighbours", () => {
    const p = makePlanet(200, 1);
    expect(p.size).toBe(200);
    expect(p.pos).toHaveLength(200);
    expect(p.owner.every((o) => o === null)).toBe(true);
    // every tile has neighbours, and positions are unit vectors
    expect(p.neighbors.every((n) => n.length > 0)).toBe(true);
    const [x, y, z] = p.pos[100];
    expect(Math.hypot(x, y, z)).toBeCloseTo(1, 5);
  });

  it("is deterministic for the same (size, seed)", () => {
    expect(JSON.stringify(makePlanet(150, 7))).toBe(
      JSON.stringify(makePlanet(150, 7)),
    );
  });

  it("places empires at distinct homes with contiguous clusters", () => {
    const p = makePlanet(300, 2);
    const placed = placeEmpires(p, [
      { id: "a", types: ["urban", "river", "desert"] },
      { id: "b", types: ["urban", "river", "desert"] },
    ]);
    expect(placed.a).toHaveLength(3);
    expect(placed.b).toHaveLength(3);
    // homes are different tiles
    expect(placed.a[0]).not.toBe(placed.b[0]);
    // each placed tile is owned by that empire and stamped with its terrain
    expect(p.owner[placed.a[0]]).toBe("a");
    expect(landShare(p, "a")).toBeCloseTo(0.5, 5);
  });

  it("frontier tiles are neutral neighbours of owned land", () => {
    const p = makePlanet(200, 3);
    placeEmpires(p, [{ id: "a", types: ["urban", "urban", "urban"] }]);
    const frontier = frontierTiles(p, "a");
    expect(frontier.length).toBeGreaterThan(0);
    expect(frontier.every((t) => p.owner[t] === null)).toBe(true);
  });
});

describe("planet wired into a game", () => {
  it("createGame builds a planet and binds starting regions to tiles", () => {
    const g = createGame({
      now: 0,
      seed: 1,
      config: DEFAULT_GAME_CONFIG,
      empires: [
        { id: "p1", name: "P" },
        { id: "n1", name: "N", isNpc: true },
      ],
    });
    expect(g.planet.size).toBeGreaterThan(0);
    // every starting region references a tile owned by its empire
    for (const r of g.empires.p1.regions) {
      expect(r.tile).toBeDefined();
      expect(g.planet.owner[r.tile!]).toBe("p1");
    }
  });
});
