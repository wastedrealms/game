import { describe, it, expect } from "vitest";
import {
  createGame,
  stepNpcs,
  DEFAULT_GAME_CONFIG,
  type GameState,
} from "../src/index.js";

// ms of real time per turn at default pacing (so lazy accrual grants turns).
const MS_PER_TURN =
  (DEFAULT_GAME_CONFIG.dayMinutes * 60_000) / DEFAULT_GAME_CONFIG.turnsPerDay;

function newGame(): GameState {
  return createGame({
    now: 0,
    seed: 1,
    empires: [
      { id: "p1", name: "Player" }, // human does nothing this test
      { id: "n1", name: "Nemesis", isNpc: true },
    ],
  });
}

/** Run the NPC over `turns` turns, advancing the clock so turns keep accruing. */
function runNpc(g: GameState, turns: number): GameState {
  let now = 0;
  for (let i = 0; i < turns; i++) {
    now += MS_PER_TURN;
    g = stepNpcs(g, { now, seed: 1 });
  }
  return g;
}

describe("smarter NPC turns", () => {
  it("grows net worth instead of stalling", () => {
    const start = newGame();
    const after = runNpc(start, 16);
    // The human (p1) was never touched.
    expect(after.empires.p1.netWorth).toBe(start.empires.p1.netWorth);
    expect(after.empires.n1.netWorth).toBeGreaterThan(start.empires.n1.netWorth);
  });

  it("develops its economy (builds structures on its land)", () => {
    const g = runNpc(newGame(), 16);
    const withStructure = g.empires.n1.regions.filter((r) => r.structure).length;
    expect(withStructure).toBeGreaterThan(0);
  });

  it("stays solvent — manages fuel instead of bleeding it to zero", () => {
    const g = runNpc(newGame(), 16);
    expect(g.empires.n1.resources.fuel).toBeGreaterThan(0);
    expect(g.empires.n1.resources.gold).toBeGreaterThanOrEqual(0);
  });

  it("expands its territory when wealthy", () => {
    const start = newGame();
    const after = runNpc(start, 24);
    expect(after.empires.n1.regions.length).toBeGreaterThan(
      start.empires.n1.regions.length,
    );
  });

  it("is fully deterministic for identical inputs", () => {
    const a = runNpc(newGame(), 16);
    const b = runNpc(newGame(), 16);
    expect(JSON.stringify(a.empires.n1)).toBe(JSON.stringify(b.empires.n1));
  });
});
