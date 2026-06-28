import { describe, it, expect } from "vitest";
import {
  createGame,
  checkVictory,
  victoryPreset,
  DEFAULT_GAME_CONFIG,
  type GameState,
} from "../src/index.js";

function gameWith(victory = DEFAULT_GAME_CONFIG.victory): GameState {
  return createGame({
    now: 0,
    seed: 1,
    config: { ...DEFAULT_GAME_CONFIG, victory },
    empires: [
      { id: "p1", name: "Player" },
      { id: "n1", name: "Nemesis", isNpc: true },
    ],
  });
}

describe("victory presets", () => {
  it("scales deadline + thresholds by length", () => {
    expect(victoryPreset("score", "short").turnDeadline).toBeLessThan(
      victoryPreset("score", "long").turnDeadline,
    );
    expect(victoryPreset("domination", "long").dominationPct).toBeGreaterThan(
      victoryPreset("domination", "short").dominationPct,
    );
  });
});

describe("checkVictory", () => {
  it("reports an ongoing game with a leader and progress", () => {
    const g = gameWith();
    const v = checkVictory(g);
    expect(v.over).toBe(false);
    expect(g.order).toContain(v.leaderId);
    expect(v.progress).toBeGreaterThanOrEqual(0);
    expect(v.progress).toBeLessThanOrEqual(1);
  });

  it("ends by economic target when an empire is rich enough", () => {
    const g = gameWith(victoryPreset("economic", "short"));
    // Force p1 over the net-worth target.
    const rich: GameState = {
      ...g,
      empires: {
        ...g.empires,
        p1: { ...g.empires.p1, netWorth: g.config.victory.netWorthTarget + 1 },
      },
    };
    const v = checkVictory(rich);
    expect(v.over).toBe(true);
    expect(v.winnerId).toBe("p1");
  });

  it("ends by domination when an empire holds enough land", () => {
    const g = gameWith(victoryPreset("domination", "short"));
    const conq: GameState = {
      ...g,
      empires: {
        ...g.empires,
        p1: {
          ...g.empires.p1,
          regions: Array.from({ length: 90 }, (_, i) => ({
            id: `p1-d${i}`,
            type: "desert" as const,
          })),
        },
        n1: { ...g.empires.n1, regions: [] }, // n1 wiped → p1 also last-standing
      },
    };
    const v = checkVictory(conq);
    expect(v.over).toBe(true);
    expect(v.winnerId).toBe("p1");
  });

  it("ends at the turn deadline with the highest net worth", () => {
    const g = gameWith(victoryPreset("score", "short"));
    const late: GameState = {
      ...g,
      empires: {
        ...g.empires,
        p1: { ...g.empires.p1, turnsPlayed: g.config.victory.turnDeadline, netWorth: 10 },
        n1: { ...g.empires.n1, netWorth: 999 },
      },
    };
    const v = checkVictory(late);
    expect(v.over).toBe(true);
    expect(v.winnerId).toBe("n1"); // higher net worth wins at the buzzer
  });
});
